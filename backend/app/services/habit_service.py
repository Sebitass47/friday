import random
from datetime import date, timedelta
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.habit import Habit, HabitLog
from app.schemas.habit import HabitCreate

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


def get_habits(db: Session, user_id: UUID, week_start: date) -> List[dict]:
    habits = db.query(Habit).filter(Habit.user_id == user_id).order_by(Habit.created_at).all()
    week = _week_dates(week_start)
    week_strs = {d.isoformat() for d in week}

    results = []
    for habit in habits:
        completed = {log.date.isoformat() for log in habit.logs if log.date.isoformat() in week_strs}
        done = len(completed)
        pct = round((done / 7) * 100)
        results.append({
            "id": habit.id,
            "name": habit.name,
            "color": habit.color,
            "created_at": habit.created_at,
            "completed_dates": list(completed),
            "week_percentage": pct,
        })
    return results


def create_habit(db: Session, data: HabitCreate, user_id: UUID) -> Habit:
    color = data.color if data.color else random.choice(HABIT_COLORS)
    habit = Habit(user_id=user_id, name=data.name, color=color)
    db.add(habit)
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

    existing = db.query(HabitLog).filter(HabitLog.habit_id == habit_id, HabitLog.date == log_date).first()
    if existing:
        db.delete(existing)
    else:
        db.add(HabitLog(habit_id=habit_id, date=log_date))
    db.commit()
    return {"toggled": True}
