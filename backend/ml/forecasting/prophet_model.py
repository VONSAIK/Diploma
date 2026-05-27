import pandas as pd
from prophet import Prophet


class ProphetForecaster:
    def __init__(self):
        self.model = Prophet(
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=True,
            changepoint_prior_scale=0.05,
        )

    def predict(self, df: pd.DataFrame, days: int = 30) -> dict:
        train = df[["close"]].reset_index()
        train.columns = ["ds", "y"]
        train["ds"] = train["ds"].dt.tz_localize(None)

        self.model.fit(train)

        future = self.model.make_future_dataframe(periods=days)
        forecast = self.model.predict(future)

        last_date = train["ds"].max()
        future_forecast = forecast[forecast["ds"] > last_date]

        predictions = [
            {"date": row["ds"].strftime("%Y-%m-%d"), "price": round(row["yhat"], 2)}
            for _, row in future_forecast.iterrows()
        ]

        confidence_interval = [
            {
                "date": row["ds"].strftime("%Y-%m-%d"),
                "lower": round(row["yhat_lower"], 2),
                "upper": round(row["yhat_upper"], 2),
            }
            for _, row in future_forecast.iterrows()
        ]

        return {"predictions": predictions, "confidence_interval": confidence_interval}
