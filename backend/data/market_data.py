from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf


def get_stock_data(ticker: str, period: str = "1y") -> pd.DataFrame:
    """Завантажує OHLCV дані для тікера."""
    stock = yf.Ticker(ticker)
    df = stock.history(period=period)
    df.index = pd.to_datetime(df.index)
    df = df[["Open", "High", "Low", "Close", "Volume"]]
    df.columns = df.columns.str.lower()
    return df


def get_multiple_stocks(tickers: list[str], period: str = "1y") -> dict[str, pd.DataFrame]:
    """Завантажує дані для кількох тікерів."""
    return {ticker: get_stock_data(ticker, period) for ticker in tickers}


def get_stock_info(ticker: str) -> dict:
    """Основна інформація про компанію."""
    stock = yf.Ticker(ticker)
    info = stock.info
    return {
        "name": info.get("longName", ticker),
        "sector": info.get("sector", "N/A"),
        "market_cap": info.get("marketCap"),
        "pe_ratio": info.get("trailingPE"),
        "dividend_yield": info.get("dividendYield"),
        "52_week_high": info.get("fiftyTwoWeekHigh"),
        "52_week_low": info.get("fiftyTwoWeekLow"),
    }


def get_closing_prices(tickers: list[str], period: str = "1y") -> pd.DataFrame:
    """Матриця цін закриття для оптимізації портфеля."""
    data = yf.download(tickers, period=period, auto_adjust=True)["Close"]
    return data.dropna()
