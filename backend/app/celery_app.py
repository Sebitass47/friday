import os
from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery = Celery("friday", broker=REDIS_URL, backend=REDIS_URL)

celery.conf.beat_schedule = {
    "check-payment-due-dates": {
        "task": "app.tasks.check_payment_due_dates",
        "schedule": crontab(hour=9, minute=0),
    },
    "check-task-reminders": {
        "task": "app.tasks.check_task_reminders",
        "schedule": crontab(minute="*/5"),  # every 5 minutes
    },
    "check-habit-reminders-15": {
        "task": "app.tasks.check_habit_reminders",
        "schedule": crontab(hour=15, minute=0),
        "kwargs": {"hour": 15},
    },
    "check-habit-reminders-18": {
        "task": "app.tasks.check_habit_reminders",
        "schedule": crontab(hour=18, minute=0),
        "kwargs": {"hour": 18},
    },
    "check-habit-reminders-21": {
        "task": "app.tasks.check_habit_reminders",
        "schedule": crontab(hour=21, minute=0),
        "kwargs": {"hour": 21},
    },
    "charge-recurring-expenses": {
        "task": "app.tasks.charge_recurring_expenses",
        "schedule": crontab(hour=7, minute=0),
    },
}
celery.conf.timezone = "America/Mexico_City"
celery.conf.task_serializer = "json"
celery.conf.result_serializer = "json"
celery.conf.accept_content = ["json"]

# Late import so tasks register themselves on the celery instance
import app.tasks  # noqa: E402, F401
