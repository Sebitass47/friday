from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func

from app.models.task import Task, Subtask
from app.schemas.task import TaskCreate, TaskUpdate, SubtaskCreate, SubtaskUpdate


def get_tasks(
    db: Session,
    user_id: UUID,
    is_event: bool = False,
    label: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[Task]:
    q = (
        db.query(Task)
        .options(joinedload(Task.subtasks))
        .filter(Task.user_id == user_id, Task.is_event == is_event)
    )
    if label:
        q = q.filter(Task.label == label)
    if date_from:
        q = q.filter(Task.due_date >= date_from)
    if date_to:
        q = q.filter(Task.due_date <= date_to)
    if search:
        q = q.filter(Task.title.ilike(f"%{search}%"))
    else:
        # Only hide completed tasks when not doing a search or date range lookup
        if not date_from and not date_to:
            q = q.filter(Task.is_completed == False)
    return q.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc()).all()


def get_task(db: Session, task_id: UUID, user_id: UUID) -> Optional[Task]:
    return (
        db.query(Task)
        .options(joinedload(Task.subtasks))
        .filter(Task.id == task_id, Task.user_id == user_id)
        .first()
    )


def create_task(db: Session, data: TaskCreate, user_id: UUID) -> Task:
    task = Task(user_id=user_id, **data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return get_task(db, task.id, user_id)


def update_task(db: Session, task_id: UUID, data: TaskUpdate, user_id: UUID) -> Optional[Task]:
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if not task:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    # Reset notification flags when reminder changes
    if data.reminder_at is not None:
        task.reminded_main = False
        task.reminded_day_before = False
    if data.due_date is not None or data.due_time is not None:
        task.reminded_3d = False
        task.reminded_1d = False
        task.reminded_1h = False
    db.commit()
    db.refresh(task)
    return get_task(db, task_id, user_id)


def delete_task(db: Session, task_id: UUID, user_id: UUID) -> bool:
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if not task:
        return False
    db.delete(task)
    db.commit()
    return True


def complete_task(db: Session, task_id: UUID, user_id: UUID) -> Optional[Task]:
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if not task:
        return None
    task.is_completed = not task.is_completed
    db.commit()
    db.refresh(task)
    return get_task(db, task_id, user_id)


# ── Subtasks ─────────────────────────────────────────────────────────────────

def create_subtask(db: Session, task_id: UUID, data: SubtaskCreate, user_id: UUID) -> Optional[Subtask]:
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if not task:
        return None
    sub = Subtask(task_id=task_id, **data.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def update_subtask(db: Session, task_id: UUID, subtask_id: UUID, data: SubtaskUpdate, user_id: UUID) -> Optional[Subtask]:
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if not task:
        return None
    sub = db.query(Subtask).filter(Subtask.id == subtask_id, Subtask.task_id == task_id).first()
    if not sub:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sub, field, value)
    db.commit()
    db.refresh(sub)
    return sub


def delete_subtask(db: Session, task_id: UUID, subtask_id: UUID, user_id: UUID) -> bool:
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if not task:
        return False
    sub = db.query(Subtask).filter(Subtask.id == subtask_id, Subtask.task_id == task_id).first()
    if not sub:
        return False
    db.delete(sub)
    db.commit()
    return True


# ── Notification helpers ──────────────────────────────────────────────────────

def get_pending_todo_reminders(db: Session) -> List[Task]:
    """Tasks (not events) whose reminder_at is past but not yet notified."""
    now = datetime.now(timezone.utc)
    return (
        db.query(Task)
        .filter(
            Task.is_event == False,
            Task.is_completed == False,
            or_(
                and_(Task.reminder_at <= now, Task.reminded_main == False),
                and_(
                    Task.remind_day_before == True,
                    Task.reminder_at != None,
                    Task.reminder_at >= now,
                    Task.reminder_at <= now + timedelta(hours=25),
                    Task.reminded_day_before == False,
                ),
            ),
        )
        .all()
    )


def get_pending_event_reminders(db: Session) -> List[Task]:
    """Events whose due datetime is approaching but not yet notified at each threshold."""
    now = datetime.now(timezone.utc)
    tasks = (
        db.query(Task)
        .filter(
            Task.is_event == True,
            Task.due_date != None,
            or_(
                Task.reminded_3d == False,
                Task.reminded_1d == False,
                Task.reminded_1h == False,
            ),
        )
        .all()
    )
    result = []
    for t in tasks:
        due_dt = _event_due_dt(t)
        if due_dt and due_dt > now:
            result.append(t)
    return result


def _event_due_dt(task: Task) -> Optional[datetime]:
    import pytz
    if not task.due_date:
        return None
    tz = pytz.timezone("America/Mexico_City")
    if task.due_time:
        naive = datetime.combine(task.due_date, task.due_time)
        return tz.localize(naive).astimezone(timezone.utc)
    else:
        # All-day events: anchor to 9:00 AM Mexico City time
        local_dt = tz.localize(datetime.combine(task.due_date, time(9, 0)))
        return local_dt.astimezone(timezone.utc)
