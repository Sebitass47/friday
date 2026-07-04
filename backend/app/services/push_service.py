import json
import os
import logging
from datetime import date, timedelta
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS = {"sub": f"mailto:{os.getenv('VAPID_CONTACT_EMAIL', 'admin@localhost')}"}


def send_push(subscription, title: str, body: str, url: str = "/", tag: str = "friday") -> bool:
    """Send a push notification to a single subscription. Returns False if subscription is gone."""
    from pywebpush import webpush, WebPushException

    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not set — push skipped")
        return True

    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=json.dumps({"title": title, "body": body, "icon": "/icon-192.png", "url": url, "tag": tag}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )
        return True
    except Exception as e:
        logger.error("Push send error: %s", e)
        if hasattr(e, 'response') and e.response is not None and e.response.status_code == 410:
            return False
        return True


def check_and_notify_habits(db: Session, hour: int) -> None:
    """Send a habit progress push to every user who still has pending habits today."""
    from app.models.habit import Habit, HabitLog
    from app.models.push_subscription import PushSubscription
    from datetime import datetime, timezone
    import pytz

    tz = pytz.timezone("America/Mexico_City")
    today = datetime.now(tz).date()

    # All users that have at least one push subscription
    user_ids = [row[0] for row in db.query(PushSubscription.user_id).distinct().all()]

    messages = {
        15: ("¡Ey! 🌞", "Te faltan {n} hábito{s} hoy — todavía hay tiempo 💪"),
        18: ("Oye... 🟡", "{n} hábito{s} pendiente{s} — no dejes para mañana 😬"),
        21: ("Último aviso 🌙", "Son las 9pm y aún te faltan {n} hábito{s}. ¡Tú puedes! 🔥"),
    }
    title_tpl, body_tpl = messages.get(hour, ("FRIDAY 🎯", "Te faltan {n} hábito{s} para hoy"))

    for user_id in user_ids:
        habits = db.query(Habit).filter(Habit.user_id == user_id).all()
        if not habits:
            continue

        completed_ids = {
            row[0]
            for row in db.query(HabitLog.habit_id)
            .filter(HabitLog.habit_id.in_([h.id for h in habits]), HabitLog.date == today)
            .all()
        }
        pending = [h for h in habits if h.id not in completed_ids]
        n = len(pending)
        if n == 0:
            continue

        s = "s" if n > 1 else ""
        title = title_tpl
        body = body_tpl.format(n=n, s=s)

        subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
        for sub in subs:
            alive = send_push(sub, title, body, url="/habitos", tag=f"habitos-{hour}")
            if not alive:
                db.delete(sub)

    db.commit()


def check_and_notify_upcoming_payments(db: Session) -> None:
    """Run daily: notify users whose credit cards are due in 3 days."""
    from app.models.account import Account
    from app.models.push_subscription import PushSubscription

    target_day = (date.today() + timedelta(days=3)).day

    cards = db.query(Account).filter(Account.payment_day == target_day).all()
    for card in cards:
        subs = db.query(PushSubscription).filter(
            PushSubscription.user_id == card.user_id
        ).all()
        for sub in subs:
            alive = send_push(
                sub,
                title=f"💳 Pago en 3 días · {card.name}",
                body=f"Tu tarjeta vence el día {card.payment_day}. No se te olvide pagar 💸",
                url="/dashboard",
                tag=f"pago-{card.id}",
            )
            if not alive:
                db.delete(sub)
    db.commit()
