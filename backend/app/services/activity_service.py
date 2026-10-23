from datetime import date
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog


def log(db: Session, user_id: UUID, kind: str, resource_id: UUID, due_date: Optional[date] = None) -> None:
    """Record an event. Doesn't commit: the caller's own commit persists it with the change."""
    db.add(ActivityLog(user_id=user_id, kind=kind, resource_id=resource_id, due_date=due_date))


def unlog(db: Session, kind: str, resource_id: UUID) -> None:
    """Undo the latest entry (e.g. the user un-ticked something)."""
    latest = (
        db.query(ActivityLog)
        .filter(ActivityLog.kind == kind, ActivityLog.resource_id == resource_id)
        .order_by(ActivityLog.occurred_at.desc())
        .first()
    )
    if latest:
        db.delete(latest)
