from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import forecast, portfolio, sentiment, advisor

app = FastAPI(
    title="Investment AI Assistant",
    description="AI-помічник для оптимізації інвестиційних рішень",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast.router, prefix="/api/forecast", tags=["Forecast"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(sentiment.router, prefix="/api/sentiment", tags=["Sentiment"])
app.include_router(advisor.router, prefix="/api/advisor", tags=["Advisor"])


@app.get("/")
async def root():
    return {"status": "ok", "message": "Investment AI Assistant API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
