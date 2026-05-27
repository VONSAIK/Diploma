import warnings
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA


class ARIMAForecaster:
    """ARIMA(5,1,0) — базова модель для прогнозу цін."""

    def predict(self, df: pd.DataFrame, days: int = 30) -> dict:
        prices = df["close"].values

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = ARIMA(prices, order=(5, 1, 0))
            fitted = model.fit()
            forecast_obj = fitted.get_forecast(steps=days)
            forecast = forecast_obj.predicted_mean
            conf_int = pd.DataFrame(
                forecast_obj.conf_int(alpha=0.2),
                columns=["lower", "upper"],
            )

        predictions = []
        confidence_interval = []
        current_date = df.index[-1]

        for i in range(days):
            # просуваємось на 1 робочий день
            current_date += pd.Timedelta(days=1)
            while current_date.weekday() >= 5:
                current_date += pd.Timedelta(days=1)

            price = round(max(float(forecast[i]), 0.01), 2)
            predictions.append({"date": current_date.strftime("%Y-%m-%d"), "price": price})
            confidence_interval.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "lower": round(max(float(conf_int["lower"].iloc[i]), 0.01), 2),
                "upper": round(float(conf_int["upper"].iloc[i]), 2),
            })

        return {"predictions": predictions, "confidence_interval": confidence_interval}
