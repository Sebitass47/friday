from uuid import uuid4
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base

# Resources that can be shared
RESOURCE_TASK = "task"   # reminders and events (events are tasks with is_event)
RESOURCE_LIST = "list"
RESOURCE_NOTE = "note"


class Share(Base):
    """An item (reminder/event/list) shared by its owner with another user."""
    __tablename__ = "shares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    resource_type = Column(String, nullable=False)
    resource_id = Column(UUID(as_uuid=True), nullable=False)  # polymorphic, no FK
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shared_with_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("resource_type", "resource_id", "shared_with_id", name="uq_share_resource_user"),
    )


class Contact(Base):
    """People a user has shared with before, so they can be picked without retyping the email."""
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    contact_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("owner_id", "contact_user_id", name="uq_contact_owner_user"),)
