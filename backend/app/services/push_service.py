import json
import os
import logging
from datetime import date, timedelta
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS = {"sub": f"mailto:{os.getenv('VAPID_CONTACT_EMAIL', 'admin@localhost')}"}


def send_push(subscription, title: str, body: str) -> bool:
    """Send a push notification to a single subscription. Returns False if subscription is gone."""
    from pywebpush import webpush, WebPushException
    from app.models.push_subscription import PushSubscription

    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not set — push skipped")
        return True

    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=json.dumps({"title": title, "body": body, "icon": "/icon-192.svg"}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )
        return True
    except Exception as e:
        logger.error("Push send error: %s", e)
        # 410 = subscription expired/unsubscribed by browser
        if hasattr(e, 'response') and e.response is not None and e.response.status_code == 410:
            return False
        return True


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
            )
            if not alive:
                db.delete(sub)
    db.commit()
