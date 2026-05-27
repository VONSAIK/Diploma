import pandas as pd
import yfinance as yf


def get_stock_data(ticker: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    """Завантажує OHLCV дані для тікера.
    interval: '1d' (денний), '1h' (погодинний), '5m', '15m', '30m'
    Погодинні дані доступні за останні 60 днів, хвилинні — 7 днів.
    """
    df = yf.download(ticker, period=period, interval=interval, auto_adjust=True, progress=False)
    if df.empty:
        raise ValueError(f"Немає даних для {ticker}")
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df.columns = df.columns.str.lower()
    df.index = pd.to_datetime(df.index).tz_localize(None)
    return df[["open", "high", "low", "close", "volume"]]


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
    df = yf.download(tickers, period=period, auto_adjust=True, progress=False)["Close"]
    if isinstance(df, pd.Series):
        df = df.to_frame(name=tickers[0])
    df.index = pd.to_datetime(df.index).tz_localize(None)
    return df.dropna()
