from app.celery_app import celery
from app.core.database import SessionLocal
import app.models  # noqa: F401 — registers all SQLAlchemy mappers before any task runs
import logging
import calendar as cal_mod
from datetime import date, timedelta

logger = logging.getLogger(__name__)


def _current_cycle_start(today: date, cycle_start_day: int) -> date:
    """Return the start date of the financial cycle that contains today."""
    def clamp(y, m, d):
        return date(y, m, min(d, cal_mod.monthrange(y, m)[1]))

    this_cycle = clamp(today.year, today.month, cycle_start_day)
    if today >= this_cycle:
        return this_cycle
    prev_month = today.month - 1 or 12
    prev_year = today.year if today.month > 1 else today.year - 1
    return clamp(prev_year, prev_month, cycle_start_day)


@celery.task(name="app.tasks.check_payment_due_dates")
def check_payment_due_dates():
    """Check all credit cards and push a reminder 3 days before payment_day."""
    from app.services.push_service import check_and_notify_upcoming_payments
    db = SessionLocal()
    try:
        check_and_notify_upcoming_payments(db)
        logger.info("Payment due-date check completed")
    except Exception as e:
        logger.error("Error in check_payment_due_dates: %s", e)
    finally:
        db.close()


@celery.task(name="app.tasks.check_habit_reminders")
def check_habit_reminders(hour: int):
    """Send habit progress push notifications at the given hour (15, 18, 21)."""
    from app.services.push_service import check_and_notify_habits
    db = SessionLocal()
    try:
        check_and_notify_habits(db, hour)
        logger.info("Habit reminders check completed for hour %s", hour)
    except Exception as e:
        logger.error("Error in check_habit_reminders: %s", e)
    finally:
        db.close()


@celery.task(name="app.tasks.check_task_reminders")
def check_task_reminders():
    """Send push notifications for due todos and upcoming events."""
    from app.services.push_service import send_push
    from app.services.task_service import get_pending_todo_reminders, get_pending_event_reminders, _event_due_dt
    from app.models.push_subscription import PushSubscription
    from datetime import datetime, timezone, timedelta

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # ── Todo reminders ────────────────────────────────────────────────────
        for task in get_pending_todo_reminders(db):
            subs = db.query(PushSubscription).filter(PushSubscription.user_id == task.user_id).all()
            reminder_dt = task.reminder_at

            # Day-before notification
            if (
                task.remind_day_before
                and not task.reminded_day_before
                and reminder_dt
                and now >= reminder_dt - timedelta(days=1)
                and now < reminder_dt
            ):
                for sub in subs:
                    alive = send_push(sub, f"🔔 Mañana: {task.title}", "Tienes una tarea para mañana", url="/recordatorios", tag=f"todo-pre-{task.id}")
                    if not alive:
                        db.delete(sub)
                task.reminded_day_before = True

            # Main notification
            if not task.reminded_main and reminder_dt and now >= reminder_dt:
                for sub in subs:
                    alive = send_push(sub, f"✅ {task.title}", task.notes or "Es hora de esta tarea", url="/recordatorios", tag=f"todo-{task.id}")
                    if not alive:
                        db.delete(sub)
                task.reminded_main = True

        # ── Event reminders ───────────────────────────────────────────────────
        for task in get_pending_event_reminders(db):
            due_dt = _event_due_dt(task)
            if not due_dt:
                continue
            subs = db.query(PushSubscription).filter(PushSubscription.user_id == task.user_id).all()

            if not task.reminded_3d and now >= due_dt - timedelta(days=3):
                for sub in subs:
                    alive = send_push(sub, f"📅 En 3 días: {task.title}", f"El {task.due_date.strftime('%d/%m')} {'a las ' + task.due_time.strftime('%H:%M') if task.due_time else ''}", url="/events", tag=f"event-3d-{task.id}")
                    if not alive:
                        db.delete(sub)
                task.reminded_3d = True

            if not task.reminded_1d and now >= due_dt - timedelta(days=1):
                for sub in subs:
                    alive = send_push(sub, f"📅 Mañana: {task.title}", f"{'A las ' + task.due_time.strftime('%H:%M') if task.due_time else 'Todo el día'}", url="/events", tag=f"event-1d-{task.id}")
                    if not alive:
                        db.delete(sub)
                task.reminded_1d = True

            if not task.reminded_1h and now >= due_dt - timedelta(hours=1):
                for sub in subs:
                    alive = send_push(sub, f"⏰ En 1 hora: {task.title}", task.location or "", url="/events", tag=f"event-1h-{task.id}")
                    if not alive:
                        db.delete(sub)
                task.reminded_1h = True

        db.commit()
        logger.info("Task reminders check completed")
    except Exception as e:
        logger.error("Error in check_task_reminders: %s", e)
        db.rollback()
    finally:
        db.close()


@celery.task(name="app.tasks.charge_recurring_expenses")
def charge_recurring_expenses():
    """
    Daily task: for each recurring expense linked to a credit card, charge the
    amount to current_balance_used if we haven't done so in the user's current
    financial cycle (determined by their cycle_start_day in monthly_income).
    """
    from decimal import Decimal
    from app.models.recurring_expense import RecurringExpense
    from app.models.account import Account, AccountType
    from app.models.monthly_income import MonthlyIncome

    db = SessionLocal()
    try:
        today = date.today()
        charged = 0

        expenses = (
            db.query(RecurringExpense)
            .filter(RecurringExpense.account_id.isnot(None))
            .all()
        )

        for expense in expenses:
            account = db.query(Account).filter(Account.id == expense.account_id).first()
            if not account or account.account_type != AccountType.CREDIT_CARD:
                continue

            mi = db.query(MonthlyIncome).filter(MonthlyIncome.user_id == expense.user_id).first()
            cycle_start_day = mi.cycle_start_day if mi else 1
            current_cycle_start = _current_cycle_start(today, cycle_start_day)

            already_charged = (
                expense.last_charged_date is not None
                and expense.last_charged_date >= current_cycle_start
            )
            if already_charged:
                continue

            amount = Decimal(str(expense.amount))
            account.current_balance_used = (account.current_balance_used or Decimal(0)) + amount
            if account.credit_limit:
                account.available_credit = account.credit_limit - account.current_balance_used
            expense.last_charged_date = today
            charged += 1

        db.commit()
        logger.info("charge_recurring_expenses: charged %d expenses", charged)
    except Exception as e:
        logger.error("Error in charge_recurring_expenses: %s", e)
        db.rollback()
    finally:
        db.close()
