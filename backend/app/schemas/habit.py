from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, field_validator


def _validate_days(v: Optional[List[int]]) -> Optional[List[int]]:
    if v is None:
        return v
    days = sorted(set(v))
    if not days or any(d < 0 or d > 6 for d in days):
        raise ValueError("days debe tener al menos un día entre 0 (lunes) y 6 (domingo)")
    return days


class HabitCreate(BaseModel):
    name: str
    color: Optional[str] = None
    days: List[int] = [0, 1, 2, 3, 4, 5, 6]

    _check_days = field_validator("days")(_validate_days)


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    days: Optional[List[int]] = None

    _check_days = field_validator("days")(_validate_days)


class HabitResponse(BaseModel):
    id: UUID
    name: str
    color: str
    created_at: datetime
    days: List[int] = [0, 1, 2, 3, 4, 5, 6]
    completed_dates: List[str] = []
    week_percentage: int = 0

    model_config = {"from_attributes": True}


class HabitToggleRequest(BaseModel):
    date: date
