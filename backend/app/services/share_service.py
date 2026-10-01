from typing import Dict, List, Optional, Set
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.share import Share, Contact, RESOURCE_TASK, RESOURCE_LIST, RESOURCE_NOTE
from app.models.note import Note
from app.models.task import Task
from app.models.user import User
from app.models.user_list import UserList


class ShareError(Exception):
    """Raised with a user-facing message and the HTTP status to answer with."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def display_name(user: User) -> str:
    return (user.full_name or "").strip() or user.email.split("@")[0]


def as_shared_user(user: User) -> dict:
    return {"id": user.id, "email": user.email, "name": display_name(user)}


# ── Lookup / access ───────────────────────────────────────────────────────────

def find_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()


def lookup_user(db: Session, current_user: User, email: str) -> User:
    user = find_user_by_email(db, email)
    if not user:
        raise ShareError("No hay ningún usuario de FRIDAY con ese correo", 404)
    if user.id == current_user.id:
        raise ShareError("No puedes compartir contigo mismo", 400)
    return user


def shared_resource_ids(db: Session, user_id: UUID, resource_type: str):
    """Subquery of resource ids shared WITH this user."""
    return db.query(Share.resource_id).filter(
        Share.resource_type == resource_type, Share.shared_with_id == user_id
    )


def audience_user_ids(db: Session, resource_type: str, resource_id: UUID, owner_id: UUID) -> List[UUID]:
    """Owner + everyone the resource is shared with (used to fan out notifications)."""
    rows = db.query(Share.shared_with_id).filter(
        Share.resource_type == resource_type, Share.resource_id == resource_id
    ).all()
    return [owner_id] + [r[0] for r in rows]


def _owner_of(db: Session, resource_type: str, resource_id: UUID) -> Optional[UUID]:
    model = {RESOURCE_TASK: Task, RESOURCE_LIST: UserList, RESOURCE_NOTE: Note}[resource_type]
    row = db.query(model.user_id).filter(model.id == resource_id).first()
    return row[0] if row else None


# ── Annotating resources for responses ────────────────────────────────────────

def annotate(db: Session, resource_type: str, items: list, viewer_id: UUID) -> None:
    """Attach is_owner / owner_* / shared_with to ORM objects so the response schema can read them."""
    if not items:
        return
    ids = [i.id for i in items]
    shares = db.query(Share).filter(Share.resource_type == resource_type, Share.resource_id.in_(ids)).all()
    user_ids = {s.shared_with_id for s in shares} | {i.user_id for i in items}
    users: Dict[UUID, User] = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    by_resource: Dict[UUID, List[dict]] = {}
    for s in shares:
        u = users.get(s.shared_with_id)
        if u:
            by_resource.setdefault(s.resource_id, []).append(as_shared_user(u))
    for i in items:
        owner = users.get(i.user_id)
        i.is_owner = i.user_id == viewer_id
        i.owner_email = owner.email if owner else None
        i.owner_name = display_name(owner) if owner else None
        i.shared_with = by_resource.get(i.id, [])


# ── Sharing actions ───────────────────────────────────────────────────────────

def share(db: Session, owner: User, resource_type: str, resource_id: UUID, email: str) -> List[dict]:
    if _owner_of(db, resource_type, resource_id) != owner.id:
        raise ShareError("Solo quien creó el elemento puede compartirlo", 404)
    target = lookup_user(db, owner, email)

    exists = db.query(Share).filter(
        Share.resource_type == resource_type,
        Share.resource_id == resource_id,
        Share.shared_with_id == target.id,
    ).first()
    if not exists:
        db.add(Share(resource_type=resource_type, resource_id=resource_id,
                     owner_id=owner.id, shared_with_id=target.id))
    if not db.query(Contact).filter(Contact.owner_id == owner.id, Contact.contact_user_id == target.id).first():
        db.add(Contact(owner_id=owner.id, contact_user_id=target.id))
    db.commit()
    return shared_with(db, resource_type, resource_id)


def unshare(db: Session, actor: User, resource_type: str, resource_id: UUID, user_id: UUID) -> List[dict]:
    """The owner can remove anyone; a recipient can remove themselves ('dejar de ver')."""
    owner_id = _owner_of(db, resource_type, resource_id)
    if owner_id is None:
        raise ShareError("Elemento no encontrado", 404)
    if actor.id != owner_id and actor.id != user_id:
        raise ShareError("No tienes permiso para quitar a esa persona", 403)
    db.query(Share).filter(
        Share.resource_type == resource_type,
        Share.resource_id == resource_id,
        Share.shared_with_id == user_id,
    ).delete()
    db.commit()
    return shared_with(db, resource_type, resource_id)


def shared_with(db: Session, resource_type: str, resource_id: UUID) -> List[dict]:
    rows = (
        db.query(User)
        .join(Share, Share.shared_with_id == User.id)
        .filter(Share.resource_type == resource_type, Share.resource_id == resource_id)
        .order_by(Share.created_at)
        .all()
    )
    return [as_shared_user(u) for u in rows]


def delete_shares_for(db: Session, resource_type: str, resource_id: UUID) -> None:
    """Called when the owner deletes a resource, so no orphan shares remain."""
    db.query(Share).filter(Share.resource_type == resource_type, Share.resource_id == resource_id).delete()


# ── Contacts ──────────────────────────────────────────────────────────────────

def get_contacts(db: Session, owner_id: UUID) -> List[dict]:
    rows = (
        db.query(User)
        .join(Contact, Contact.contact_user_id == User.id)
        .filter(Contact.owner_id == owner_id)
        .order_by(Contact.created_at)
        .all()
    )
    return [as_shared_user(u) for u in rows]


def remove_contact(db: Session, owner_id: UUID, contact_user_id: UUID) -> bool:
    n = db.query(Contact).filter(Contact.owner_id == owner_id, Contact.contact_user_id == contact_user_id).delete()
    db.commit()
    return n > 0
