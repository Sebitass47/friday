from uuid import UUID
from decimal import Decimal
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class InstallmentPurchaseBase(BaseModel):
    name: str
    total_amount: Decimal
    monthly_amount: Decimal
    total_installments: int
    remaining_installments: int
    start_date: date

    @field_validator("total_installments", "remaining_installments")
    @classmethod
    def must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Debe ser mayor a 0")
        return v

    @field_validator("remaining_installments")
    @classmethod
    def remaining_lte_total(cls, v: int, info) -> int:
        total = info.data.get("total_installments")
        if total is not None and v > total:
            raise ValueError("remaining_installments no puede ser mayor que total_installments")
        return v


class InstallmentPurchaseCreate(InstallmentPurchaseBase):
    pass


class InstallmentPurchaseUpdate(BaseModel):
    name: Optional[str] = None
    total_amount: Optional[Decimal] = None
    monthly_amount: Optional[Decimal] = None
    total_installments: Optional[int] = None
    remaining_installments: Optional[int] = None
    start_date: Optional[date] = None


class InstallmentPurchaseResponse(InstallmentPurchaseBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
