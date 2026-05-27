from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from data.market_data import get_stock_data
from ml.forecasting.lstm_model import LSTMForecaster
from ml.forecasting.prophet_model import ProphetForecaster

router = APIRouter()


class ForecastResponse(BaseModel):
    ticker: str
    model: str
    predictions: list[dict]  # [{"date": "...", "price": ...}]
    confidence_interval: list[dict] | None = None


@router.get("/{ticker}", response_model=ForecastResponse)
async def get_forecast(
    ticker: str,
    days: int = Query(default=30, ge=1, le=90),
    model: str = Query(default="prophet", pattern="^(prophet|lstm)$"),
):
    try:
        df = get_stock_data(ticker.upper(), period="2y")
    except Exception:
        raise HTTPException(status_code=404, detail=f"Тікер {ticker} не знайдено")

    if model == "prophet":
        forecaster = ProphetForecaster()
        result = forecaster.predict(df, days=days)
    else:
        forecaster = LSTMForecaster()
        result = forecaster.predict(df, days=days)

    return ForecastResponse(
        ticker=ticker.upper(),
        model=model,
        predictions=result["predictions"],
        confidence_interval=result.get("confidence_interval"),
    )
