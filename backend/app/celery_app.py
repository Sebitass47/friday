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
}
celery.conf.timezone = "America/Mexico_City"
celery.conf.task_serializer = "json"
celery.conf.result_serializer = "json"
celery.conf.accept_content = ["json"]
