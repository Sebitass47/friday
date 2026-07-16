from datetime import date, time, datetime, timezone
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, field_validator
from zoneinfo import ZoneInfo

_MX = ZoneInfo("America/Mexico_City")


def _localize_reminder(v):
    """If reminder_at arrives as a naive datetime, treat it as Mexico City local time."""
    if v is None:
        return v
    if isinstance(v, str):
        v = datetime.fromisoformat(v)
    if isinstance(v, datetime) and v.tzinfo is None:
        v = v.replace(tzinfo=_MX)
    return v


class SubtaskCreate(BaseModel):
    title: str


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None


class SubtaskResponse(BaseModel):
    id: UUID
    task_id: UUID
    title: str
    is_completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    label: Optional[str] = None
    is_event: bool = False
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    location: Optional[str] = None
    is_starred: bool = False
    recurrence: Optional[str] = None
    reminder_at: Optional[datetime] = None
    remind_day_before: bool = False

    @field_validator("reminder_at", mode="before")
    @classmethod
    def localize_reminder(cls, v):
        return _localize_reminder(v)


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    label: Optional[str] = None
    is_event: Optional[bool] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    location: Optional[str] = None
    is_starred: Optional[bool] = None
    is_completed: Optional[bool] = None
    recurrence: Optional[str] = None
    reminder_at: Optional[datetime] = None
    remind_day_before: Optional[bool] = None

    @field_validator("reminder_at", mode="before")
    @classmethod
    def localize_reminder(cls, v):
        return _localize_reminder(v)


class TaskResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    notes: Optional[str]
    label: Optional[str]
    is_event: bool
    due_date: Optional[date]
    due_time: Optional[time]
    location: Optional[str]
    is_starred: bool
    is_completed: bool
    recurrence: Optional[str]
    reminder_at: Optional[datetime]
    remind_day_before: bool
    subtasks: List[SubtaskResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
