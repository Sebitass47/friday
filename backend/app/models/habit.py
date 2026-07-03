from uuid import uuid4
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Habit(Base):
    __tablename__ = "habits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, server_default="#6B46E5")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="habits")
    logs = relationship("HabitLog", back_populates="habit", cascade="all, delete-orphan")


class HabitLog(Base):
    __tablename__ = "habit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    habit_id = Column(UUID(as_uuid=True), ForeignKey("habits.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    habit = relationship("Habit", back_populates="logs")

    __table_args__ = (UniqueConstraint("habit_id", "date", name="uq_habit_log_date"),)
