from pathlib import Path
from pydantic_settings import BaseSettings

# .env лежить в корені проекту, на рівень вище від backend/
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    gemini_api_key: str = ""
    news_api_key: str = ""
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/investment_db"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "dev-secret-key"
    debug: bool = True

    model_config = {"env_file": str(ENV_FILE), "extra": "ignore"}


settings = Settings()
