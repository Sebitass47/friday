from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.account_service import (
    get_accounts,
    get_account,
    create_account,
    update_account,
    delete_account
)
from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse

router = APIRouter(prefix="/accounts", tags=["accounts"])

@router.get("/", response_model=List[AccountResponse])
def read_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener todas las cuentas del usuario actual"""
    return get_accounts(db, current_user.id)

@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account_endpoint(
    account: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crear una nueva cuenta"""
    return create_account(db, account, current_user.id)

@router.get("/{account_id}", response_model=AccountResponse)
def read_account(
    account_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener detalles de una cuenta específica"""
    db_account = get_account(db, account_id, current_user.id)
    if not db_account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return db_account

@router.put("/{account_id}", response_model=AccountResponse)
def update_account_endpoint(
    account_id: UUID,
    account: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualizar una cuenta existente"""
    db_account = update_account(db, account_id, account, current_user.id)
    if not db_account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return db_account

@router.delete("/{account_id}", response_model=bool)
def delete_account_endpoint(
    account_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Eliminar una cuenta"""
    success = delete_account(db, account_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return success