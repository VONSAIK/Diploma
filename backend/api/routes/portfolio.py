from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from data.market_data import get_closing_prices
from ml.portfolio.optimizer import PortfolioOptimizer

router = APIRouter()


class PortfolioRequest(BaseModel):
    tickers: list[str] = Field(min_length=2, max_length=20)
    risk_tolerance: str = Field(default="medium", pattern="^(low|medium|high)$")
    portfolio_value: float = Field(default=10000.0, gt=0)


class PortfolioResponse(BaseModel):
    weights: dict[str, float]
    expected_annual_return: float
    annual_volatility: float
    sharpe_ratio: float
    allocation: dict
    leftover_cash: float
    efficient_frontier: list[dict]


@router.post("/optimize", response_model=PortfolioResponse)
async def optimize_portfolio(request: PortfolioRequest):
    tickers = [t.upper() for t in request.tickers]

    try:
        prices = get_closing_prices(tickers, period="2y")
    except Exception:
        raise HTTPException(status_code=400, detail="Не вдалося завантажити дані для тікерів")

    if prices.shape[1] < 2:
        raise HTTPException(status_code=400, detail="Потрібно мінімум 2 валідних тікери")

    optimizer = PortfolioOptimizer(prices)

    result = optimizer.optimize(request.risk_tolerance)
    alloc = optimizer.allocate(result["weights"], request.portfolio_value)
    frontier = optimizer.efficient_frontier_points()

    return PortfolioResponse(
        **result,
        allocation=alloc["allocation"],
        leftover_cash=alloc["leftover_cash"],
        efficient_frontier=frontier,
    )


@router.get("/frontier")
async def get_frontier(tickers: str):
    ticker_list = [t.strip().upper() for t in tickers.split(",")]
    if len(ticker_list) < 2:
        raise HTTPException(status_code=400, detail="Потрібно мінімум 2 тікери")

    try:
        prices = get_closing_prices(ticker_list, period="2y")
        optimizer = PortfolioOptimizer(prices)
        return {"frontier": optimizer.efficient_frontier_points()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
