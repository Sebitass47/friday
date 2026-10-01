from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ListCreate(BaseModel):
    name: str = Field(..., min_length=1)
    emoji: str = "📝"


class ListUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    emoji: Optional[str] = None


class ListItemCreate(BaseModel):
    text: str = Field(..., min_length=1)


class ListItemUpdate(BaseModel):
    text: Optional[str] = Field(None, min_length=1)
    is_done: Optional[bool] = None


class ListItemResponse(BaseModel):
    id: UUID
    list_id: UUID
    text: str
    is_done: bool
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ListResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    emoji: str
    items: List[ListItemResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
