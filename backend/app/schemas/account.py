from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum

class AccountType(str, Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    CREDIT_CARD = "credit_card"

class AccountCreate(BaseModel):
    name: str = Field(..., description="Nombre de la cuenta")
    account_type: AccountType = Field(..., description="Tipo de cuenta")
    balance: Optional[float] = Field(None, description="Saldo actual", ge=0)
    currency: Optional[str] = Field("MXN", description="Moneda")
    credit_limit: Optional[float] = Field(None, description="Límite de crédito", ge=0)
    closing_day: Optional[int] = Field(None, description="Día de cierre", ge=1, le=31)
    payment_day: Optional[int] = Field(None, description="Día de pago", ge=1, le=31)

class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Nombre de la cuenta")
    account_type: Optional[AccountType] = Field(None, description="Tipo de cuenta")
    balance: Optional[float] = Field(None, description="Saldo actual", ge=0)
    currency: Optional[str] = Field(None, description="Moneda")
    is_active: Optional[bool] = Field(None, description="Estado activo")
    credit_limit: Optional[float] = Field(None, description="Límite de crédito", ge=0)
    closing_day: Optional[int] = Field(None, description="Día de cierre", ge=1, le=31)
    payment_day: Optional[int] = Field(None, description="Día de pago", ge=1, le=31)

class AccountResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    account_type: AccountType
    balance: float
    currency: str
    is_active: bool
    credit_limit: Optional[float] = None
    closing_day: Optional[int] = None
    payment_day: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True