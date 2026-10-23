from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.digest import DigestSettingsOut, DigestSettingsUpdate, DigestPreview
from app.services import digest_service

router = APIRouter(prefix="/digest", tags=["digest"])


@router.get("/settings", response_model=DigestSettingsOut)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return digest_service.get_settings(db, current_user.id)


@router.put("/settings", response_model=DigestSettingsOut)
def update_settings(data: DigestSettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = digest_service.get_settings(db, current_user.id)
    for field, value in data.model_dump().items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.post("/test", response_model=DigestPreview)
def send_test(kind: str, send: bool = True, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Build the digest right now (and push it to your devices unless send=false)."""
    if kind not in (digest_service.SUNDAY, digest_service.FRIDAY):
        raise HTTPException(status_code=400, detail="kind debe ser 'sunday' o 'friday'")
    if send:
        title, body, sent = digest_service.send_digest(db, current_user.id, kind)
        return {"title": title, "body": body, "sent": sent}
    title, body = digest_service.build_digest(db, current_user.id, kind)
    return {"title": title, "body": body, "sent": 0}
