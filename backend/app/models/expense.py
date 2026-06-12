from uuid import UUID, uuid4
from datetime import date, datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, Date, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.enums import PaymentMethod


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    account_id = Column(PG_UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    name = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    date = Column(Date, nullable=False)
    payment_method = Column(SQLEnum(PaymentMethod, values_callable=lambda x: [e.value for e in x]), nullable=False)
    category = Column(String, nullable=True)

    # For credit card tracking
    credit_statement_month = Column(Integer, nullable=True)
    credit_statement_year = Column(Integer, nullable=True)
    paid = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    account = relationship("Account", back_populates="expenses")
    user = relationship("User", back_populates="expenses")
