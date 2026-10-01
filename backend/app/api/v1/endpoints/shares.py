from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.share import SharedUser, LookupRequest, ShareRequest, ShareResponse
from app.services import share_service as svc

router = APIRouter(tags=["shares"])


def _raise(e: svc.ShareError):
    raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/contacts/", response_model=List[SharedUser])
def list_contacts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return svc.get_contacts(db, current_user.id)


@router.delete("/contacts/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not svc.remove_contact(db, current_user.id, user_id):
        raise HTTPException(status_code=404, detail="Contacto no encontrado")


@router.post("/shares/lookup", response_model=SharedUser)
def lookup(data: LookupRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return svc.as_shared_user(svc.lookup_user(db, current_user, data.email))
    except svc.ShareError as e:
        _raise(e)


@router.post("/shares/", response_model=ShareResponse)
def share(data: ShareRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return {"shared_with": svc.share(db, current_user, data.resource_type, data.resource_id, data.email)}
    except svc.ShareError as e:
        _raise(e)


@router.delete("/shares/{resource_type}/{resource_id}/{user_id}", response_model=ShareResponse)
def unshare(resource_type: str, resource_id: UUID, user_id: UUID,
            db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if resource_type not in ("task", "list", "note"):
        raise HTTPException(status_code=400, detail="Tipo de recurso inválido")
    try:
        return {"shared_with": svc.unshare(db, current_user, resource_type, resource_id, user_id)}
    except svc.ShareError as e:
        _raise(e)
