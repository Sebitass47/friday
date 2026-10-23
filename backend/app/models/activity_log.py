from uuid import uuid4
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base

TASK_DONE = "task_done"
TASK_MISSED = "task_missed"
LIST_ITEM_DONE = "list_item_done"


class ActivityLog(Base):
    """Append-only history of things that can't be derived from current state
    (a completed recurring reminder, a checked list item that was later cleared…).
    Feeds the statistics page."""
    __tablename__ = "activity_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind = Column(String, nullable=False)
    # Task or list-item id; deliberately not a FK so history survives deletions
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    due_date = Column(Date, nullable=True)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("ix_activity_user_kind_at", "user_id", "kind", "occurred_at"),)
