from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal


class CreditPaymentBase(BaseModel):
    account_id: UUID = Field(..., description="ID de la tarjeta de crédito")
    amount_paid: Decimal = Field(..., description="Monto pagado")
    payment_date: date = Field(..., description="Fecha del pago")
    statement_month: int = Field(..., description="Mes del estado de cuenta (1-12)")
    statement_year: int = Field(..., description="Año del estado de cuenta")


class CreditPaymentCreate(CreditPaymentBase):
    pass


class CreditPaymentUpdate(BaseModel):
    amount_paid: Optional[Decimal] = None
    payment_date: Optional[date] = None
    statement_month: Optional[int] = None
    statement_year: Optional[int] = None


class CreditPaymentResponse(CreditPaymentBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
