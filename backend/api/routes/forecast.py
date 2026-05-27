from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from data.market_data import get_stock_data
from ml.forecasting.lstm_model import LSTMForecaster
from ml.forecasting.arima_model import ARIMAForecaster
from ml.forecasting.xgboost_model import XGBoostForecaster

router = APIRouter()


class ForecastResponse(BaseModel):
    ticker: str
    model: str
    predictions: list[dict]
    confidence_interval: list[dict] | None = None
    metrics: dict | None = None


@router.get("/{ticker}", response_model=ForecastResponse)
async def get_forecast(
    ticker: str,
    days: int = Query(default=30, ge=1, le=90),
    model: str = Query(default="arima", pattern="^(arima|lstm|xgboost)$"),
):
    try:
        df = get_stock_data(ticker.upper(), period="2y")
    except Exception:
        raise HTTPException(status_code=404, detail=f"Тікер {ticker} не знайдено")

    if model == "arima":
        result = ARIMAForecaster().predict(df, days=days)
    elif model == "xgboost":
        result = XGBoostForecaster().predict(df, days=days)
    else:
        result = LSTMForecaster().predict(df, days=days)

    return ForecastResponse(
        ticker=ticker.upper(),
        model=model,
        predictions=result["predictions"],
        confidence_interval=result.get("confidence_interval"),
        metrics=result.get("metrics"),
    )


@router.get("/{ticker}/compare")
async def compare_models(
    ticker: str,
    days: int = Query(default=14, ge=1, le=30),
):
    """Порівнює ARIMA та XGBoost прогнози для одного тікера."""
    try:
        df = get_stock_data(ticker.upper(), period="2y")
    except Exception:
        raise HTTPException(status_code=404, detail=f"Тікер {ticker} не знайдено")

    arima  = ARIMAForecaster().predict(df, days=days)
    xgb    = XGBoostForecaster().predict(df, days=days)

    return {
        "ticker": ticker.upper(),
        "days": days,
        "arima": arima["predictions"],
        "xgboost": xgb["predictions"],
        "xgboost_metrics": xgb.get("metrics"),
    }
