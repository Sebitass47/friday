from uuid import UUID, uuid4
from enum import Enum
from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class AccountType(str, Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    CREDIT_CARD = "credit_card"

class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    account_type = Column(SQLEnum(AccountType), nullable=False)
    balance = Column(Numeric(12, 2), default=0)
    currency = Column(String, default="MXN")
    is_active = Column(Boolean, default=True)
    credit_limit = Column(Numeric(12, 2), nullable=True)
    closing_day = Column(Integer, nullable=True)
    payment_day = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="accounts")