from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import numpy as np

from data.market_data import get_stock_data
from ml.forecasting.lstm_model import LSTMForecaster
from ml.forecasting.xgboost_model import XGBoostForecaster
from ml.forecasting.prophet_model import ProphetForecaster

router = APIRouter()

INTERVAL_PERIOD = {
    "1d": "2y",
    "1h": "60d",
}

HISTORY_POINTS = {
    "1d": 250,   # ~1 рік торгових днів
    "1h": 72,
}


class OHLCVPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class ForecastResponse(BaseModel):
    ticker: str
    model: str
    interval: str
    history: list[OHLCVPoint]
    predictions: list[dict]
    confidence_interval: list[dict] | None = None
    metrics: dict | None = None


def _row_to_ohlcv(idx, row, fmt: str) -> dict:
    return {
        "date":   idx.strftime(fmt),
        "open":   round(float(row["open"]),  2),
        "high":   round(float(row["high"]),  2),
        "low":    round(float(row["low"]),   2),
        "close":  round(float(row["close"]), 2),
        "volume": int(row["volume"]) if "volume" in row.index else 0,
    }


@router.get("/{ticker}/live")
async def get_live_price(
    ticker: str,
    interval: str = Query(default="1d", pattern="^(1d|1h)$"),
):
    period = "5d" if interval == "1d" else "1d"
    try:
        df = get_stock_data(ticker.upper(), period=period, interval=interval)
        if df.empty:
            raise ValueError("No data")
        fmt      = "%Y-%m-%d %H:%M" if interval == "1h" else "%Y-%m-%d"
        last_row = df.iloc[-1]
        return _row_to_ohlcv(df.index[-1], last_row, fmt)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Тікер {ticker} не знайдено")


@router.get("/{ticker}", response_model=ForecastResponse)
async def get_forecast(
    ticker: str,
    steps: int    = Query(default=30, ge=1, le=168),
    model: str    = Query(default="xgboost", pattern="^(lstm|xgboost|prophet)$"),
    interval: str = Query(default="1d", pattern="^(1d|1h)$"),
):
    # Prophet не підтримує погодинний інтервал — повертаємося на xgboost
    if model == "prophet" and interval == "1h":
        model = "xgboost"

    period = INTERVAL_PERIOD.get(interval, "2y")

    try:
        df = get_stock_data(ticker.upper(), period=period, interval=interval)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Тікер {ticker} не знайдено")

    n_hist = HISTORY_POINTS.get(interval, 250)
    hist_df = df.tail(n_hist)
    fmt = "%Y-%m-%d %H:%M" if interval == "1h" else "%Y-%m-%d"

    history = [
        _row_to_ohlcv(idx, row, fmt)
        for idx, row in hist_df.iterrows()
    ]

    if model == "xgboost":
        result = XGBoostForecaster().predict(df, days=steps, ticker=ticker.upper())
    elif model == "lstm":
        result = LSTMForecaster().predict(df, days=steps, ticker=ticker.upper())
    else:
        result = ProphetForecaster().predict(df, days=steps)

    predictions = [
        p for p in result["predictions"]
        if isinstance(p.get("price"), (int, float))
        and np.isfinite(p["price"])
        and 0 < p["price"] < 1e9
    ]
    if not predictions:
        raise HTTPException(status_code=500, detail="Модель повернула некоректні прогнози")

    return ForecastResponse(
        ticker=ticker.upper(),
        model=model,
        interval=interval,
        history=history,
        predictions=predictions,
        confidence_interval=result.get("confidence_interval"),
        metrics=result.get("metrics"),
    )
