#!/usr/bin/env python3
"""
Скрипт попереднього навчання XGBoost моделей для прогнозу акцій.

Для кожного тікера:
  1. Завантажує 5 років денних даних через yfinance
  2. Будує 23 технічні індикатори (SMA, EMA, MACD, RSI, BB, ATR, OBV, VWAP тощо)
  3. Тренує XGBoost з TimeSeriesSplit(5-fold) крос-валідацією
  4. Зберігає навчену модель + scaler у ml/forecasting/trained_models/<TICKER>.pkl
  5. Виводить метрики та зберігає JSON-звіт

Запуск:
  cd backend
  python train.py                              # усі ~65 тікерів (≈40-60 хв)
  python train.py --tickers AAPL MSFT BTC-USD  # конкретні тікери
  python train.py --period 2y                  # коротший датасет (швидше)
  python train.py --only-new                   # тільки тікери без збереженої моделі
"""
import sys
import os
import json
import time
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

import numpy as np
from data.market_data import get_stock_data
from ml.forecasting.xgboost_model import XGBoostForecaster, MODELS_DIR

# Повний список тікерів — відповідає assets.ts (крім індексів ^GSPC/^IXIC/^DJI,
# для яких XGBoost не має практичного сенсу)
DEFAULT_TICKERS = [
    # Технології
    "AAPL", "MSFT", "GOOGL", "NVDA", "META", "AMZN", "TSLA", "AMD", "INTC",
    "CRM", "ORCL", "ADBE", "NFLX", "SHOP", "UBER", "PLTR", "RBLX", "SNOW", "CRWD",
    # Фінанси
    "JPM", "BAC", "GS", "V", "MA", "BRK-B", "WFC", "MS", "COIN", "HOOD",
    # Охорона здоров'я
    "JNJ", "PFE", "UNH", "ABBV", "MRK",
    # Енергетика
    "XOM", "CVX", "NEE", "COP",
    # Споживчі товари
    "KO", "PEP", "PG", "WMT", "MCD", "NKE",
    # Міжнародні
    "ASML", "SAP", "TSM", "BABA", "NVO", "TM", "SONY",
    # ETF
    "SPY", "QQQ", "VTI", "GLD", "SLV", "USO", "TLT", "VNQ", "EEM", "DBA",
    # Крипто
    "BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD",
    "ADA-USD", "DOGE-USD", "AVAX-USD", "DOT-USD", "LINK-USD",
]


def train_ticker(ticker: str, period: str) -> dict | None:
    """Тренує XGBoost для одного тікера. Повертає метрики або None при помилці."""
    try:
        df = get_stock_data(ticker, period=period, interval="1d")
        if len(df) < 200:
            print(f"недостатньо даних ({len(df)} точок), пропускаємо")
            return None

        model = XGBoostForecaster()
        metrics = model.train(df)

        model_path = os.path.join(MODELS_DIR, f"{ticker}.pkl")
        model.save(model_path)

        return {
            "ticker": ticker,
            "data_points": len(df),
            "cv_mape": metrics["cv_mape"],
            "cv_rmse": metrics["cv_rmse"],
            "cv_mae":  metrics["cv_mae"],
            "top_features": list(metrics["feature_importance"].keys())[:5],
            "feature_importance": metrics["feature_importance"],
        }
    except Exception as e:
        print(f"помилка: {e}")
        return None


def print_summary(results: list[dict], total: int, elapsed: float) -> None:
    if not results:
        return

    mapes = [r["cv_mape"] for r in results]
    rmses = [r["cv_rmse"] for r in results]

    print(f"\n{'═'*68}")
    print(f"  ПІДСУМОК НАВЧАННЯ")
    print(f"{'═'*68}")
    print(f"  Успішно навчено:    {len(results)}/{total} тікерів")
    print(f"  Загальний час:      {elapsed:.0f} сек ({elapsed/60:.1f} хв)")
    print(f"  Середній CV MAPE:   {np.mean(mapes):.2f}%")
    print(f"  Середній CV RMSE:   ${np.mean(rmses):.2f}")
    print()

    best  = min(results, key=lambda r: r["cv_mape"])
    worst = max(results, key=lambda r: r["cv_mape"])
    print(f"  Найкраща модель:    {best['ticker']:<10} CV MAPE = {best['cv_mape']:.2f}%")
    print(f"  Найгірша модель:    {worst['ticker']:<10} CV MAPE = {worst['cv_mape']:.2f}%")

    print(f"\n  {'Тікер':<10} {'Точок':>6}  {'CV MAPE':>8}  {'CV RMSE':>8}  {'CV MAE':>8}  Топ-3 ознаки")
    print(f"  {'-'*9} {'-'*6}  {'-'*8}  {'-'*8}  {'-'*8}  {'-'*30}")
    for r in sorted(results, key=lambda r: r["cv_mape"]):
        top3 = ", ".join(r["top_features"][:3])
        print(f"  {r['ticker']:<10} {r['data_points']:>6}  {r['cv_mape']:>7.2f}%  ${r['cv_rmse']:>7.2f}  ${r['cv_mae']:>7.2f}  {top3}")

    print(f"{'═'*68}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Навчання XGBoost моделей прогнозування цін акцій",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--tickers", nargs="+", default=DEFAULT_TICKERS, metavar="TICKER",
        help="Список тікерів (за замовчуванням: усі ~65 активів)",
    )
    parser.add_argument(
        "--period", default="5y", choices=["2y", "5y", "10y"],
        help="Період навчальних даних (за замовчуванням: 5y)",
    )
    parser.add_argument(
        "--only-new", action="store_true",
        help="Тренувати тільки тікери без збереженої моделі (пропустити вже навчені)",
    )
    args = parser.parse_args()

    os.makedirs(MODELS_DIR, exist_ok=True)

    tickers = args.tickers
    if args.only_new:
        tickers = [t for t in tickers if not os.path.exists(os.path.join(MODELS_DIR, f"{t}.pkl"))]
        print(f"  --only-new: {len(args.tickers) - len(tickers)} вже навчені, пропускаємо")

    print(f"\n{'═'*68}")
    print(f"  XGBoost Training  |  Investment AI Assistant")
    print(f"{'═'*68}")
    print(f"  Тікерів до навчання: {len(tickers)}")
    print(f"  Період даних:        {args.period}")
    print(f"  Директорія моделей:  {MODELS_DIR}")
    print(f"  Початок:             {datetime.now().strftime('%H:%M:%S')}")
    print(f"{'═'*68}\n")

    results = []
    total = len(tickers)
    start_time = time.time()

    for i, ticker in enumerate(tickers, 1):
        prefix = f"  [{i:2d}/{total}] {ticker:<10}"
        print(f"{prefix} ", end="", flush=True)
        t0 = time.time()
        result = train_ticker(ticker, args.period)
        elapsed_t = time.time() - t0

        if result:
            results.append(result)
            print(
                f"✓  MAPE {result['cv_mape']:5.2f}%  "
                f"RMSE ${result['cv_rmse']:6.2f}  "
                f"MAE ${result['cv_mae']:6.2f}  "
                f"({elapsed_t:.1f}s)"
            )
        else:
            print(f"✗  ({elapsed_t:.1f}s)")

    total_time = time.time() - start_time
    print_summary(results, total, total_time)

    # Зберігаємо JSON-звіт для диплому
    report = {
        "trained_at": datetime.now().isoformat(),
        "period": args.period,
        "total_tickers": total,
        "successful": len(results),
        "avg_cv_mape": round(float(np.mean([r["cv_mape"] for r in results])), 2) if results else None,
        "avg_cv_rmse": round(float(np.mean([r["cv_rmse"] for r in results])), 2) if results else None,
        "results": sorted(results, key=lambda r: r["cv_mape"]),
    }
    report_path = os.path.join(MODELS_DIR, "training_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"  Звіт збережено: {report_path}")
    print(f"  Моделі збережені у: {MODELS_DIR}/\n")


if __name__ == "__main__":
    main()
