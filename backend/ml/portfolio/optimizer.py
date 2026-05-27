import numpy as np
import pandas as pd
from pypfopt import EfficientFrontier, expected_returns, risk_models
from pypfopt.discrete_allocation import DiscreteAllocation, get_latest_prices


RISK_PROFILES = {
    "low": {"target_volatility": 0.10},
    "medium": {"target_return": None},   # max Sharpe
    "high": {"target_return": None},     # max return
}


class PortfolioOptimizer:
    def __init__(self, prices: pd.DataFrame):
        self.prices = prices
        self.mu = expected_returns.mean_historical_return(prices)
        self.S = risk_models.sample_cov(prices)

    def optimize(self, risk_tolerance: str = "medium") -> dict:
        ef = EfficientFrontier(self.mu, self.S)

        if risk_tolerance == "low":
            ef.min_volatility()
        elif risk_tolerance == "high":
            ef.max_quadratic_utility(risk_aversion=0.5)
        else:
            ef.max_sharpe()

        weights = ef.clean_weights()
        perf = ef.portfolio_performance(verbose=False)

        return {
            "weights": {k: round(v, 4) for k, v in weights.items() if v > 0.001},
            "expected_annual_return": round(perf[0], 4),
            "annual_volatility": round(perf[1], 4),
            "sharpe_ratio": round(perf[2], 4),
        }

    def allocate(self, weights: dict, total_portfolio_value: float) -> dict:
        latest_prices = get_latest_prices(self.prices)
        da = DiscreteAllocation(weights, latest_prices, total_portfolio_value=total_portfolio_value)
        allocation, leftover = da.greedy_portfolio()
        return {
            "allocation": allocation,
            "leftover_cash": round(leftover, 2),
        }

    def efficient_frontier_points(self, n_points: int = 50) -> list[dict]:
        """Точки для графіку ефективної границі."""
        returns_range = np.linspace(self.mu.min(), self.mu.max() * 0.95, n_points)
        frontier = []
        for target in returns_range:
            try:
                ef = EfficientFrontier(self.mu, self.S)
                ef.efficient_return(target)
                perf = ef.portfolio_performance(verbose=False)
                frontier.append({
                    "volatility": round(perf[1], 4),
                    "return": round(perf[0], 4),
                    "sharpe": round(perf[2], 4),
                })
            except Exception:
                continue
        return frontier
