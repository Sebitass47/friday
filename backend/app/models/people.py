from uuid import uuid4
from sqlalchemy import (
    Column, String, Numeric, Integer, Date, DateTime, ForeignKey, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class Person(Base):
    """Someone you lend your card to / split bills with. A plain name, no FRIDAY account needed."""
    __tablename__ = "people"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_people_user", "user_id"),)


class InstallmentShare(Base):
    """A person's slice of every monthly payment of an MSI purchase (monthly_amount is *your* slice)."""
    __tablename__ = "installment_shares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    installment_id = Column(UUID(as_uuid=True), ForeignKey("installment_purchases.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    monthly_amount = Column(Numeric(12, 2), nullable=False)

    __table_args__ = (UniqueConstraint("installment_id", "person_id", name="uq_installment_share_person"),)


class PersonDebt(Base):
    """One thing a person owes you: their part of an expense, or of one MSI month."""
    __tablename__ = "person_debts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    settled_amount = Column(Numeric(12, 2), nullable=False, server_default="0")
    charge_date = Column(Date, nullable=False)
    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=True)
    installment_id = Column(UUID(as_uuid=True), ForeignKey("installment_purchases.id", ondelete="CASCADE"), nullable=True)
    installment_index = Column(Integer, nullable=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    statement_month = Column(Integer, nullable=True)
    statement_year = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_debts_user_person", "user_id", "person_id"),
        Index("ix_debts_statement", "account_id", "statement_year", "statement_month"),
    )


class PersonPayment(Base):
    """Money someone paid you back. Deliberately NOT an Income: it settles a debt, it isn't new money."""
    __tablename__ = "person_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    date = Column(Date, nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PaymentAllocation(Base):
    """How much of a payment went to which debt (so deleting a payment can undo it)."""
    __tablename__ = "payment_allocations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("person_payments.id", ondelete="CASCADE"), nullable=False)
    debt_id = Column(UUID(as_uuid=True), ForeignKey("person_debts.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)


class StatementCheck(Base):
    """The total the bank's statement actually shows, to spot charges you forgot to register."""
    __tablename__ = "statement_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    statement_month = Column(Integer, nullable=False)
    statement_year = Column(Integer, nullable=False)
    real_total = Column(Numeric(12, 2), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("account_id", "statement_year", "statement_month", name="uq_statement_check"),
    )
