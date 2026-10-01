from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from typing import List
from app.schemas.share import SharedUser


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
    is_owner: bool = True
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    shared_with: List[SharedUser] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
