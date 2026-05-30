from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from core.config import settings
from core.security import get_current_user, get_optional_user
from db.session import get_db
from db.models import User, AdvisorQuery

router = APIRouter()


class AdvisorRequest(BaseModel):
    portfolio: dict[str, float] = Field(description="Тікер -> вага в портфелі")
    risk_tolerance: str = Field(default="medium", pattern="^(low|medium|high)$")
    portfolio_metrics: dict = Field(default_factory=dict)
    sentiment_signals: dict[str, str] = Field(default_factory=dict)
    forecast_signals: dict[str, float] = Field(default_factory=dict)
    question: str = Field(default="", max_length=500)


class AdvisorResponse(BaseModel):
    recommendation: str
    key_insights: list[str]
    risks: list[str]
    model: str


class AdvisorHistoryItem(BaseModel):
    id: int
    portfolio_label: str
    portfolio_weights: dict
    risk_tolerance: str
    question: str
    recommendation: str
    key_insights: list[str]
    risks: list[str]
    model_used: str
    created_at: str

    model_config = {"from_attributes": True}


def _make_portfolio_label(weights: dict[str, float]) -> str:
    top = list(weights.items())[:3]
    label = ", ".join(f"{k} {v*100:.0f}%" for k, v in top)
    if len(weights) > 3:
        label += f" +{len(weights) - 3}"
    return label


@router.post("/recommend", response_model=AdvisorResponse)
async def get_recommendation(
    request: AdvisorRequest,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    if settings.gemini_api_key:
        try:
            result = await _gemini_recommend(request)
        except Exception as e:
            print(f"Gemini error: {e}")
            result = _rule_based_recommend(request)
    else:
        result = _rule_based_recommend(request)

    if current_user:
        query = AdvisorQuery(
            user_id=current_user.id,
            portfolio_label=_make_portfolio_label(request.portfolio),
            portfolio_weights=request.portfolio,
            risk_tolerance=request.risk_tolerance,
            question=request.question,
            recommendation=result.recommendation,
            key_insights=result.key_insights,
            risks=result.risks,
            model_used=result.model,
        )
        db.add(query)
        await db.commit()

    return result


@router.get("/history", response_model=list[AdvisorHistoryItem])
async def get_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdvisorQuery)
        .where(AdvisorQuery.user_id == current_user.id)
        .order_by(AdvisorQuery.created_at.desc())
        .limit(20)
    )
    queries = result.scalars().all()
    return [
        AdvisorHistoryItem(
            id=q.id,
            portfolio_label=q.portfolio_label,
            portfolio_weights=q.portfolio_weights,
            risk_tolerance=q.risk_tolerance,
            question=q.question,
            recommendation=q.recommendation,
            key_insights=q.key_insights,
            risks=q.risks,
            model_used=q.model_used,
            created_at=q.created_at.strftime("%d.%m %H:%M"),
        )
        for q in queries
    ]


@router.delete("/history/{query_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history_item(
    query_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = await db.get(AdvisorQuery, query_id)
    if not query or query.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Запис не знайдено")
    db.delete(query)
    await db.commit()


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(AdvisorQuery).where(AdvisorQuery.user_id == current_user.id)
    )
    await db.commit()


async def _gemini_recommend(request: AdvisorRequest) -> AdvisorResponse:
    from google import genai

    client = genai.Client(api_key=settings.gemini_api_key)

    portfolio_str = ", ".join(f"{k} ({v*100:.0f}%)" for k, v in request.portfolio.items())
    risk_map = {"low": "консервативний", "medium": "збалансований", "high": "агресивний"}

    prompt_parts = [
        f"Ти — AI-помічник з інвестицій. Відповідай ТІЛЬКИ українською мовою.",
        f"",
        f"ДАНІ ПОРТФЕЛЯ:",
        f"Склад: {portfolio_str}",
        f"Ризик-профіль: {risk_map.get(request.risk_tolerance, request.risk_tolerance)}",
    ]

    if request.portfolio_metrics:
        m = request.portfolio_metrics
        prompt_parts += [
            f"Очікувана річна дохідність: {float(m.get('expected_annual_return', 0))*100:.1f}%",
            f"Волатильність: {float(m.get('annual_volatility', 0))*100:.1f}%",
            f"Коефіцієнт Шарпа: {m.get('sharpe_ratio', 'N/A')}",
        ]

    if request.sentiment_signals:
        sentiment_str = ", ".join(f"{k}: {v}" for k, v in request.sentiment_signals.items())
        prompt_parts.append(f"Сентимент новин: {sentiment_str}")

    if request.forecast_signals:
        forecast_str = ", ".join(f"{k}: {v:+.1f}%" for k, v in request.forecast_signals.items())
        prompt_parts.append(f"Прогноз зміни ціни: {forecast_str}")

    if request.question:
        prompt_parts += ["", f"Питання користувача: {request.question}"]

    prompt_parts += [
        "",
        "Надай аналіз цього конкретного портфеля. Відповідай СТРОГО у такому форматі (без жодного markdown, без зірочок **):",
        "",
        "РЕКОМЕНДАЦІЯ: [один абзац з головним висновком]",
        "ІНСАЙТИ:",
        "- [конкретний інсайт про цей портфель]",
        "- [конкретний інсайт]",
        "- [конкретний інсайт]",
        "РИЗИКИ:",
        "- [конкретний ризик]",
        "- [конкретний ризик]",
    ]

    prompt = "\n".join(prompt_parts)

    for model_name in ["gemini-2.5-flash-lite", "gemini-2.5-flash"]:
        try:
            from google.genai import types as genai_types
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    max_output_tokens=1500, temperature=0.4
                ),
            )
            raw = response.text or ""
            if raw and len(raw) > 50:
                return _parse_response(raw, model_name)
        except Exception:
            continue

    raise RuntimeError("Gemini недоступний")


def _rule_based_recommend(request: AdvisorRequest) -> AdvisorResponse:
    insights, risks = [], []
    portfolio = request.portfolio
    metrics = request.portfolio_metrics
    risk = request.risk_tolerance

    n = len(portfolio)
    max_weight = max(portfolio.values()) if portfolio else 0
    heavy_ticker = max(portfolio, key=portfolio.get) if portfolio else ""

    if n < 3:
        risks.append(f"Низька диверсифікація: лише {n} активів — рекомендовано мінімум 5")
    elif n >= 5:
        insights.append(f"Хороша диверсифікація: {n} активів у портфелі")

    if max_weight > 0.5:
        risks.append(f"Висока концентрація в {heavy_ticker}: {max_weight*100:.0f}% — рекомендовано ≤40%")
    elif max_weight <= 0.3:
        insights.append("Рівномірний розподіл ваг — мінімізує концентраційний ризик")

    if metrics:
        ret = float(metrics.get("expected_annual_return", 0))
        vol = float(metrics.get("annual_volatility", 0))
        sharpe = float(metrics.get("sharpe_ratio", 0))

        if ret > 0.20:
            insights.append(f"Висока очікувана дохідність: {ret*100:.1f}% річних")
        elif ret > 0.08:
            insights.append(f"Помірна дохідність: {ret*100:.1f}% річних")

        if sharpe > 1.5:
            insights.append(f"Відмінний Sharpe Ratio {sharpe:.2f} — ефективний баланс дохідності та ризику")
        elif sharpe < 0.5:
            risks.append(f"Низький Sharpe Ratio {sharpe:.2f} — дохідність не компенсує ризик")

        if risk == "low" and vol > 0.15:
            risks.append(f"Волатильність {vol*100:.1f}% завелика для консервативного профілю (норма ≤15%)")
        elif risk == "high" and vol < 0.10:
            insights.append("Стабільний портфель навіть при агресивному профілі")

    for ticker, signal in request.sentiment_signals.items():
        if signal == "negative":
            risks.append(f"Негативний новинний фон по {ticker} — можливий короткостроковий тиск на ціну")
        elif signal == "positive":
            insights.append(f"Позитивний медіасентимент по {ticker}")

    for ticker, change_pct in request.forecast_signals.items():
        if change_pct > 5:
            insights.append(f"{ticker}: ML-прогноз зростання +{change_pct:.1f}% за 30 днів")
        elif change_pct < -5:
            risks.append(f"{ticker}: ML-прогноз падіння {change_pct:.1f}% за 30 днів")

    if not insights:
        insights.append("Переглядайте склад портфеля щоквартально")
    if not risks:
        risks.append("Тримайте 3-6 місяців витрат у готівці як запасний фонд")

    n_risks = len(risks)
    if n_risks == 0:
        rec = "Портфель виглядає збалансовано відповідно до вашого ризик-профілю. Дотримуйтесь поточної стратегії."
    elif n_risks <= 2:
        rec = "Портфель загалом в порядку, але є зони для покращення. Зверніть увагу на виявлені ризики."
    else:
        rec = f"Виявлено {n_risks} зони ризику. Рекомендується перебалансування портфеля."

    return AdvisorResponse(
        recommendation=rec, key_insights=insights[:5], risks=risks[:5], model="rule-based"
    )


def _parse_response(text: str, model: str) -> AdvisorResponse:
    import re

    clean = re.sub(r'\*+', '', text)
    clean = re.sub(r'#+\s*', '', clean)
    clean = re.sub(r'_{2,}', '', clean)

    recommendation, insights, risks = "", [], []
    section = None

    for line in clean.splitlines():
        line = line.strip()
        if not line:
            continue

        if re.match(r'РЕКОМЕНДАЦ[ІI]Я\s*:', line, re.IGNORECASE):
            recommendation = re.sub(r'РЕКОМЕНДАЦ[ІI]Я\s*:\s*', '', line, flags=re.IGNORECASE).strip()
            section = "rec"
        elif re.match(r'[ІI]НСАЙТИ\s*:', line, re.IGNORECASE):
            section = "insights"
        elif re.match(r'РИЗИКИ\s*:', line, re.IGNORECASE):
            section = "risks"
        elif re.match(r'^[-•–]\s+', line):
            item = re.sub(r'^[-•–]\s+', '', line).strip()
            if item:
                if section == "insights":
                    insights.append(item)
                elif section == "risks":
                    risks.append(item)
        elif section == "rec":
            recommendation = (recommendation + " " + line).strip()

    if not recommendation:
        paragraphs = [p.strip() for p in clean.split('\n\n') if p.strip()]
        recommendation = paragraphs[0] if paragraphs else clean[:600]

    if not insights and not risks:
        bullets = re.findall(r'^[-•–]\s+(.+)', clean, re.MULTILINE)
        mid = len(bullets) // 2
        insights = bullets[:mid] or bullets
        risks = bullets[mid:] if mid else []

    return AdvisorResponse(
        recommendation=recommendation,
        key_insights=insights[:5],
        risks=risks[:5],
        model=model,
    )
