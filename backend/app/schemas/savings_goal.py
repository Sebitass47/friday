from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, computed_field
import math


class SavingsGoalBase(BaseModel):
    name: str
    target_amount: Decimal
    current_amount: Decimal = Decimal("0")
    monthly_contribution: Decimal


class SavingsGoalCreate(SavingsGoalBase):
    pass


class SavingsGoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[Decimal] = None
    current_amount: Optional[Decimal] = None
    monthly_contribution: Optional[Decimal] = None


class SavingsGoalResponse(SavingsGoalBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    estimated_completion_date: Optional[date] = None

    model_config = {"from_attributes": True}
