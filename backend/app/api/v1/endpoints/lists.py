from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.user_list import (
    ListCreate, ListUpdate, ListResponse, ListItemCreate, ListItemUpdate,
)
from app.services import user_list_service as svc

router = APIRouter(prefix="/lists", tags=["lists"])

NOT_FOUND = "Lista no encontrada"


@router.get("/", response_model=List[ListResponse])
def list_lists(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return svc.get_lists(db, current_user.id)


@router.post("/", response_model=ListResponse, status_code=status.HTTP_201_CREATED)
def create_list(data: ListCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return svc.create_list(db, data, current_user.id)


@router.put("/{list_id}", response_model=ListResponse)
def update_list(list_id: UUID, data: ListUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = svc.update_list(db, list_id, data, current_user.id)
    if not lst:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return lst


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(list_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not svc.delete_list(db, list_id, current_user.id):
        raise HTTPException(status_code=404, detail=NOT_FOUND)


@router.post("/{list_id}/items", response_model=ListResponse, status_code=status.HTTP_201_CREATED)
def add_item(list_id: UUID, data: ListItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = svc.add_item(db, list_id, data, current_user.id)
    if not lst:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return lst


@router.put("/{list_id}/items/{item_id}", response_model=ListResponse)
def update_item(list_id: UUID, item_id: UUID, data: ListItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = svc.update_item(db, list_id, item_id, data, current_user.id)
    if not lst:
        raise HTTPException(status_code=404, detail="Elemento no encontrado")
    return lst


@router.delete("/{list_id}/items/{item_id}", response_model=ListResponse)
def delete_item(list_id: UUID, item_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = svc.delete_item(db, list_id, item_id, current_user.id)
    if not lst:
        raise HTTPException(status_code=404, detail="Elemento no encontrado")
    return lst


@router.post("/{list_id}/clear-completed", response_model=ListResponse)
def clear_completed(list_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = svc.clear_completed(db, list_id, current_user.id)
    if not lst:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return lst
