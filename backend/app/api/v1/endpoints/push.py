import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/push", tags=["push"])


class SubscribeBody(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@router.get("/vapid-public-key")
def get_vapid_public_key():
    key = os.getenv("VAPID_PUBLIC_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="Push notifications not configured")
    return {"public_key": key}


@router.post("/subscribe")
def subscribe(
    body: SubscribeBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(PushSubscription).filter(
        PushSubscription.endpoint == body.endpoint
    ).first()
    if existing:
        existing.p256dh = body.p256dh
        existing.auth = body.auth
    else:
        db.add(PushSubscription(
            user_id=current_user.id,
            endpoint=body.endpoint,
            p256dh=body.p256dh,
            auth=body.auth,
        ))
    db.commit()
    return {"status": "subscribed"}


@router.delete("/unsubscribe")
def unsubscribe(
    body: SubscribeBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == body.endpoint,
        PushSubscription.user_id == current_user.id,
    ).delete()
    db.commit()
    return {"status": "unsubscribed"}


@router.get("/debug")
def debug_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return info about current push subscriptions and VAPID config (no private key exposed)."""
    subs = db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id).all()
    vapid_private = os.getenv("VAPID_PRIVATE_KEY", "")
    vapid_public = os.getenv("VAPID_PUBLIC_KEY", "")
    return {
        "subscriptions": [
            {
                "id": str(s.id),
                "endpoint_tail": s.endpoint[-50:] if s.endpoint else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in subs
        ],
        "subscription_count": len(subs),
        "vapid_private_configured": bool(vapid_private),
        "vapid_public_configured": bool(vapid_public),
        "vapid_public_key_tail": vapid_public[-20:] if vapid_public else None,
        "vapid_contact": os.getenv("VAPID_CONTACT_EMAIL", ""),
    }


class TestPushBody(BaseModel):
    title: str = "🔔 FRIDAY test"
    body: str = "¡Las notificaciones funcionan!"


@router.post("/test")
def send_test_push(
    payload: TestPushBody = TestPushBody(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send an immediate test push to all of this user's subscriptions."""
    from app.services.push_service import send_push

    subs = db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id).all()
    if not subs:
        raise HTTPException(status_code=404, detail="No hay suscripciones registradas para este usuario")

    results = []
    dead = []
    for sub in subs:
        logger.info("Sending test push to ...%s", sub.endpoint[-40:])
        alive = send_push(sub, payload.title, payload.body, url="/", tag="friday-test")
        results.append({
            "endpoint_tail": sub.endpoint[-50:],
            "delivered": alive,
        })
        if not alive:
            dead.append(sub)

    for sub in dead:
        db.delete(sub)
    if dead:
        db.commit()

    return {
        "total": len(subs),
        "delivered": sum(1 for r in results if r["delivered"]),
        "dead_removed": len(dead),
        "detail": results,
    }
