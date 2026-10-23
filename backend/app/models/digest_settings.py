from uuid import uuid4
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class DigestSettings(Base):
    """Per-user schedule for the weekly summary push (Sunday = week ahead, Friday = wrap-up)."""
    __tablename__ = "digest_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    enabled = Column(Boolean, nullable=False, server_default="true")
    sunday_on = Column(Boolean, nullable=False, server_default="true")
    sunday_hour = Column(Integer, nullable=False, server_default="19")
    friday_on = Column(Boolean, nullable=False, server_default="true")
    friday_hour = Column(Integer, nullable=False, server_default="8")
    # "<date>:<kind>" of the last digest sent, so a beat restart never sends it twice
    last_sent_key = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
