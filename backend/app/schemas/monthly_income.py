from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MonthlyIncomeBase(BaseModel):
    amount: Decimal


class MonthlyIncomeCreate(MonthlyIncomeBase):
    pass


class MonthlyIncomeUpdate(BaseModel):
    amount: Decimal


class MonthlyIncomeResponse(MonthlyIncomeBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
