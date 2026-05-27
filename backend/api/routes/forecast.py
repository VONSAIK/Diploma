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


class ForecastResponse(BaseModel):
    ticker: str
    model: str
    interval: str
    predictions: list[dict]
    confidence_interval: list[dict] | None = None
    metrics: dict | None = None


@router.get("/{ticker}", response_model=ForecastResponse)
async def get_forecast(
    ticker: str,
    steps: int = Query(default=30, ge=1, le=168, description="Кількість кроків (днів або годин)"),
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
        predictions=result["predictions"],
        confidence_interval=result.get("confidence_interval"),
        metrics=result.get("metrics"),
    )


@router.get("/{ticker}/compare")
async def compare_models(
    ticker: str,
    steps: int = Query(default=14, ge=1, le=30),
):
    """Порівнює ARIMA та XGBoost прогнози."""
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
