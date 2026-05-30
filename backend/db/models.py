from datetime import datetime
from sqlalchemy import String, Float, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    portfolios: Mapped[list["Portfolio"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    advisor_queries: Mapped[list["AdvisorQuery"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    tickers: Mapped[list] = mapped_column(JSON, nullable=False)
    risk_tolerance: Mapped[str] = mapped_column(String(10), nullable=False)
    portfolio_value: Mapped[float] = mapped_column(Float, nullable=False)
    weights: Mapped[dict] = mapped_column(JSON, nullable=True)
    metrics: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="portfolios")


class AdvisorQuery(Base):
    __tablename__ = "advisor_queries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    portfolio_label: Mapped[str] = mapped_column(String(200), nullable=False)
    portfolio_weights: Mapped[dict] = mapped_column(JSON, nullable=False)
    risk_tolerance: Mapped[str] = mapped_column(String(10), nullable=False)
    question: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    key_insights: Mapped[list] = mapped_column(JSON, nullable=False)
    risks: Mapped[list] = mapped_column(JSON, nullable=False)
    model_used: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="advisor_queries")
