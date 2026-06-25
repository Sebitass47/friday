from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class MonthlyIncomeBase(BaseModel):
    amount: Decimal
    income_start_day: int = Field(default=1, ge=1, le=28)


class MonthlyIncomeCreate(MonthlyIncomeBase):
    pass


class MonthlyIncomeUpdate(BaseModel):
    amount: Decimal
    income_start_day: int = Field(default=1, ge=1, le=28)


class MonthlyIncomeResponse(MonthlyIncomeBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
