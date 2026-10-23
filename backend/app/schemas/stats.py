from datetime import date
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel


class PerHabit(BaseModel):
    id: UUID
    name: str
    color: str
    week_pct: int
    month_pct: int
    streak: int
    best_streak: int


class HeatCell(BaseModel):
    date: date
    done: int
    scheduled: int


class WeekPct(BaseModel):
    week_start: date
    pct: int


class HabitStats(BaseModel):
    week_pct: int
    month_pct: int
    streak_days: int
    best_streak_days: int
    perfect_days_30: int
    best_weekday: Optional[int] = None   # 0 = Monday
    worst_weekday: Optional[int] = None
    per_habit: List[PerHabit]
    heatmap: List[HeatCell]
    weekly: List[WeekPct]


class ReminderWindow(BaseModel):
    done: int
    missed: int
    pct: int


class ReminderStats(BaseModel):
    week: ReminderWindow
    month: ReminderWindow
    overdue_now: int


class ListStats(BaseModel):
    checked_week: int
    checked_month: int
    pending_items: int
    total_items: int
    lists: int
    lists_complete: int


class CycleStat(BaseModel):
    label: str
    start: date
    end: date
    income: float
    spent: float
    net: float
    is_current: bool


class CategoryStat(BaseModel):
    category: str
    amount: float
    prev_amount: float


class FinanceStats(BaseModel):
    cycles: List[CycleStat]
    spent_current: float
    spent_prev_same_point: float
    spent_vs_prev_pct: Optional[int] = None
    avg_daily_spend: float
    categories: List[CategoryStat]


class StatsResponse(BaseModel):
    habits: Optional[HabitStats] = None
    reminders: ReminderStats
    lists: ListStats
    finance: Optional[FinanceStats] = None
