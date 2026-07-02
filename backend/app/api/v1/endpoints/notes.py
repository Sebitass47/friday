from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse
from app.services import note_service

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/", response_model=List[NoteResponse])
def list_notes(
    label: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return note_service.get_notes(db, current_user.id, label=label, search=search)


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    data: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return note_service.create_note(db, data, current_user.id)


@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: UUID,
    data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = note_service.update_note(db, note_id, data, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not note_service.delete_note(db, note_id, current_user.id):
        raise HTTPException(status_code=404, detail="Nota no encontrada")


@router.post("/{note_id}/toggle-pin", response_model=NoteResponse)
def toggle_pin(
    note_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = note_service.toggle_pin(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return note
