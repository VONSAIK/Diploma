from fastapi import APIRouter
from pydantic import BaseModel, Field

from core.config import settings

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


@router.post("/recommend", response_model=AdvisorResponse)
async def get_recommendation(request: AdvisorRequest):
    if settings.gemini_api_key:
        try:
            return await _gemini_recommend(request)
        except Exception:
            pass
    return _rule_based_recommend(request)


async def _gemini_recommend(request: AdvisorRequest) -> AdvisorResponse:
    from google import genai

    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = _build_prompt(request)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={
            "system_instruction": (
                "Ти — AI-помічник з інвестицій. Аналізуй дані портфеля та надавай "
                "конкретні, обґрунтовані рекомендації. Відповідай українською мовою."
            ),
            "max_output_tokens": 1024,
            "temperature": 0.7,
        },
    )
    return _parse_response(response.text or "", "gemini-2.5-flash")


def _rule_based_recommend(request: AdvisorRequest) -> AdvisorResponse:
    """Аналітичний fallback без зовнішнього API."""
    insights = []
    risks = []
    portfolio = request.portfolio
    metrics = request.portfolio_metrics
    risk = request.risk_tolerance

    # Диверсифікація
    n = len(portfolio)
    max_weight = max(portfolio.values()) if portfolio else 0
    if n < 3:
        risks.append(f"Низька диверсифікація: лише {n} активів у портфелі")
    elif n >= 5:
        insights.append(f"Хороша диверсифікація: {n} активів")

    if max_weight > 0.5:
        heavy = max(portfolio, key=portfolio.get)
        risks.append(f"Концентрація в {heavy}: {max_weight*100:.0f}% портфеля — рекомендовано ≤50%")

    # Метрики
    if metrics:
        ret = metrics.get("expected_annual_return", 0)
        vol = metrics.get("annual_volatility", 0)
        sharpe = metrics.get("sharpe_ratio", 0)

        if ret > 0.15:
            insights.append(f"Висока очікувана дохідність: {ret*100:.1f}% річних")
        elif ret > 0:
            insights.append(f"Помірна очікувана дохідність: {ret*100:.1f}% річних")

        if sharpe > 2.0:
            insights.append(f"Відмінний Sharpe Ratio: {sharpe:.2f} — ефективне співвідношення дохід/ризик")
        elif sharpe < 0.5:
            risks.append(f"Низький Sharpe Ratio: {sharpe:.2f} — портфель не компенсує ризик")

        if risk == "low" and vol > 0.20:
            risks.append(f"Волатильність {vol*100:.1f}% висока для консервативного профілю")

    # Sentiment
    for ticker, signal in request.sentiment_signals.items():
        if signal == "negative":
            risks.append(f"Негативний новинний фон по {ticker}")
        elif signal == "positive":
            insights.append(f"Позитивний сентимент новин по {ticker}")

    # Forecast
    for ticker, change_pct in request.forecast_signals.items():
        if change_pct > 5:
            insights.append(f"{ticker}: прогноз зростання +{change_pct:.1f}% за 30 днів")
        elif change_pct < -5:
            risks.append(f"{ticker}: прогноз падіння {change_pct:.1f}% за 30 днів")

    # Рекомендація
    n_risks = len(risks)
    if n_risks == 0:
        rec = "Портфель виглядає збалансовано. Продовжуйте поточну стратегію та переглядайте склад щоквартально."
    elif n_risks <= 2:
        rec = "Портфель потребує незначного коригування. Зверніть увагу на виявлені ризики."
    else:
        rec = "Виявлено кілька зон ризику. Рекомендується перебалансування портфеля відповідно до вашого профілю."

    if not insights:
        insights.append("Регулярно переглядайте склад портфеля (раз на квартал)")
    if not risks:
        risks.append("Ринковий ризик завжди присутній — тримайте 3-6 місяців витрат у готівці")

    return AdvisorResponse(
        recommendation=rec,
        key_insights=insights,
        risks=risks,
        model="rule-based",
    )


def _build_prompt(req: AdvisorRequest) -> str:
    parts = [
        f"Профіль ризику: {req.risk_tolerance}",
        f"\nПортфель:\n{_format_dict(req.portfolio)}",
    ]
    if req.portfolio_metrics:
        m = req.portfolio_metrics
        parts.append(
            f"\nМетрики: дохідність={m.get('expected_annual_return','N/A')}, "
            f"волатильність={m.get('annual_volatility','N/A')}, "
            f"Sharpe={m.get('sharpe_ratio','N/A')}"
        )
    if req.sentiment_signals:
        parts.append(f"\nСентимент: {_format_dict(req.sentiment_signals)}")
    if req.forecast_signals:
        parts.append(f"\nПрогноз зміни (%): {_format_dict(req.forecast_signals)}")
    if req.question:
        parts.append(f"\nПитання: {req.question}")
    parts.append(
        "\nФормат відповіді:\n"
        "РЕКОМЕНДАЦІЯ: [висновок]\n"
        "ІНСАЙТИ:\n- [пункт]\nРИЗИКИ:\n- [пункт]"
    )
    return "\n".join(parts)


def _format_dict(d: dict) -> str:
    return ", ".join(f"{k}: {v}" for k, v in d.items())


def _strip_md(text: str) -> str:
    """Видаляє markdown форматування з тексту."""
    import re
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)   # **bold**
    text = re.sub(r'\*(.+?)\*', r'\1', text)         # *italic*
    text = re.sub(r'#{1,3}\s*', '', text)             # ## заголовки
    return text.strip()


def _parse_response(text: str, model: str) -> AdvisorResponse:
    import re
    clean = _strip_md(text)
    recommendation, insights, risks = "", [], []
    section = None

    for line in clean.splitlines():
        line = line.strip()
        if not line:
            continue
        if re.search(r'РЕКОМЕНДАЦ[ІI]Я\s*:', line, re.IGNORECASE):
            recommendation = re.sub(r'РЕКОМЕНДАЦ[ІI]Я\s*:', '', line, flags=re.IGNORECASE).strip()
            section = None
        elif re.search(r'[ІI]НСАЙТИ\s*:', line, re.IGNORECASE):
            section = "insights"
        elif re.search(r'РИЗИКИ\s*:', line, re.IGNORECASE):
            section = "risks"
        elif line.startswith(('- ', '• ', '* ')):
            item = line[2:].strip()
            if section == "insights":
                insights.append(item)
            elif section == "risks":
                risks.append(item)
        elif section == "insights" and line and not line.endswith(':'):
            insights.append(line)
        elif section == "risks" and line and not line.endswith(':'):
            risks.append(line)

    # Fallback — якщо парсинг не спрацював, беремо весь текст як рекомендацію
    if not recommendation:
        # Перший абзац як рекомендація
        paragraphs = [p.strip() for p in clean.split('\n\n') if p.strip()]
        recommendation = paragraphs[0] if paragraphs else clean[:500]

    return AdvisorResponse(
        recommendation=recommendation,
        key_insights=insights[:5],
        risks=risks[:5],
        model=model,
    )
