import os
import numpy as np
import pandas as pd
import xgboost as xgb
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_percentage_error
import ta

MODELS_DIR = os.path.join(os.path.dirname(__file__), "trained_models")


def add_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Додає технічні індикатори як ознаки для ML моделі."""
    d = df.copy()
    c = d["close"]
    h = d["high"]
    l = d["low"]
    v = d["volume"]

    # Trend indicators
    d["sma_10"]  = ta.trend.sma_indicator(c, window=10)
    d["sma_20"]  = ta.trend.sma_indicator(c, window=20)
    d["ema_12"]  = ta.trend.ema_indicator(c, window=12)
    d["ema_26"]  = ta.trend.ema_indicator(c, window=26)
    d["macd"]    = ta.trend.macd(c)
    d["macd_signal"] = ta.trend.macd_signal(c)

    # Momentum
    d["rsi"]     = ta.momentum.rsi(c, window=14)
    d["stoch_k"] = ta.momentum.stoch(h, l, c)

    # Volatility
    d["bb_upper"] = ta.volatility.bollinger_hband(c)
    d["bb_lower"] = ta.volatility.bollinger_lband(c)
    d["bb_width"] = ta.volatility.bollinger_wband(c)
    d["atr"]      = ta.volatility.average_true_range(h, l, c)

    # Volume
    d["obv"]      = ta.volume.on_balance_volume(c, v)
    d["vwap"]     = ta.volume.volume_weighted_average_price(h, l, c, v)

    # Price-derived features
    d["returns_1d"]  = c.pct_change(1)
    d["returns_5d"]  = c.pct_change(5)
    d["returns_10d"] = c.pct_change(10)
    d["price_vs_sma20"] = (c - d["sma_20"]) / d["sma_20"]

    return d.dropna()


FEATURE_COLS = [
    "sma_10", "sma_20", "ema_12", "ema_26", "macd", "macd_signal",
    "rsi", "stoch_k",
    "bb_upper", "bb_lower", "bb_width", "atr",
    "obv", "vwap",
    "returns_1d", "returns_5d", "returns_10d", "price_vs_sma20",
    "open", "high", "low", "volume",
]


class XGBoostForecaster:
    """XGBoost регресор для прогнозу ціни акцій на основі технічних індикаторів."""

    def __init__(self, horizon: int = 1):
        self.horizon = horizon
        self.scaler = StandardScaler()
        self.model = xgb.XGBRegressor(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            verbosity=0,
        )
        self.feature_importance_: dict = {}
        self.mape_: float = 0.0
        self.rmse_: float = 0.0
        self.mae_: float = 0.0

    def train(self, df: pd.DataFrame) -> dict:
        """
        Тренує модель з крос-валідацією.
        Ціль: відносна зміна ціни (return), а не абсолютна ціна.
        Це гарантує що прогноз стартує від поточного рівня.
        """
        df_feat = add_technical_indicators(df)
        features = [c for c in FEATURE_COLS if c in df_feat.columns]

        close_arr = df_feat["close"].values
        n = len(close_arr) - self.horizon

        X_raw         = df_feat[features].values[:n]
        y_returns     = np.array([(close_arr[i + self.horizon] - close_arr[i]) / close_arr[i]
                                  for i in range(n)])
        y_price_now   = close_arr[:n]           # ціна зараз (для реконструкції)
        y_price_next  = close_arr[self.horizon:] # реальна майбутня ціна (для метрик)

        X_scaled = self.scaler.fit_transform(X_raw)

        tscv = TimeSeriesSplit(n_splits=5)
        mapes, rmses, maes = [], [], []
        for train_idx, val_idx in tscv.split(X_scaled):
            self.model.fit(X_scaled[train_idx], y_returns[train_idx])
            pred_ret  = self.model.predict(X_scaled[val_idx])
            pred_p    = y_price_now[val_idx] * (1 + pred_ret)
            actual_p  = y_price_next[val_idx]
            mapes.append(float(np.mean(np.abs((actual_p - pred_p) / actual_p)) * 100))
            rmses.append(float(np.sqrt(np.mean((actual_p - pred_p) ** 2))))
            maes.append(float(np.mean(np.abs(actual_p - pred_p))))

        # Фінальне навчання на всіх даних
        self.model.fit(X_scaled, y_returns)

        imp = self.model.feature_importances_
        self.feature_importance_ = dict(sorted(
            zip(features, imp.tolist()),
            key=lambda x: x[1],
            reverse=True,
        )[:10])
        self.mape_ = float(np.mean(mapes))
        self.rmse_ = float(np.mean(rmses))
        self.mae_ = float(np.mean(maes))

        return {
            "cv_mape": round(self.mape_, 2),
            "cv_rmse": round(self.rmse_, 2),
            "cv_mae":  round(self.mae_, 2),
            "feature_importance": self.feature_importance_,
        }

    def save(self, path: str) -> None:
        """Зберігає модель, scaler і метрики на диск."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({
            "model": self.model,
            "scaler": self.scaler,
            "feature_importance": self.feature_importance_,
            "mape": self.mape_,
            "rmse": self.rmse_,
            "mae":  self.mae_,
        }, path)

    @classmethod
    def load(cls, path: str) -> "XGBoostForecaster":
        """Завантажує збережену модель з диску."""
        state = joblib.load(path)
        instance = cls()
        instance.model = state["model"]
        instance.scaler = state["scaler"]
        instance.feature_importance_ = state["feature_importance"]
        instance.mape_ = state["mape"]
        instance.rmse_ = state.get("rmse", 0.0)
        instance.mae_  = state.get("mae", 0.0)
        return instance

    def _rolling_forecast(self, df: pd.DataFrame, days: int) -> list[dict]:
        """Генерує прогноз на N днів вперед за допомогою rolling window."""
        df_feat = add_technical_indicators(df)
        features = [c for c in FEATURE_COLS if c in df_feat.columns]

        feat_idx = {f: i for i, f in enumerate(features)}
        last_row = df_feat[features].values[-1].copy()

        price_history = list(df["close"].values[-30:])

        ema12 = float(df_feat["ema_12"].iloc[-1]) if "ema_12" in df_feat else price_history[-1]
        ema26 = float(df_feat["ema_26"].iloc[-1]) if "ema_26" in df_feat else price_history[-1]
        macd_signal = float(df_feat["macd_signal"].iloc[-1]) if "macd_signal" in df_feat else 0.0

        alpha12 = 2 / 13
        alpha26 = 2 / 27
        alpha9  = 2 / 10

        predictions = []
        current_date = df.index[-1]

        for _ in range(days):
            current_date += pd.Timedelta(days=1)
            while current_date.weekday() >= 5:
                current_date += pd.Timedelta(days=1)

            x_scaled = self.scaler.transform(last_row.reshape(1, -1))
            pred_return = float(self.model.predict(x_scaled)[0])
            # Будь-яка зміна ціни понад ±30% за крок фізично неможлива для
            # реальних активів і свідчить про числову нестабільність моделі.
            if not np.isfinite(pred_return):
                pred_return = 0.0
            pred_return = float(np.clip(pred_return, -0.30, 0.30))
            pred_price = price_history[-1] * (1 + pred_return)
            pred_price = max(pred_price, 0.01)

            predictions.append({"date": current_date.strftime("%Y-%m-%d"), "price": round(pred_price, 2)})

            price_history.append(pred_price)
            prev_price = price_history[-2]

            if "returns_1d" in feat_idx:
                last_row[feat_idx["returns_1d"]] = (pred_price - prev_price) / prev_price
            if "returns_5d" in feat_idx and len(price_history) >= 6:
                last_row[feat_idx["returns_5d"]] = (pred_price - price_history[-6]) / price_history[-6]
            if "returns_10d" in feat_idx and len(price_history) >= 11:
                last_row[feat_idx["returns_10d"]] = (pred_price - price_history[-11]) / price_history[-11]

            if "sma_10" in feat_idx and len(price_history) >= 10:
                last_row[feat_idx["sma_10"]] = float(np.mean(price_history[-10:]))
            if "sma_20" in feat_idx and len(price_history) >= 20:
                last_row[feat_idx["sma_20"]] = float(np.mean(price_history[-20:]))

            ema12 = ema12 * (1 - alpha12) + pred_price * alpha12
            ema26 = ema26 * (1 - alpha26) + pred_price * alpha26
            if "ema_12" in feat_idx:
                last_row[feat_idx["ema_12"]] = ema12
            if "ema_26" in feat_idx:
                last_row[feat_idx["ema_26"]] = ema26

            new_macd = ema12 - ema26
            macd_signal = macd_signal * (1 - alpha9) + new_macd * alpha9
            if "macd" in feat_idx:
                last_row[feat_idx["macd"]] = new_macd
            if "macd_signal" in feat_idx:
                last_row[feat_idx["macd_signal"]] = macd_signal

            if "bb_upper" in feat_idx and len(price_history) >= 20:
                window = price_history[-20:]
                bb_mean = float(np.mean(window))
                bb_std  = float(np.std(window))
                last_row[feat_idx["bb_upper"]] = bb_mean + 2 * bb_std
                if "bb_lower" in feat_idx:
                    last_row[feat_idx["bb_lower"]] = bb_mean - 2 * bb_std
                if "bb_width" in feat_idx:
                    last_row[feat_idx["bb_width"]] = (4 * bb_std) / bb_mean if bb_mean > 0 else 0.0

            if "price_vs_sma20" in feat_idx and "sma_20" in feat_idx:
                sma20 = last_row[feat_idx["sma_20"]]
                last_row[feat_idx["price_vs_sma20"]] = (pred_price - sma20) / sma20 if sma20 > 0 else 0.0

        return predictions

    def predict(self, df: pd.DataFrame, days: int = 30, ticker: str | None = None) -> dict:
        """
        Прогнозує ціни на N днів вперед.
        Якщо для тікера є збережена модель — завантажує її.
        Інакше тренує на переданих даних.
        """
        metrics: dict = {}

        if ticker:
            model_path = os.path.join(MODELS_DIR, f"{ticker}.pkl")
            if os.path.exists(model_path):
                try:
                    loaded = XGBoostForecaster.load(model_path)
                    self.model = loaded.model
                    self.scaler = loaded.scaler
                    self.feature_importance_ = loaded.feature_importance_
                    self.mape_ = loaded.mape_
                    self.rmse_ = loaded.rmse_
                    self.mae_  = loaded.mae_
                    metrics = {
                        "cv_mape": round(self.mape_, 2),
                        "cv_rmse": round(self.rmse_, 2),
                        "cv_mae":  round(self.mae_, 2),
                        "feature_importance": self.feature_importance_,
                        "pretrained": True,
                    }
                except Exception:
                    pass

        if not metrics:
            metrics = self.train(df)

        predictions = self._rolling_forecast(df, days)

        return {
            "predictions": predictions,
            "confidence_interval": None,
            "metrics": metrics,
        }
