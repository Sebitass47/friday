import random
from datetime import date, timedelta
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.habit import Habit, HabitLog
from app.schemas.habit import HabitCreate, HabitUpdate

HABIT_COLORS = [
    "#6B46E5",  # FRIDAY purple
    "#22c55e",  # green
    "#3b82f6",  # blue
    "#ec4899",  # pink
    "#f59e0b",  # amber
    "#06b6d4",  # cyan
    "#f43f5e",  # rose
    "#8b5cf6",  # violet
    "#10b981",  # emerald
    "#f97316",  # orange
]


def _week_dates(week_start: date) -> List[date]:
    return [week_start + timedelta(days=i) for i in range(7)]


def parse_days(raw: Optional[str]) -> List[int]:
    days = sorted({int(x) for x in (raw or "").split(",") if x.strip().isdigit() and 0 <= int(x) <= 6})
    return days or list(range(7))


def format_days(days: List[int]) -> str:
    return ",".join(str(d) for d in sorted(set(days)))


def habit_week_dict(habit: Habit, week_start: date) -> dict:
    """Serialize a habit for a given week; progress only counts the days it applies to."""
    days = parse_days(habit.days_of_week)
    scheduled = {d.isoformat() for d in _week_dates(week_start) if d.weekday() in days}
    completed = {log.date.isoformat() for log in habit.logs if log.date.isoformat() in scheduled}
    pct = round(len(completed) / len(scheduled) * 100) if scheduled else 0
    return {
        "id": habit.id,
        "name": habit.name,
        "color": habit.color,
        "created_at": habit.created_at,
        "days": days,
        "completed_dates": list(completed),
        "week_percentage": pct,
    }


def get_habits(db: Session, user_id: UUID, week_start: date) -> List[dict]:
    habits = db.query(Habit).filter(Habit.user_id == user_id).order_by(Habit.created_at).all()
    return [habit_week_dict(h, week_start) for h in habits]


def create_habit(db: Session, data: HabitCreate, user_id: UUID) -> Habit:
    color = data.color if data.color else random.choice(HABIT_COLORS)
    habit = Habit(user_id=user_id, name=data.name, color=color, days_of_week=format_days(data.days))
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


def update_habit(db: Session, habit_id: UUID, data: HabitUpdate, user_id: UUID) -> Optional[Habit]:
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        return None
    if data.name is not None and data.name.strip():
        habit.name = data.name.strip()
    if data.days is not None:
        habit.days_of_week = format_days(data.days)
    db.commit()
    db.refresh(habit)
    return habit


def delete_habit(db: Session, habit_id: UUID, user_id: UUID) -> bool:
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        return False
    db.delete(habit)
    db.commit()
    return True


def toggle_log(db: Session, habit_id: UUID, log_date: date, user_id: UUID) -> Optional[dict]:
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        return None
    if log_date.weekday() not in parse_days(habit.days_of_week):
        raise ValueError("Este hábito no aplica ese día de la semana")

    existing = db.query(HabitLog).filter(HabitLog.habit_id == habit_id, HabitLog.date == log_date).first()
    if existing:
        db.delete(existing)
    else:
        db.add(HabitLog(habit_id=habit_id, date=log_date))
    db.commit()
    return {"toggled": True}
