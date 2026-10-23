"""Sunday 'your week' and Friday 'wrap-up' summaries, sent as a push.
Plain templates over data we already have: no AI involved."""
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.clock import APP_TZ, today_local
from app.models.account import Account, AccountType
from app.models.digest_settings import DigestSettings
from app.models.push_subscription import PushSubscription
from app.models.task import Task
from app.models.user import User
from app.services import stats_service, task_service
from app.services.projection_service import calculate_projection
from app.services.push_service import send_push_to_users

logger = logging.getLogger(__name__)

SUNDAY, FRIDAY = "sunday", "friday"
KIND_WEEKDAY = {FRIDAY: 4, SUNDAY: 6}
DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]


def _money(n) -> str:
    return f"${float(n):,.0f}"


def _plural(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def _day(d: date) -> str:
    return DAYS_ES[d.weekday()]


def _items(db: Session, user_id: UUID, frm: date, to: date) -> Tuple[List[Task], List[Task]]:
    rows = (
        db.query(Task)
        .filter(task_service._access(db, user_id), Task.due_date >= frm, Task.due_date <= to)
        .order_by(Task.due_date, Task.due_time)
        .all()
    )
    return [t for t in rows if t.is_event], [t for t in rows if not t.is_event and not t.is_completed]


def _card_payments(db: Session, user_id: UUID, frm: date, to: date) -> List[Tuple[str, date]]:
    """(card name, due date) for cards whose payment day falls inside the window."""
    cards = db.query(Account).filter(
        Account.user_id == user_id, Account.account_type == AccountType.CREDIT_CARD, Account.payment_day.isnot(None)
    ).all()
    out = []
    for c in cards:
        d = frm
        while d <= to:
            if d.day == c.payment_day:
                out.append((c.name, d))
            d += timedelta(days=1)
    return sorted(out, key=lambda x: x[1])


def _money_line(db: Session, user_id: UUID, today: date) -> Tuple[Optional[str], Optional[date]]:
    """'💰 Te quedan $X' for the current cycle, plus the cycle's last day."""
    try:
        cur = calculate_projection(db, user_id, months=1).months[0]
    except Exception:
        return None, None  # no monthly income configured yet
    left = max((cur.cycle_end - today).days + 1, 0)
    return f"💰 Te quedan {_money(cur.available)} · {_plural(left, 'día', 'días')} de ciclo", cur.cycle_end


Line = Tuple[str, str]  # (section key, text)


def _compose(db: Session, user_id: UUID, kind: str, today: date) -> Tuple[str, List[Line]]:
    """Every line of the digest, tagged by section so the push can pick the essentials."""
    lines: List[Line] = []

    if kind == SUNDAY:
        frm, to = today + timedelta(days=1), today + timedelta(days=7)
        events, todos = _items(db, user_id, frm, to)
        title = "🗓️ Tu semana en FRIDAY"
        if events:
            shown = " · ".join(f"{_day(e.due_date)} {e.title}" for e in events[:3])
            more = f" (+{len(events) - 3})" if len(events) > 3 else ""
            lines.append(("events", f"📅 {_plural(len(events), 'evento', 'eventos')}: {shown}{more}"))
        if todos:
            lines.append(("todos", f"✅ {_plural(len(todos), 'recordatorio', 'recordatorios')} por hacer"))
        pays = _card_payments(db, user_id, frm, to)
        if pays:
            lines.append(("payments", "💳 Pagos: " + " · ".join(f"{n} ({_day(d)})" for n, d in pays[:3])))
        money, cycle_end = _money_line(db, user_id, today)
        if cycle_end and frm <= cycle_end <= to:
            lines.append(("cycle", f"🔚 Tu ciclo cierra el {_day(cycle_end)} {cycle_end.day}"))
        if money:
            lines.append(("money", money))
        if not events and not todos and not pays:
            lines.insert(0, ("free", "Semana libre: nada agendado por ahora ✨"))
    else:
        weekend_end = today + timedelta(days=2)
        events, todos = _items(db, user_id, today, weekend_end)
        today_events = [e for e in events if e.due_date == today]
        today_todos = [t for t in todos if t.due_date == today]
        title = "🎉 ¡Es viernes!"
        if today_events or today_todos:
            bits = []
            if today_events:
                bits.append(_plural(len(today_events), "evento", "eventos"))
            if today_todos:
                bits.append(_plural(len(today_todos), "recordatorio", "recordatorios"))
            lines.append(("today", "Hoy: " + " y ".join(bits)))
            if today_events:
                e = today_events[0]
                lines.append(("today_event", f"📅 {e.title}" + (f" · {e.due_time.strftime('%H:%M')}" if e.due_time else "")))
        weekend = [e for e in events if e.due_date > today]
        if weekend:
            lines.append(("weekend", "🎈 Fin de semana: " + " · ".join(f"{_day(e.due_date)} {e.title}" for e in weekend[:3])))
        habits = stats_service.habit_stats(db, user_id, today)
        if habits:
            lines.append(("habits", f"🎯 Hábitos esta semana: {habits['week_pct']}%"))
        checked = stats_service._activity_count(db, user_id, "list_item_done", stats_service._monday(today))
        done = stats_service._activity_count(db, user_id, "task_done", stats_service._monday(today))
        if checked or done:
            lines.append(("wins", f"💪 Esta semana cumpliste {_plural(done, 'recordatorio', 'recordatorios')} y tachaste {checked} de tus listas"))
        money, _ = _money_line(db, user_id, today)
        if money:
            lines.append(("money", money))

    return title, lines


# What goes in the push: one headline line + the money line. The rest lives in the in-app summary.
_HEADLINE_KEYS = {SUNDAY: ("events", "todos", "free", "payments"), FRIDAY: ("today", "weekend", "habits")}


def build_digest(db: Session, user_id: UUID, kind: str, today: Optional[date] = None) -> Tuple[str, List[str]]:
    """Full digest for the in-app view: (title, lines)."""
    title, lines = _compose(db, user_id, kind, today or today_local())
    return title, [text for _k, text in lines] or ["Abre FRIDAY para ver cómo va tu semana."]


def build_push(db: Session, user_id: UUID, kind: str, today: Optional[date] = None) -> Tuple[str, str]:
    """Short version for the notification (they collapse to ~2 lines on most devices)."""
    title, lines = _compose(db, user_id, kind, today or today_local())
    by_key = dict(lines)
    key = next((k for k in _HEADLINE_KEYS[kind] if k in by_key), None)
    picked = []
    if key:
        text = by_key[key]
        # "📅 5 eventos: Sáb …, Dom …" -> "📅 5 eventos esta semana": the names go in the full view
        picked.append(f"{text.split(':')[0]} esta semana" if key == "events" else text)
    if "money" in by_key:
        picked.append(by_key["money"])
    picked.append("Toca para ver el resumen completo")
    return title, "\n".join(picked)


# ── Settings & scheduling ─────────────────────────────────────────────────────

def get_settings(db: Session, user_id: UUID) -> DigestSettings:
    row = db.query(DigestSettings).filter(DigestSettings.user_id == user_id).first()
    if not row:
        row = DigestSettings(user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def send_digest(db: Session, user_id: UUID, kind: str) -> Tuple[str, str, int]:
    title, body = build_push(db, user_id, kind)
    sent = send_push_to_users(db, [user_id], title, body, url=f"/?digest={kind}", tag=f"digest-{kind}")
    return title, body, sent


def send_due_digests(db: Session) -> int:
    """Called hourly. Sends each user's digest when today's weekday and their chosen hour match."""
    now = datetime.now(APP_TZ)
    kind = next((k for k, wd in KIND_WEEKDAY.items() if wd == now.weekday()), None)
    if kind is None:
        return 0

    user_ids = [r[0] for r in db.query(PushSubscription.user_id).distinct().all()]
    sent = 0
    for uid in user_ids:
        s = get_settings(db, uid)
        on = s.sunday_on if kind == SUNDAY else s.friday_on
        hour = s.sunday_hour if kind == SUNDAY else s.friday_hour
        key = f"{now.date().isoformat()}:{kind}"
        if not (s.enabled and on and hour == now.hour) or s.last_sent_key == key:
            continue
        try:
            send_digest(db, uid, kind)
            s.last_sent_key = key
            db.commit()
            sent += 1
        except Exception:
            db.rollback()
            logger.exception("Digest failed for user %s", uid)
    return sent
