from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ShareIn(BaseModel):
    """Someone else's part of an expense (your part is `amount` on the expense itself)."""
    person_id: UUID
    amount: Decimal = Field(gt=0)


class ShareOut(BaseModel):
    person_id: UUID
    person_name: str
    amount: Decimal
    settled: Decimal = Decimal("0")


class InstallmentShareIn(BaseModel):
    """Someone else's part of every monthly payment of an MSI."""
    person_id: UUID
    monthly_amount: Decimal = Field(gt=0)


class InstallmentShareOut(BaseModel):
    person_id: UUID
    person_name: str
    monthly_amount: Decimal


class PersonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class PersonOut(BaseModel):
    id: UUID
    name: str
    pending_total: Decimal
    pending_count: int


class PendingDebt(BaseModel):
    id: UUID
    description: str
    amount: Decimal
    pending: Decimal
    charge_date: date
    source: str  # "expense" | "installment"
    account_name: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    date: date
    account_id: Optional[UUID] = None
    # Debts to settle first (in this order); any remainder goes to the oldest pending ones
    debt_ids: List[UUID] = []
    note: Optional[str] = None


class PaymentAllocationOut(BaseModel):
    debt_id: UUID
    description: str
    amount: Decimal


class PaymentOut(BaseModel):
    id: UUID
    person_id: UUID
    person_name: str
    amount: Decimal
    date: date
    account_id: Optional[UUID] = None
    note: Optional[str] = None
    allocated: List[PaymentAllocationOut] = []
    unallocated: Decimal = Decimal("0")


# ── Closing view ──────────────────────────────────────────────────────────────

class ClosingShare(BaseModel):
    person_id: UUID
    person_name: str
    amount: Decimal
    settled: Decimal


class ClosingCharge(BaseModel):
    kind: str  # "expense" | "installment" | "recurring"
    id: UUID
    name: str
    date: date
    mine: Decimal
    total: Decimal
    shares: List[ClosingShare] = []
    # True for recurring charges that were never logged (created before the history existed):
    # computed from the recurring expense itself
    estimated: bool = False


class ClosingPerson(BaseModel):
    person_id: UUID
    person_name: str
    owed: Decimal
    settled: Decimal
    pending: Decimal


class ClosingCard(BaseModel):
    account_id: UUID
    name: str
    closing_day: int
    payment_day: Optional[int] = None
    period_start: date
    period_end: date
    total: Decimal          # what the statement should show: yours + everyone else's
    mine: Decimal
    others: Decimal
    msi_total: Decimal
    paid: Decimal           # credit payments already registered for this statement
    real_total: Optional[Decimal] = None
    difference: Optional[Decimal] = None   # real_total - total (> 0: something is missing in FRIDAY)
    people: List[ClosingPerson] = []
    charges: List[ClosingCharge] = []


class ClosingResponse(BaseModel):
    month: int
    year: int
    label: str
    cards: List[ClosingCard]
    total: Decimal
    mine: Decimal
    others: Decimal
    to_collect: Decimal     # still pending from people for this closing
    people: List[ClosingPerson]


class StatementCheckIn(BaseModel):
    account_id: UUID
    month: int = Field(ge=1, le=12)
    year: int
    real_total: Optional[Decimal] = None
