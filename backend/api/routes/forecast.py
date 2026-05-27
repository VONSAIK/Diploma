from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from data.market_data import get_stock_data
from ml.forecasting.lstm_model import LSTMForecaster
from ml.forecasting.arima_model import ARIMAForecaster
from ml.forecasting.xgboost_model import XGBoostForecaster

router = APIRouter()

INTERVAL_PERIOD = {
    "1d": "2y",
    "1h": "60d",
}

# Скільки точок реальної історії показувати на графіку
HISTORY_POINTS = {
    "1d": 60,   # останні 60 днів
    "1h": 48,   # останні 48 годин
}


class ForecastResponse(BaseModel):
    ticker: str
    model: str
    interval: str
    history: list[dict]        # реальні минулі ціни для графіку
    predictions: list[dict]    # прогноз
    confidence_interval: list[dict] | None = None
    metrics: dict | None = None


@router.get("/{ticker}", response_model=ForecastResponse)
async def get_forecast(
    ticker: str,
    steps: int = Query(default=30, ge=1, le=168),
    model: str = Query(default="arima", pattern="^(arima|lstm|xgboost)$"),
    interval: str = Query(default="1d", pattern="^(1d|1h)$"),
):
    if interval == "1h" and model in ("lstm", "xgboost"):
        raise HTTPException(status_code=400, detail="LSTM та XGBoost підтримують лише денний інтервал (1d)")

    period = INTERVAL_PERIOD.get(interval, "2y")

    try:
        df = get_stock_data(ticker.upper(), period=period, interval=interval)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Тікер {ticker} не знайдено")

    # Реальна історія для графіку
    n_hist = HISTORY_POINTS.get(interval, 60)
    hist_df = df.tail(n_hist)
    fmt = "%Y-%m-%d %H:%M" if interval == "1h" else "%Y-%m-%d"
    history = [
        {"date": idx.strftime(fmt), "price": round(float(row["close"]), 2)}
        for idx, row in hist_df.iterrows()
    ]

    # Прогноз
    if model == "arima":
        result = ARIMAForecaster().predict(df, steps=steps, interval=interval)
    elif model == "xgboost":
        result = XGBoostForecaster().predict(df, days=steps)
    else:
        result = LSTMForecaster().predict(df, days=steps)

    return ForecastResponse(
        ticker=ticker.upper(),
        model=model,
        interval=interval,
        history=history,
        predictions=result["predictions"],
        confidence_interval=result.get("confidence_interval"),
        metrics=result.get("metrics"),
    )


@router.get("/{ticker}/compare")
async def compare_models(
    ticker: str,
    steps: int = Query(default=14, ge=1, le=30),
):
    try:
        df = get_stock_data(ticker.upper(), period="2y", interval="1d")
    except Exception:
        raise HTTPException(status_code=404, detail=f"Тікер {ticker} не знайдено")

    arima = ARIMAForecaster().predict(df, steps=steps, interval="1d")
    xgb   = XGBoostForecaster().predict(df, days=steps)

    return {
        "ticker": ticker.upper(),
        "steps": steps,
        "arima": arima["predictions"],
        "xgboost": xgb["predictions"],
        "xgboost_metrics": xgb.get("metrics"),
    }
