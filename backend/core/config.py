from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    news_api_key: str = ""
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/investment_db"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "dev-secret-key"
    debug: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
