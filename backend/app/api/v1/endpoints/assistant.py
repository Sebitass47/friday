from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.assistant import (
    AssistantMessage, AssistantReply, ConfirmRequest, ConfirmResult, UsageOut,
)
from app.services import assistant_service as svc

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/message", response_model=AssistantReply)
def message(body: AssistantMessage, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Understand a sentence and PROPOSE actions; nothing is saved until /confirm."""
    try:
        return svc.handle_message(db, current_user.id, body.text.strip(), [t.model_dump() for t in body.history])
    except svc.AssistantError as e:
        raise HTTPException(status_code=e.status, detail=e.message)


@router.post("/confirm", response_model=ConfirmResult)
def confirm(body: ConfirmRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return svc.confirm(db, current_user.id, [a.model_dump() for a in body.actions])


@router.get("/usage", response_model=UsageOut)
def usage(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import os
    row = svc.get_usage(db, current_user.id)
    db.commit()
    return UsageOut(
        spent_usd=float(row.cost_usd or 0), limit_usd=float(svc.MONTHLY_LIMIT), calls=row.calls or 0,
        available=bool(os.getenv("ANTHROPIC_API_KEY")),
    )
