from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from app.models.enums import PaymentMethod
from app.schemas.people import ShareIn, ShareOut


class ExpenseBase(BaseModel):
    model_config = {"populate_by_name": True}

    account_id: Optional[UUID] = Field(None, description="ID de la cuenta/tarjeta")
    name: str = Field(..., description="Descripción del gasto")
    amount: Decimal = Field(..., description="Monto gastado")
    expense_date: date = Field(..., description="Fecha del gasto", alias="date")
    payment_method: PaymentMethod = Field(..., description="Método de pago")
    category: Optional[str] = Field(None, description="Categoría del gasto")


class ExpenseCreate(ExpenseBase):
    # `amount` is YOUR part; these are other people's parts (the card is charged amount + shares)
    shares: List[ShareIn] = []


class ExpenseUpdate(BaseModel):
    account_id: Optional[UUID] = None
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    expense_date: Optional[date] = Field(None, alias="date")
    payment_method: Optional[PaymentMethod] = None
    category: Optional[str] = None
    # None = leave the split as it is; a list (even empty) replaces it
    shares: Optional[List[ShareIn]] = None


class ExpenseResponse(ExpenseBase):
    id: UUID
    user_id: UUID
    credit_statement_month: Optional[int] = None
    credit_statement_year: Optional[int] = None
    paid: bool
    # What the bank is actually charged (your part + everyone else's); `amount` stays your part
    total_amount: Optional[Decimal] = None
    shares: List[ShareOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
