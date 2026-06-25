from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from app.models.enums import PaymentMethod


class ExpenseBase(BaseModel):
    model_config = {"populate_by_name": True}

    account_id: Optional[UUID] = Field(None, description="ID de la cuenta/tarjeta")
    name: str = Field(..., description="Descripción del gasto")
    amount: Decimal = Field(..., description="Monto gastado")
    expense_date: date = Field(..., description="Fecha del gasto", alias="date")
    payment_method: PaymentMethod = Field(..., description="Método de pago")
    category: Optional[str] = Field(None, description="Categoría del gasto")


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    account_id: Optional[UUID] = None
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    expense_date: Optional[date] = Field(None, alias="date")
    payment_method: Optional[PaymentMethod] = None
    category: Optional[str] = None


class ExpenseResponse(ExpenseBase):
    id: UUID
    user_id: UUID
    credit_statement_month: Optional[int] = None
    credit_statement_year: Optional[int] = None
    paid: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
