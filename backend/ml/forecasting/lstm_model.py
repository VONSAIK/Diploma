import os
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler
import joblib

MODELS_DIR = os.path.join(os.path.dirname(__file__), "trained_models")


class LSTMNet(nn.Module):
    def __init__(self, input_size=1, hidden_size=64, num_layers=2, output_size=1):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])


class LSTMForecaster:
    def __init__(self, seq_len: int = 60, epochs: int = 20):
        self.seq_len = seq_len
        self.epochs = epochs
        self.scaler = MinMaxScaler()
        self.model = LSTMNet()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        self.mape_: float = 0.0
        self.rmse_: float = 0.0
        self.mae_:  float = 0.0

    def _make_sequences(self, data: np.ndarray):
        X, y = [], []
        for i in range(len(data) - self.seq_len):
            X.append(data[i: i + self.seq_len])
            y.append(data[i + self.seq_len])
        return np.array(X), np.array(y)

    def train(self, df: pd.DataFrame) -> dict:
        """Тренує LSTM, валідує на останніх 20% даних, повертає метрики."""
        prices = df["close"].values
        scaled = self.scaler.fit_transform(prices.reshape(-1, 1))
        X, y = self._make_sequences(scaled)

        split = int(len(X) * 0.8)
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]

        X_t = torch.FloatTensor(X_train).to(self.device)
        y_t = torch.FloatTensor(y_train).to(self.device)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=0.001)
        criterion = nn.MSELoss()

        self.model.train()
        for _ in range(self.epochs):
            optimizer.zero_grad()
            loss = criterion(self.model(X_t), y_t)
            loss.backward()
            optimizer.step()

        self.model.eval()
        with torch.no_grad():
            X_v = torch.FloatTensor(X_val).to(self.device)
            pred_scaled = self.model(X_v).cpu().numpy().flatten()

        pred_prices   = self.scaler.inverse_transform(pred_scaled.reshape(-1, 1)).flatten()
        actual_prices = self.scaler.inverse_transform(y_val.reshape(-1, 1)).flatten()

        self.mae_  = float(np.mean(np.abs(actual_prices - pred_prices)))
        self.rmse_ = float(np.sqrt(np.mean((actual_prices - pred_prices) ** 2)))
        nonzero    = actual_prices != 0
        self.mape_ = float(np.mean(np.abs(
            (actual_prices[nonzero] - pred_prices[nonzero]) / actual_prices[nonzero]
        )) * 100)

        return {
            "cv_mape": round(self.mape_, 2),
            "cv_rmse": round(self.rmse_, 2),
            "cv_mae":  round(self.mae_,  2),
        }

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({
            "model_state": self.model.state_dict(),
            "seq_len":     self.seq_len,
            "mape":        self.mape_,
            "rmse":        self.rmse_,
            "mae":         self.mae_,
        }, path)

    @classmethod
    def load(cls, path: str) -> "LSTMForecaster":
        state = joblib.load(path)
        instance = cls(seq_len=state["seq_len"])
        instance.model.load_state_dict(state["model_state"])
        instance.model.to(instance.device)
        instance.model.eval()
        instance.mape_ = state["mape"]
        instance.rmse_ = state["rmse"]
        instance.mae_  = state["mae"]
        return instance

    def _rolling_forecast(self, prices: np.ndarray, days: int, last_date) -> list[dict]:
        last_price = float(prices[-1])

        # Scaler завжди підганяємо під поточні ціни — модель вчить відносні паттерни
        scaled = self.scaler.fit_transform(prices.reshape(-1, 1))
        seq = scaled[-self.seq_len:].tolist()

        self.model.eval()
        raw_preds: list[float] = []
        with torch.no_grad():
            for _ in range(days):
                x    = torch.FloatTensor([seq[-self.seq_len:]]).to(self.device)
                pred = self.model(x).cpu().numpy()[0][0]
                seq.append([pred])
                raw_preds.append(float(self.scaler.inverse_transform([[pred]])[0][0]))

        predictions = []
        current_date = last_date
        prev_price   = last_price
        # Shift the entire trajectory so day-1 starts at the actual last price.
        # The model captures the *direction* of movement; the absolute level is
        # anchored here so the chart connects cleanly to history.
        offset = raw_preds[0] - last_price

        for raw_price in raw_preds:
            current_date += pd.Timedelta(days=1)
            while current_date.weekday() >= 5:
                current_date += pd.Timedelta(days=1)

            corrected  = raw_price - offset
            max_change = prev_price * 0.03
            price      = float(np.clip(corrected, prev_price - max_change, prev_price + max_change))
            price      = round(max(price, 0.01), 2)
            prev_price = price
            predictions.append({"date": current_date.strftime("%Y-%m-%d"), "price": price})

        return predictions

    def predict(self, df: pd.DataFrame, days: int = 30, ticker: str | None = None) -> dict:
        prices  = df["close"].values
        metrics: dict = {}

        if ticker:
            model_path = os.path.join(MODELS_DIR, f"lstm_{ticker}.pkl")
            if os.path.exists(model_path):
                try:
                    loaded = LSTMForecaster.load(model_path)
                    self.model   = loaded.model
                    self.seq_len = loaded.seq_len
                    self.mape_   = loaded.mape_
                    self.rmse_   = loaded.rmse_
                    self.mae_    = loaded.mae_
                    metrics = {
                        "cv_mape":   round(self.mape_, 2),
                        "cv_rmse":   round(self.rmse_, 2),
                        "cv_mae":    round(self.mae_,  2),
                        "pretrained": True,
                    }
                except Exception:
                    pass

        if not metrics:
            metrics = self.train(df)

        predictions = self._rolling_forecast(prices, days, df.index[-1])

        return {
            "predictions":        predictions,
            "confidence_interval": None,
            "metrics":            metrics,
        }
