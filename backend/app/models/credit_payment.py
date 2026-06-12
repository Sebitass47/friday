from uuid import UUID, uuid4
from datetime import date, datetime
from sqlalchemy import Column, Numeric, Integer, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class CreditPayment(Base):
    __tablename__ = "credit_payments"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    account_id = Column(PG_UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    statement_month = Column(Integer, nullable=False)
    statement_year = Column(Integer, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    account = relationship("Account", back_populates="credit_payments")
    user = relationship("User", back_populates="credit_payments")
