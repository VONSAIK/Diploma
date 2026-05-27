from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import anthropic

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
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY не налаштовано")

    prompt = _build_prompt(request)

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=(
            "Ти — AI-помічник з інвестицій. Аналізуй дані портфеля та надавай "
            "конкретні, обґрунтовані рекомендації. Відповідай українською мовою. "
            "Будь конкретним і чітким. Не давай фінансових порад, що вимагають ліцензії."
        ),
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text
    return _parse_response(raw, message.model)


def _build_prompt(req: AdvisorRequest) -> str:
    parts = [
        f"Профіль ризику: {req.risk_tolerance}",
        f"\nПоточний портфель (тікер -> вага):\n{_format_dict(req.portfolio)}",
    ]

    if req.portfolio_metrics:
        m = req.portfolio_metrics
        parts.append(
            f"\nМетрики портфеля:\n"
            f"- Очікувана річна дохідність: {m.get('expected_annual_return', 'N/A')}\n"
            f"- Волатильність: {m.get('annual_volatility', 'N/A')}\n"
            f"- Коефіцієнт Шарпа: {m.get('sharpe_ratio', 'N/A')}"
        )

    if req.sentiment_signals:
        parts.append(f"\nСентимент новин:\n{_format_dict(req.sentiment_signals)}")

    if req.forecast_signals:
        parts.append(f"\nПрогнозована зміна ціни (30 днів, %):\n{_format_dict(req.forecast_signals)}")

    if req.question:
        parts.append(f"\nПитання від користувача: {req.question}")

    parts.append(
        "\nНадай відповідь у форматі:\n"
        "РЕКОМЕНДАЦІЯ: [загальний висновок]\n"
        "ІНСАЙТИ:\n- [пункт 1]\n- [пункт 2]\n- [пункт 3]\n"
        "РИЗИКИ:\n- [ризик 1]\n- [ризик 2]"
    )

    return "\n".join(parts)


def _format_dict(d: dict) -> str:
    return "\n".join(f"  {k}: {v}" for k, v in d.items())


def _parse_response(text: str, model: str) -> AdvisorResponse:
    recommendation = ""
    insights = []
    risks = []

    section = None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("РЕКОМЕНДАЦІЯ:"):
            recommendation = line.replace("РЕКОМЕНДАЦІЯ:", "").strip()
        elif line.startswith("ІНСАЙТИ:"):
            section = "insights"
        elif line.startswith("РИЗИКИ:"):
            section = "risks"
        elif line.startswith("- "):
            item = line[2:].strip()
            if section == "insights":
                insights.append(item)
            elif section == "risks":
                risks.append(item)

    return AdvisorResponse(
        recommendation=recommendation or text[:300],
        key_insights=insights,
        risks=risks,
        model=model,
    )
