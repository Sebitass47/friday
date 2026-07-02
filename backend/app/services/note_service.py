from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.note import Note
from app.schemas.note import NoteCreate, NoteUpdate


def get_notes(
    db: Session,
    user_id: UUID,
    label: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Note]:
    q = db.query(Note).filter(Note.user_id == user_id)
    if label:
        q = q.filter(Note.label == label)
    if search:
        q = q.filter(
            or_(Note.title.ilike(f"%{search}%"), Note.content.ilike(f"%{search}%"))
        )
    return q.order_by(Note.is_pinned.desc(), Note.updated_at.desc()).all()


def create_note(db: Session, data: NoteCreate, user_id: UUID) -> Note:
    note = Note(user_id=user_id, **data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def update_note(db: Session, note_id: UUID, data: NoteUpdate, user_id: UUID) -> Optional[Note]:
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user_id).first()
    if not note:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, note_id: UUID, user_id: UUID) -> bool:
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user_id).first()
    if not note:
        return False
    db.delete(note)
    db.commit()
    return True


def toggle_pin(db: Session, note_id: UUID, user_id: UUID) -> Optional[Note]:
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user_id).first()
    if not note:
        return None
    note.is_pinned = not note.is_pinned
    db.commit()
    db.refresh(note)
    return note
