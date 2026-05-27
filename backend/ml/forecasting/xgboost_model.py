import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_percentage_error
import ta


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
        self.horizon = horizon  # прогноз на N днів вперед
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

    def _prepare(self, df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, pd.Index]:
        df_feat = add_technical_indicators(df)
        features = [c for c in FEATURE_COLS if c in df_feat.columns]

        X = df_feat[features].values
        y = df_feat["close"].shift(-self.horizon).dropna().values
        X = X[: len(y)]
        idx = df_feat.index[: len(y)]
        return X, y, idx

    def train(self, df: pd.DataFrame) -> dict:
        X, y, _ = self._prepare(df)
        X_scaled = self.scaler.fit_transform(X)

        # Cross-validation (time series)
        tscv = TimeSeriesSplit(n_splits=5)
        mapes = []
        for train_idx, val_idx in tscv.split(X_scaled):
            self.model.fit(X_scaled[train_idx], y[train_idx])
            pred = self.model.predict(X_scaled[val_idx])
            mapes.append(mean_absolute_percentage_error(y[val_idx], pred) * 100)

        # Final fit on all data
        self.model.fit(X_scaled, y)

        df_feat = add_technical_indicators(df)
        features = [c for c in FEATURE_COLS if c in df_feat.columns]
        imp = self.model.feature_importances_
        self.feature_importance_ = dict(sorted(
            zip(features, imp.tolist()),
            key=lambda x: x[1],
            reverse=True,
        )[:10])
        self.mape_ = float(np.mean(mapes))

        return {
            "cv_mape": round(self.mape_, 2),
            "feature_importance": self.feature_importance_,
        }

    def predict(self, df: pd.DataFrame, days: int = 30) -> dict:
        train_metrics = self.train(df)
        df_feat = add_technical_indicators(df)
        features = [c for c in FEATURE_COLS if c in df_feat.columns]

        # Індекси ознак для динамічного оновлення між кроками
        feat_idx = {f: i for i, f in enumerate(features)}

        last_row = df_feat[features].values[-1].copy()
        prev_prices = df_feat["close"].values[-10:].tolist()  # останні 10 цін для rolling

        predictions = []
        current_date = df.index[-1]

        for i in range(days):
            current_date += pd.Timedelta(days=1)
            while current_date.weekday() >= 5:
                current_date += pd.Timedelta(days=1)

            x_scaled = self.scaler.transform(last_row.reshape(1, -1))
            pred_price = float(self.model.predict(x_scaled)[0])
            pred_price = max(pred_price, 0.01)

            predictions.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "price": round(pred_price, 2),
            })

            # Оновлюємо price-based ознаки для наступного кроку
            prev_prices.append(pred_price)
            prev_price = prev_prices[-2]

            if "returns_1d" in feat_idx:
                last_row[feat_idx["returns_1d"]] = (pred_price - prev_price) / prev_price
            if "returns_5d" in feat_idx and len(prev_prices) >= 6:
                last_row[feat_idx["returns_5d"]] = (pred_price - prev_prices[-6]) / prev_prices[-6]
            if "returns_10d" in feat_idx and len(prev_prices) >= 11:
                last_row[feat_idx["returns_10d"]] = (pred_price - prev_prices[-11]) / prev_prices[-11]
            if "close" in feat_idx:
                last_row[feat_idx["close"]] = pred_price
            # SMA20 approx — sliding window
            if "price_vs_sma20" in feat_idx and len(prev_prices) >= 20:
                sma20 = np.mean(prev_prices[-20:])
                last_row[feat_idx["price_vs_sma20"]] = (pred_price - sma20) / sma20

        return {
            "predictions": predictions,
            "confidence_interval": None,
            "metrics": train_metrics,
        }
