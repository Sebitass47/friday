from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class NoteCreate(BaseModel):
    title: str
    content: Optional[str] = None
    label: Optional[str] = None
    color: str = "default"
    is_pinned: bool = False


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None
    is_pinned: Optional[bool] = None


class NoteResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    content: Optional[str]
    label: Optional[str]
    color: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
