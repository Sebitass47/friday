"""Notifications about shared things: 'X shared a list with you' (immediate) and
'X changed your list' (debounced). The API only *enqueues* work on Celery, so a slow
push service never blocks a request, and a burst of edits becomes one notification."""
import logging
import os
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.note import Note
from app.models.share import RESOURCE_TASK, RESOURCE_LIST, RESOURCE_NOTE
from app.models.task import Task
from app.models.user import User
from app.models.user_list import UserList

logger = logging.getLogger(__name__)

# Edits to the same item within this window collapse into a single push
DEBOUNCE_SECONDS = 60

_redis = None


def _r():
    global _redis
    if _redis is None:
        import redis
        _redis = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
    return _redis


def _name(user: User) -> str:
    return (user.full_name or "").strip() or user.email.split("@")[0]


def resource_info(db: Session, resource_type: str, resource_id: UUID) -> Optional[dict]:
    """What to call a shared thing and where a notification about it should open."""
    if resource_type == RESOURCE_TASK:
        t = db.query(Task).filter(Task.id == resource_id).first()
        if not t:
            return None
        if t.is_event:
            return {"noun": "evento", "article": "un", "definite": "el", "title": t.title, "url": "/events"}
        return {"noun": "recordatorio", "article": "un", "definite": "el", "title": t.title, "url": "/recordatorios"}
    if resource_type == RESOURCE_LIST:
        l = db.query(UserList).filter(UserList.id == resource_id).first()
        if not l:
            return None
        return {"noun": "lista", "article": "una", "definite": "la", "title": f"{l.emoji} {l.name}", "url": f"/listas?open={l.id}"}
    if resource_type == RESOURCE_NOTE:
        n = db.query(Note).filter(Note.id == resource_id).first()
        if not n:
            return None
        return {"noun": "nota", "article": "una", "definite": "la", "title": n.title, "url": "/notas"}
    return None


def notify_shared(db: Session, actor: User, resource_type: str, resource_id: UUID, target_id: UUID) -> None:
    """Tell someone they were just added to a reminder, event, list or note."""
    try:
        info = resource_info(db, resource_type, resource_id)
        if not info:
            return
        from app.tasks import send_notification
        send_notification.delay(
            [str(target_id)],
            f"👥 {_name(actor)} compartió contigo {info['article']} {info['noun']}",
            info["title"],
            info["url"],
            f"share-{resource_id}",
        )
    except Exception:
        logger.exception("Could not enqueue share notification")


def record_change(db: Session, actor_id: UUID, resource_type: str, resource_id: UUID) -> None:
    """Note that someone edited a shared thing; a worker sends one summary shortly after.
    Never raises: a notification problem must not fail the edit."""
    try:
        from app.services import share_service
        owner_id = share_service._owner_of(db, resource_type, resource_id)
        if owner_id is None:
            return
        audience = set(share_service.audience_user_ids(db, resource_type, resource_id, owner_id))
        if not (audience - {actor_id}):
            return  # not shared with anyone else

        r = _r()
        key = f"notif:chg:{resource_type}:{resource_id}"
        r.sadd(key, str(actor_id))
        r.expire(key, DEBOUNCE_SECONDS * 10)
        if r.set(f"{key}:sched", 1, nx=True, ex=DEBOUNCE_SECONDS + 30):
            from app.tasks import flush_resource_changes
            flush_resource_changes.apply_async(args=[resource_type, str(resource_id)], countdown=DEBOUNCE_SECONDS)
    except Exception:
        logger.exception("Could not record shared change")


def _join(names: list) -> str:
    if len(names) == 1:
        return names[0]
    return ", ".join(names[:-1]) + " y " + names[-1]


def flush_changes(db: Session, resource_type: str, resource_id: str) -> int:
    """Worker side of record_change: one 'X updated…' push per person, never to the editor themselves."""
    from app.services import share_service
    from app.services.push_service import send_push_to_users

    r = _r()
    key = f"notif:chg:{resource_type}:{resource_id}"
    r.delete(f"{key}:sched")
    actors = {UUID(a.decode()) for a in r.smembers(key)}
    r.delete(key)
    if not actors:
        return 0

    rid = UUID(resource_id)
    info = resource_info(db, resource_type, rid)
    owner_id = share_service._owner_of(db, resource_type, rid)
    if not info or owner_id is None:
        return 0
    audience = set(share_service.audience_user_ids(db, resource_type, rid, owner_id))
    users = {u.id: u for u in db.query(User).filter(User.id.in_(actors | audience)).all()}

    sent = 0
    for recipient in audience:
        names = sorted(_name(users[a]) for a in actors if a != recipient and a in users)
        if not names:
            continue
        verb = "actualizó" if len(names) == 1 else "actualizaron"
        sent += send_push_to_users(
            db, [recipient],
            f"✏️ {_join(names)} {verb} {info['definite']} {info['noun']}",
            info["title"], info["url"], f"chg-{resource_type}-{resource_id}",
        )
    return sent
