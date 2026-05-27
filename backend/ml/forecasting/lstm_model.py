import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler


class LSTMNet(nn.Module):
    def __init__(self, input_size=1, hidden_size=64, num_layers=2, output_size=1):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])


class LSTMForecaster:
    def __init__(self, seq_len: int = 60, epochs: int = 50):
        self.seq_len = seq_len
        self.epochs = epochs
        self.scaler = MinMaxScaler()
        self.model = LSTMNet()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

    def _make_sequences(self, data: np.ndarray):
        X, y = [], []
        for i in range(len(data) - self.seq_len):
            X.append(data[i : i + self.seq_len])
            y.append(data[i + self.seq_len])
        return np.array(X), np.array(y)

    def _train(self, prices: np.ndarray):
        scaled = self.scaler.fit_transform(prices.reshape(-1, 1))
        X, y = self._make_sequences(scaled)

        X_t = torch.FloatTensor(X).to(self.device)
        y_t = torch.FloatTensor(y).to(self.device)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=0.001)
        criterion = nn.MSELoss()

        self.model.train()
        for _ in range(self.epochs):
            optimizer.zero_grad()
            loss = criterion(self.model(X_t), y_t)
            loss.backward()
            optimizer.step()

    def predict(self, df: pd.DataFrame, days: int = 30) -> dict:
        prices = df["close"].values
        last_actual_price = float(prices[-1])

        self._train(prices)

        scaled = self.scaler.transform(prices.reshape(-1, 1))
        seq = scaled[-self.seq_len:].tolist()

        self.model.eval()
        raw_predictions = []

        with torch.no_grad():
            for _ in range(days):
                x = torch.FloatTensor([seq[-self.seq_len:]]).to(self.device)
                pred = self.model(x).cpu().numpy()[0][0]
                seq.append([pred])
                price = float(self.scaler.inverse_transform([[pred]])[0][0])
                raw_predictions.append(price)

        # Фіксуємо старт прогнозу до реальної останньої ціни
        # і обмежуємо максимальний дрейф ±1.5% на день
        predictions = []
        current_date = df.index[-1]
        prev_price = last_actual_price
        offset = raw_predictions[0] - last_actual_price  # корекція зсуву

        for i, raw_price in enumerate(raw_predictions):
            current_date += pd.Timedelta(days=1)
            while current_date.weekday() >= 5:
                current_date += pd.Timedelta(days=1)

            corrected = raw_price - offset
            max_change = prev_price * 0.015  # ±1.5% на день максимум
            price = float(np.clip(corrected, prev_price - max_change, prev_price + max_change))
            price = round(max(price, 0.01), 2)
            prev_price = price

            predictions.append({"date": current_date.strftime("%Y-%m-%d"), "price": price})

        return {"predictions": predictions}
