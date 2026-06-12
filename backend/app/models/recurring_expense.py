from uuid import uuid4
from enum import Enum
from sqlalchemy import Column, String, Numeric, Integer, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class ExpenseFrequency(str, Enum):
    MONTHLY = "monthly"
    WEEKLY = "weekly"
    CUSTOM = "custom"


class RecurringExpense(Base):
    __tablename__ = "recurring_expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    frequency = Column(SQLEnum(ExpenseFrequency), nullable=False, default=ExpenseFrequency.MONTHLY)
    interval_days = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="recurring_expenses")
