from uuid import uuid4
from sqlalchemy import Column, String, Boolean, Date, Time, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    label = Column(String, nullable=True)
    is_event = Column(Boolean, default=False, nullable=False)
    due_date = Column(Date, nullable=True)
    due_time = Column(Time, nullable=True)
    location = Column(String, nullable=True)
    is_starred = Column(Boolean, default=False, nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    recurrence = Column(String, nullable=True)  # none | daily | weekly | monthly

    # Reminder fields for todos
    reminder_at = Column(DateTime(timezone=True), nullable=True)
    remind_day_before = Column(Boolean, default=False, nullable=False)

    # Notification sent tracking (todos)
    reminded_main = Column(Boolean, default=False, nullable=False)
    reminded_day_before = Column(Boolean, default=False, nullable=False)

    # Notification sent tracking (events: auto 3d, 1d, 1h before due)
    reminded_3d = Column(Boolean, default=False, nullable=False)
    reminded_1d = Column(Boolean, default=False, nullable=False)
    reminded_1h = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    subtasks = relationship("Subtask", back_populates="task", cascade="all, delete-orphan", order_by="Subtask.created_at")
    user = relationship("User", back_populates="tasks")


class Subtask(Base):
    __tablename__ = "subtasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", back_populates="subtasks")
