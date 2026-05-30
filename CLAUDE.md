# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

**Backend** (FastAPI, port 8000):
```bash
source venv/bin/activate
cd backend
uvicorn main:app --reload --port 8000
```

**Frontend** (Vite + React, port 3000):
```bash
cd frontend
npm run dev
```

Vite proxies all `/api/*` requests to `http://localhost:8000`, so the frontend never calls the backend directly — always through the proxy.

**Environment**: `.env` lives at the repo root (not inside `backend/`). `core/config.py` resolves the path two levels up from itself. Required vars: `GEMINI_API_KEY`, `NEWS_API_KEY`, `DATABASE_URL`, `SECRET_KEY`.

## Architecture

### Backend (`backend/`)

FastAPI app in `main.py` with four routers mounted under `/api`:

| Route prefix | File | Responsibility |
|---|---|---|
| `/api/forecast` | `api/routes/forecast.py` | ML price forecasting |
| `/api/portfolio` | `api/routes/portfolio.py` | Markowitz portfolio optimization |
| `/api/sentiment` | `api/routes/sentiment.py` | News sentiment via FinBERT |
| `/api/advisor` | `api/routes/advisor.py` | Gemini 2.5 Flash AI recommendations |

**ML layer** (`ml/`):
- `ml/forecasting/` — three forecasters with a common interface: each has a `.predict(df, ...)` method that returns `{"predictions": [...], "confidence_interval": [...], "metrics": {...}}`. Models: `ARIMAForecaster` (ARIMA 5,1,0), `XGBoostForecaster` (18 technical indicators, CV-validated), `LSTMForecaster`.
- `ml/portfolio/optimizer.py` — wraps `pypfopt`. `PortfolioOptimizer` takes a price DataFrame, exposes `.optimize(risk_tolerance)`, `.allocate(weights, value)`, and `.efficient_frontier_points()`.
- `ml/sentiment/` — FinBERT-based sentiment analyzer.

**Data layer** (`data/`):
- `market_data.py` — `get_stock_data(ticker, period, interval)` fetches OHLCV via `yfinance`, normalises MultiIndex columns to lowercase, strips timezone.
- `news_fetcher.py` — fetches articles via NewsAPI.

**Database**: PostgreSQL via `asyncpg`. Connection string in `DATABASE_URL`. The `db/` module is not yet fully implemented — this is where auth models and portfolio persistence will live.

### Frontend (`frontend/src/`)

React + TypeScript + Tailwind. Four pages, no global state manager — each page manages its own state.

**Data flow pattern**: every async operation uses the `useAsync<T>()` hook (`hooks/useAsync.ts`), which holds `{ data, loading, error }` and exposes a `run(promise)` function. All API calls go through `services/api.ts` (axios instance with `baseURL: '/api'`).

**Pages**:
- `ForecastPage` — auto-fetches on parameter change (700ms debounce for ticker); `chartKey` state triggers CSS `fadeInUp` animation on new data.
- `PortfolioPage` — calls `portfolioApi.optimize()`; renders Markowitz frontier as `ScatterChart`.
- `SentimentPage` — news sentiment for a single ticker.
- `AdvisorPage` — sends portfolio weights + metrics to Gemini via `/api/advisor/recommend`. Currently uses a manually typed portfolio string, not connected to PortfolioPage results.

**UI components** (`components/ui/`): `Card`, `Spinner`, `Badge`, `AssetSelector` (single), `MultiAssetSelector` (multi-select with preset baskets).

**Assets list**: `data/assets.ts` — the canonical list of 50+ supported tickers with labels and categories.

## Key design decisions

- **No Redux / Zustand** — state is local per page. If cross-page state is needed (e.g. passing optimized portfolio to AdvisorPage), use React Context or `localStorage`.
- **Forecaster interface**: all three forecasters accept a raw `pd.DataFrame` with columns `[open, high, low, close, volume]` and a DatetimeIndex (no timezone). Always normalise data through `get_stock_data()` before passing to forecasters.
- **ARIMA** runs on hourly data too; XGBoost and LSTM require at least ~100 data points for technical indicators.
- **Gemini integration** is in `api/routes/advisor.py` — uses `google-generativeai` SDK, model `gemini-2.5-flash`. Fallback text parsing handles cases where the model returns plain text instead of JSON.
