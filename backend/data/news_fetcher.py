from datetime import datetime, timedelta

import requests

from core.config import settings


def fetch_news(ticker: str, company_name: str = "", days_back: int = 7) -> list[dict]:
    """Завантажує новини через NewsAPI."""
    if not settings.news_api_key:
        return []

    query = company_name if company_name else ticker
    from_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")

    url = "https://newsapi.org/v2/everything"
    params = {
        "q": query,
        "from": from_date,
        "sortBy": "relevancy",
        "language": "en",
        "pageSize": 20,
        "apiKey": settings.news_api_key,
    }

    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()

    articles = resp.json().get("articles", [])
    return [
        {
            "title": a["title"],
            "description": a.get("description", ""),
            "url": a["url"],
            "published_at": a["publishedAt"],
            "source": a["source"]["name"],
        }
        for a in articles
        if a.get("title")
    ]
