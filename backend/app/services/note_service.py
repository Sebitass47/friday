from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.note import Note
from app.models.share import RESOURCE_NOTE
from app.schemas.note import NoteCreate, NoteUpdate
from app.services import share_service


def _access(db: Session, user_id: UUID):
    """Notes the user owns OR that were shared with them."""
    return or_(Note.user_id == user_id, Note.id.in_(share_service.shared_resource_ids(db, user_id, RESOURCE_NOTE)))


def _find(db: Session, note_id: UUID, user_id: UUID) -> Optional[Note]:
    return db.query(Note).filter(Note.id == note_id, _access(db, user_id)).first()


def _annotated(db: Session, note: Note, user_id: UUID) -> Note:
    share_service.annotate(db, RESOURCE_NOTE, [note], user_id)
    return note


def get_notes(
    db: Session,
    user_id: UUID,
    label: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Note]:
    q = db.query(Note).filter(_access(db, user_id))
    if label:
        q = q.filter(Note.label == label)
    if search:
        q = q.filter(
            or_(Note.title.ilike(f"%{search}%"), Note.content.ilike(f"%{search}%"))
        )
    notes = q.order_by(Note.is_pinned.desc(), Note.updated_at.desc()).all()
    share_service.annotate(db, RESOURCE_NOTE, notes, user_id)
    return notes


def create_note(db: Session, data: NoteCreate, user_id: UUID) -> Note:
    note = Note(user_id=user_id, **data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return _annotated(db, note, user_id)


def update_note(db: Session, note_id: UUID, data: NoteUpdate, user_id: UUID) -> Optional[Note]:
    note = _find(db, note_id, user_id)
    if not note:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return _annotated(db, note, user_id)


def delete_note(db: Session, note_id: UUID, user_id: UUID) -> bool:
    # Only the owner can delete; recipients "leave" via the unshare endpoint
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user_id).first()
    if not note:
        return False
    share_service.delete_shares_for(db, RESOURCE_NOTE, note.id)
    db.delete(note)
    db.commit()
    return True


def toggle_pin(db: Session, note_id: UUID, user_id: UUID) -> Optional[Note]:
    note = _find(db, note_id, user_id)
    if not note:
        return None
    note.is_pinned = not note.is_pinned
    db.commit()
    db.refresh(note)
    return _annotated(db, note, user_id)
