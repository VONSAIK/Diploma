from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.session import get_db
from db.models import User, Portfolio
from core.security import get_current_user

router = APIRouter()


class SavePortfolioRequest(BaseModel):
    name: str
    tickers: list[str]
    risk_tolerance: str
    portfolio_value: float
    weights: dict | None = None
    metrics: dict | None = None


class PortfolioOut(BaseModel):
    id: int
    name: str
    tickers: list[str]
    risk_tolerance: str
    portfolio_value: float
    weights: dict | None
    metrics: dict | None
    created_at: str

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[PortfolioOut])
async def list_portfolios(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Portfolio)
        .where(Portfolio.user_id == current_user.id)
        .order_by(Portfolio.created_at.desc())
    )
    portfolios = result.scalars().all()
    return [
        PortfolioOut(
            id=p.id,
            name=p.name,
            tickers=p.tickers,
            risk_tolerance=p.risk_tolerance,
            portfolio_value=p.portfolio_value,
            weights=p.weights,
            metrics=p.metrics,
            created_at=p.created_at.isoformat(),
        )
        for p in portfolios
    ]


@router.post("/", response_model=PortfolioOut, status_code=status.HTTP_201_CREATED)
async def save_portfolio(
    body: SavePortfolioRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = Portfolio(
        user_id=current_user.id,
        name=body.name,
        tickers=body.tickers,
        risk_tolerance=body.risk_tolerance,
        portfolio_value=body.portfolio_value,
        weights=body.weights,
        metrics=body.metrics,
    )
    db.add(portfolio)
    await db.commit()
    await db.refresh(portfolio)
    return PortfolioOut(
        id=portfolio.id,
        name=portfolio.name,
        tickers=portfolio.tickers,
        risk_tolerance=portfolio.risk_tolerance,
        portfolio_value=portfolio.portfolio_value,
        weights=portfolio.weights,
        metrics=portfolio.metrics,
        created_at=portfolio.created_at.isoformat(),
    )


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await db.get(Portfolio, portfolio_id)
    if not portfolio or portfolio.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Портфель не знайдено")
    await db.delete(portfolio)
    await db.commit()
