from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal


class IncomeBase(BaseModel):
    model_config = {"populate_by_name": True}

    description: str = Field(..., description="Descripción del ingreso")
    amount: Decimal = Field(..., description="Monto del ingreso")
    income_date: date = Field(..., description="Fecha del ingreso", alias="date")
    category: Optional[str] = Field(None, description="Categoría del ingreso")
    account_id: Optional[UUID] = Field(None, description="Cuenta donde se recibe el ingreso")


class IncomeCreate(IncomeBase):
    pass


class IncomeUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[Decimal] = None
    income_date: Optional[date] = Field(None, alias="date")
    category: Optional[str] = None
    account_id: Optional[UUID] = None


class IncomeResponse(IncomeBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
