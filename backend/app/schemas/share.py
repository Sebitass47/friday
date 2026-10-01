from typing import List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel


class SharedUser(BaseModel):
    id: UUID
    email: str
    name: str

    model_config = {"from_attributes": True}


class LookupRequest(BaseModel):
    email: str


class ShareRequest(BaseModel):
    resource_type: Literal["task", "list"]
    resource_id: UUID
    email: str


class ShareResponse(BaseModel):
    shared_with: List[SharedUser]
