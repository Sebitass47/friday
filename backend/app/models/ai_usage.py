from uuid import uuid4
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class AiUsage(Base):
    """What the assistant has cost a user in a given month ('YYYY-MM'); drives the monthly spending cap."""
    __tablename__ = "ai_usage"
    __table_args__ = (UniqueConstraint("user_id", "period", name="uq_ai_usage_user_period"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period = Column(String(7), nullable=False)
    cost_usd = Column(Numeric(12, 6), nullable=False, server_default="0")
    calls = Column(Integer, nullable=False, server_default="0")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
