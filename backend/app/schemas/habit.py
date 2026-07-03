from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel


class HabitCreate(BaseModel):
    name: str
    color: Optional[str] = None


class HabitResponse(BaseModel):
    id: UUID
    name: str
    color: str
    created_at: datetime
    completed_dates: List[str] = []
    week_percentage: int = 0

    model_config = {"from_attributes": True}


class HabitToggleRequest(BaseModel):
    date: date
