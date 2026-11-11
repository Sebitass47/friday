from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(..., max_length=600)


class AssistantMessage(BaseModel):
    text: str = Field(..., min_length=1, max_length=600)
    # last few turns, so a clarifying question ("¿con cuál tarjeta?") can be answered
    history: List[ChatTurn] = Field(default_factory=list, max_length=6)


class AssistantAction(BaseModel):
    type: str
    args: Dict[str, Any]
    title: str = ""
    lines: List[str] = []


class AssistantReply(BaseModel):
    reply: str = ""
    actions: List[AssistantAction] = []
    # actions the model proposed that failed validation (shown as a note, never executed)
    notes: List[str] = []


class ConfirmRequest(BaseModel):
    actions: List[AssistantAction] = Field(..., min_length=1, max_length=10)


class ConfirmResult(BaseModel):
    done: List[str]
    failed: List[str]


class UsageOut(BaseModel):
    spent_usd: float
    limit_usd: float
    calls: int
    available: bool
