from typing import Optional
import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    accounts = relationship("Account", back_populates="user")
    recurring_expenses = relationship("RecurringExpense", back_populates="user")
    installment_purchases = relationship("InstallmentPurchase", back_populates="user")
    savings_goals = relationship("SavingsGoal", back_populates="user")
    monthly_income = relationship("MonthlyIncome", back_populates="user", uselist=False)
