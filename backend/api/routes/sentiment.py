import asyncio
from fastapi import APIRouter, HTTPException, Query

from data.news_fetcher import fetch_news
from data.market_data import get_stock_info
from ml.sentiment.finbert_analyzer import SentimentAnalyzer

router = APIRouter()
analyzer = SentimentAnalyzer()


@router.get("/{ticker}")
async def get_sentiment(
    ticker: str,
    days: int = Query(default=7, ge=1, le=30),
):
    ticker = ticker.upper()

    try:
        info = get_stock_info(ticker)
        company_name = info.get("name", ticker)
    except Exception:
        company_name = ticker

    news = fetch_news(ticker, company_name, days_back=days)
    if not news:
        return {
            "ticker": ticker,
            "company": company_name,
            "signal": "neutral",
            "score": 0.0,
            "count": 0,
            "breakdown": {"positive": 0, "negative": 0, "neutral": 0},
            "articles": [],
            "note": "Новини не знайдено або NEWS_API_KEY не налаштовано",
        }

    texts = [f"{a['title']}. {a.get('description', '')}" for a in news]
    analyses = await asyncio.to_thread(analyzer.analyze, texts)
    summary = analyzer.aggregate(analyses)

    enriched = [
        {**article, "sentiment": analysis["sentiment"], "confidence": analysis["confidence"]}
        for article, analysis in zip(news, analyses)
    ]

    return {
        "ticker": ticker,
        "company": company_name,
        **summary,
        "articles": enriched[:10],
    }
