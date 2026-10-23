"""Numbers for the statistics page and the home 'progress' strip.
Everything is derived from existing tables plus activity_log (history of completions)."""
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Set
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.clock import APP_TZ, today_local
from app.models.activity_log import ActivityLog, TASK_DONE, TASK_MISSED, LIST_ITEM_DONE
from app.models.enums import PaymentMethod
from app.models.expense import Expense
from app.models.habit import Habit
from app.models.monthly_income import MonthlyIncome
from app.models.task import Task
from app.models.user_list import UserList, ListItem
from app.services import user_list_service
from app.services.habit_service import parse_days
from app.services.projection_service import (
    _current_cycle_start, _cycle_date, _prev_month, _next_cycle_start, _cycle_label,
    _monthly_income_counts, _extra_income_for_cycle,
)

HEATMAP_WEEKS = 12
HISTORY_DAYS = 180
# Not "spending" in the usual sense: money moved around, or a debt already counted last cycle
EXCLUDED_CATEGORIES = ("Transferencia", "Deuda")


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _pct(done: int, total: int) -> int:
    return round(done / total * 100) if total else 0


def _start_dt(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=APP_TZ)


# ── Habits ────────────────────────────────────────────────────────────────────

def _habit_start(habit: Habit, logs: Set[date], today: date) -> date:
    created = habit.created_at.astimezone(APP_TZ).date() if habit.created_at else today
    return min([created, *logs]) if logs else created


def _scheduled(habit_days: List[int], start: date, d: date, today: date) -> bool:
    return start <= d <= today and d.weekday() in habit_days


def habit_stats(db: Session, user_id: UUID, today: date) -> Optional[dict]:
    habits = db.query(Habit).options(joinedload(Habit.logs)).filter(Habit.user_id == user_id).order_by(Habit.created_at).all()
    if not habits:
        return None

    horizon = today - timedelta(days=HISTORY_DAYS)
    info = []
    for h in habits:
        logs = {l.date for l in h.logs}
        info.append((h, parse_days(h.days_of_week), logs, _habit_start(h, logs, today)))

    def totals(frm: date, to: date):
        done = sched = 0
        for _h, days, logs, start in info:
            d = max(frm, start)
            while d <= to:
                if _scheduled(days, start, d, today):
                    sched += 1
                    done += d in logs
                d += timedelta(days=1)
        return done, sched

    week_start = _monday(today)
    wd, ws = totals(week_start, today)
    md, ms = totals(today - timedelta(days=29), today)

    per_habit = []
    for h, days, logs, start in info:
        def pct_range(frm: date) -> int:
            d, done, sched = max(frm, start), 0, 0
            while d <= today:
                if _scheduled(days, start, d, today):
                    sched += 1
                    done += d in logs
                d += timedelta(days=1)
            return _pct(done, sched)

        streak = 0
        d = today
        while d >= max(start, horizon):
            if d.weekday() in days:
                if d in logs:
                    streak += 1
                elif d != today:
                    break
            d -= timedelta(days=1)

        best = run = 0
        d = max(start, horizon)
        while d <= today:
            if d.weekday() in days:
                run = run + 1 if d in logs else 0
                best = max(best, run)
            d += timedelta(days=1)

        per_habit.append({
            "id": h.id, "name": h.name, "color": h.color,
            "week_pct": pct_range(week_start), "month_pct": pct_range(today - timedelta(days=29)),
            "streak": streak, "best_streak": best,
        })

    # One aggregated cell per day for the heatmap (Mon-aligned, last 12 weeks incl. this one)
    first = week_start - timedelta(weeks=HEATMAP_WEEKS - 1)
    heatmap = []
    d = first
    while d <= week_start + timedelta(days=6):
        done = sched = 0
        if d <= today:
            for _h, days, logs, start in info:
                if _scheduled(days, start, d, today):
                    sched += 1
                    done += d in logs
        heatmap.append({"date": d, "done": done, "scheduled": sched})
        d += timedelta(days=1)

    # Overall streak: consecutive days with at least one habit done (today may still be pending)
    any_done: Set[date] = set()
    for _h, _days, logs, _start in info:
        any_done |= {l for l in logs if l >= horizon}
    streak_days, d = 0, today
    while d >= horizon:
        if d in any_done:
            streak_days += 1
        elif d != today:
            break
        d -= timedelta(days=1)
    best_days = run = 0
    d = horizon
    while d <= today:
        run = run + 1 if d in any_done else 0
        best_days = max(best_days, run)
        d += timedelta(days=1)

    perfect = 0
    d = today - timedelta(days=29)
    while d <= today:
        s = sum(1 for _h, days, logs, start in info if _scheduled(days, start, d, today))
        k = sum(1 for _h, days, logs, start in info if _scheduled(days, start, d, today) and d in logs)
        perfect += 1 if s and s == k else 0
        d += timedelta(days=1)

    weekly = []
    for i in range(7, -1, -1):
        ws_ = week_start - timedelta(weeks=i)
        done, sched = totals(ws_, min(ws_ + timedelta(days=6), today))
        weekly.append({"week_start": ws_, "pct": _pct(done, sched)})

    # Best / worst weekday over the last 90 days
    by_wd = defaultdict(lambda: [0, 0])
    d = today - timedelta(days=89)
    while d <= today:
        for _h, days, logs, start in info:
            if _scheduled(days, start, d, today):
                by_wd[d.weekday()][1] += 1
                by_wd[d.weekday()][0] += d in logs
        d += timedelta(days=1)
    ranked = sorted(((_pct(a, b), wd_) for wd_, (a, b) in by_wd.items() if b), reverse=True)

    return {
        "week_pct": _pct(wd, ws), "month_pct": _pct(md, ms),
        "streak_days": streak_days, "best_streak_days": best_days, "perfect_days_30": perfect,
        "best_weekday": ranked[0][1] if ranked else None,
        "worst_weekday": ranked[-1][1] if len(ranked) > 1 else None,
        "per_habit": per_habit, "heatmap": heatmap, "weekly": weekly,
    }


# ── Reminders & lists ─────────────────────────────────────────────────────────

def _activity_count(db: Session, user_id: UUID, kind: str, frm: date) -> int:
    return db.query(func.count(ActivityLog.id)).filter(
        ActivityLog.user_id == user_id, ActivityLog.kind == kind, ActivityLog.occurred_at >= _start_dt(frm)
    ).scalar() or 0


def reminder_stats(db: Session, user_id: UUID, today: date) -> dict:
    def window(frm: date) -> dict:
        done = _activity_count(db, user_id, TASK_DONE, frm)
        # Missed = recurring occurrences the midnight job had to skip + one-off reminders now overdue
        logged_missed = db.query(func.count(ActivityLog.id)).filter(
            ActivityLog.user_id == user_id, ActivityLog.kind == TASK_MISSED, ActivityLog.due_date >= frm
        ).scalar() or 0
        missed = logged_missed + _overdue_query(db, user_id, today).filter(Task.due_date >= frm).count()
        return {"done": done, "missed": missed, "pct": _pct(done, done + missed)}

    return {
        "week": window(_monday(today)),
        "month": window(today - timedelta(days=29)),
        "overdue_now": _overdue_query(db, user_id, today).count(),
    }


def _overdue_query(db: Session, user_id: UUID, today: date):
    return db.query(Task).filter(
        Task.user_id == user_id, Task.is_event.is_(False), Task.is_completed.is_(False),
        or_(Task.recurrence.is_(None), Task.recurrence == "none"),
        Task.due_date.isnot(None), Task.due_date < today,
    )


def list_stats(db: Session, user_id: UUID, today: date) -> dict:
    lists = (
        db.query(UserList).options(joinedload(UserList.items))
        .filter(user_list_service._access(db, user_id)).all()
    )
    total = sum(len(l.items) for l in lists)
    pending = sum(1 for l in lists for i in l.items if not i.is_done)
    complete = sum(1 for l in lists if l.items and all(i.is_done for i in l.items))
    return {
        "checked_week": _activity_count(db, user_id, LIST_ITEM_DONE, _monday(today)),
        "checked_month": _activity_count(db, user_id, LIST_ITEM_DONE, today - timedelta(days=29)),
        "pending_items": pending, "total_items": total,
        "lists": len(lists), "lists_complete": complete,
    }


# ── Finance ───────────────────────────────────────────────────────────────────

def _spent(db: Session, user_id: UUID, frm: date, to: date) -> Decimal:
    return db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.user_id == user_id, Expense.date >= frm, Expense.date <= to,
        Expense.payment_method.in_([PaymentMethod.CASH, PaymentMethod.DEBIT, PaymentMethod.CREDIT]),
        or_(Expense.category.is_(None), Expense.category.notin_(EXCLUDED_CATEGORIES)),
    ).scalar() or Decimal("0")


def _by_category(db: Session, user_id: UUID, frm: date, to: date) -> Dict[str, Decimal]:
    rows = db.query(Expense.category, func.sum(Expense.amount)).filter(
        Expense.user_id == user_id, Expense.date >= frm, Expense.date <= to,
        Expense.payment_method.in_([PaymentMethod.CASH, PaymentMethod.DEBIT, PaymentMethod.CREDIT]),
        or_(Expense.category.is_(None), Expense.category.notin_(EXCLUDED_CATEGORIES)),
    ).group_by(Expense.category).all()
    return {(c or "Sin categoría"): Decimal(str(a)) for c, a in rows}


def finance_stats(db: Session, user_id: UUID, today: date, cycles: int = 6) -> Optional[dict]:
    mi = db.query(MonthlyIncome).filter(MonthlyIncome.user_id == user_id).first()
    if not mi:
        return None
    csd = mi.cycle_start_day or 1

    starts = [_current_cycle_start(today, csd)]
    for _ in range(cycles - 1):
        py, pm = _prev_month(starts[0].year, starts[0].month)
        starts.insert(0, _cycle_date(py, pm, csd))

    base_income = Decimal(str(mi.amount)) if _monthly_income_counts(mi) else Decimal("0")
    out = []
    for s in starts:
        e = _next_cycle_start(s, csd) - timedelta(days=1)
        income = base_income + _extra_income_for_cycle(db, user_id, s, e)
        spent = _spent(db, user_id, s, min(e, today))
        out.append({
            "label": _cycle_label(s, csd), "start": s, "end": e,
            "income": float(income), "spent": float(spent), "net": float(income - spent),
            "is_current": s == starts[-1],
        })

    cur_start, prev_start = starts[-1], starts[-2] if len(starts) > 1 else None
    elapsed = (today - cur_start).days
    cur_spent = _spent(db, user_id, cur_start, today)
    prev_same = _spent(db, user_id, prev_start, prev_start + timedelta(days=elapsed)) if prev_start else Decimal("0")

    cur_cat = _by_category(db, user_id, cur_start, today)
    prev_cat = _by_category(db, user_id, prev_start, prev_start + timedelta(days=elapsed)) if prev_start else {}
    categories = [
        {"category": c, "amount": float(a), "prev_amount": float(prev_cat.get(c, 0))}
        for c, a in sorted(cur_cat.items(), key=lambda kv: kv[1], reverse=True)[:6]
    ]

    return {
        "cycles": out,
        "spent_current": float(cur_spent),
        "spent_prev_same_point": float(prev_same),
        "spent_vs_prev_pct": round((float(cur_spent) - float(prev_same)) / float(prev_same) * 100) if prev_same else None,
        "avg_daily_spend": float(cur_spent) / (elapsed + 1),
        "categories": categories,
    }


def get_stats(db: Session, user_id: UUID) -> dict:
    today = today_local()
    return {
        "habits": habit_stats(db, user_id, today),
        "reminders": reminder_stats(db, user_id, today),
        "lists": list_stats(db, user_id, today),
        "finance": finance_stats(db, user_id, today),
    }
