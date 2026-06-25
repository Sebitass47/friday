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
