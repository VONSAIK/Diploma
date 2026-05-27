import warnings
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA


class ARIMAForecaster:
    """ARIMA(5,1,0) — для денних і погодинних даних."""

    def predict(self, df: pd.DataFrame, steps: int = 30, interval: str = "1d") -> dict:
        prices = df["close"].values

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = ARIMA(prices, order=(5, 1, 0))
            fitted = model.fit()
            forecast_obj = fitted.get_forecast(steps=steps)
            forecast = forecast_obj.predicted_mean
            conf_int = pd.DataFrame(
                forecast_obj.conf_int(alpha=0.2),
                columns=["lower", "upper"],
            )

        predictions = []
        confidence_interval = []
        current_dt = df.index[-1]

        for i in range(steps):
            current_dt = _next_dt(current_dt, interval)
            price = round(max(float(forecast[i]), 0.01), 2)
            label = _format_dt(current_dt, interval)

            predictions.append({"date": label, "price": price})
            confidence_interval.append({
                "date": label,
                "lower": round(max(float(conf_int["lower"].iloc[i]), 0.01), 2),
                "upper": round(float(conf_int["upper"].iloc[i]), 2),
            })

        return {"predictions": predictions, "confidence_interval": confidence_interval}


def _next_dt(dt: pd.Timestamp, interval: str) -> pd.Timestamp:
    """Повертає наступний торговий момент часу залежно від інтервалу."""
    if interval == "1d":
        dt += pd.Timedelta(days=1)
        while dt.weekday() >= 5:
            dt += pd.Timedelta(days=1)
    elif interval == "1h":
        dt += pd.Timedelta(hours=1)
        # пропускаємо неторгові години (до 9:30 і після 16:00 ET) і вихідні
        while True:
            if dt.weekday() >= 5:
                dt = dt.replace(hour=9, minute=30, second=0) + pd.Timedelta(days=(7 - dt.weekday()))
                continue
            if dt.hour < 9 or (dt.hour == 9 and dt.minute < 30):
                dt = dt.replace(hour=9, minute=30, second=0)
            elif dt.hour >= 16:
                dt += pd.Timedelta(days=1)
                dt = dt.replace(hour=9, minute=30, second=0)
                while dt.weekday() >= 5:
                    dt += pd.Timedelta(days=1)
            else:
                break
    else:
        dt += pd.Timedelta(hours=1)
    return dt


def _format_dt(dt: pd.Timestamp, interval: str) -> str:
    if interval == "1d":
        return dt.strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d %H:%M")
