from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.services import user_service
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.schemas.user import UserResponse, Token, UserCreate
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

TRUSTED_DEVICE_DAYS = 30

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    import os
    secret = os.getenv("REGISTRATION_SECRET", "")
    if not secret or user.invite_code != secret:
        raise HTTPException(status_code=403, detail="Código de invitación inválido")
    existing_user = user_service.get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return user_service.create_user(db, user)

@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    user = user_service.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password", headers={"WWW-Authenticate": "Bearer"})
    expires = timedelta(days=TRUSTED_DEVICE_DAYS) if remember_me else None
    access_token = create_access_token(data={"sub": user.email}, expires_delta=expires)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
