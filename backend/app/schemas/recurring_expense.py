from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator
from app.models.recurring_expense import ExpenseFrequency


class RecurringExpenseBase(BaseModel):
    name: str
    amount: Decimal
    frequency: ExpenseFrequency = ExpenseFrequency.MONTHLY
    interval_days: Optional[int] = None

    @field_validator("interval_days")
    @classmethod
    def interval_days_required_for_custom(cls, v: Optional[int], info) -> Optional[int]:
        freq = info.data.get("frequency")
        if freq == ExpenseFrequency.CUSTOM and (v is None or v <= 0):
            raise ValueError("interval_days es requerido y debe ser mayor a 0 cuando la frecuencia es CUSTOM")
        return v


class RecurringExpenseCreate(RecurringExpenseBase):
    pass


class RecurringExpenseUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    frequency: Optional[ExpenseFrequency] = None
    interval_days: Optional[int] = None


class RecurringExpenseResponse(RecurringExpenseBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
