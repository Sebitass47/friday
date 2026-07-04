from app.celery_app import celery
from app.core.database import SessionLocal
import logging

logger = logging.getLogger(__name__)


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
                    alive = send_push(sub, f"🔔 Mañana: {task.title}", "Tienes una tarea para mañana", url="/to_do", tag=f"todo-pre-{task.id}")
                    if not alive:
                        db.delete(sub)
                task.reminded_day_before = True

            # Main notification
            if not task.reminded_main and reminder_dt and now >= reminder_dt:
                for sub in subs:
                    alive = send_push(sub, f"✅ {task.title}", task.notes or "Es hora de esta tarea", url="/to_do", tag=f"todo-{task.id}")
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
