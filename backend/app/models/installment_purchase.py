from uuid import uuid4
from sqlalchemy import Column, String, Numeric, Integer, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class InstallmentPurchase(Base):
    __tablename__ = "installment_purchases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    monthly_amount = Column(Numeric(12, 2), nullable=False)
    total_installments = Column(Integer, nullable=False)
    remaining_installments = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    payment_day = Column(Integer, nullable=True)
    closing_day = Column(Integer, nullable=True)
    paid_month = Column(Integer, nullable=True)
    paid_year = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="installment_purchases")
    account = relationship("Account", foreign_keys=[account_id])
