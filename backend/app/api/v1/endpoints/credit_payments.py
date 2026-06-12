from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.credit_payment_service import (
    get_credit_payments,
    get_credit_payments_for_account,
    get_credit_payment,
    create_credit_payment,
    update_credit_payment,
    delete_credit_payment,
)
from app.schemas.credit_payment import CreditPaymentCreate, CreditPaymentUpdate, CreditPaymentResponse

router = APIRouter(prefix="/credit-payments", tags=["credit-payments"])


@router.get("/", response_model=List[CreditPaymentResponse])
def list_credit_payments(
    account_id: Optional[UUID] = Query(None, description="Filtrar por tarjeta"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener pagos de tarjeta de crédito del usuario"""
    if account_id:
        return get_credit_payments_for_account(db, current_user.id, account_id)
    return get_credit_payments(db, current_user.id)


@router.post("/", response_model=CreditPaymentResponse, status_code=status.HTTP_201_CREATED)
def create_credit_payment_endpoint(
    payment: CreditPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registrar un pago de tarjeta de crédito"""
    try:
        return create_credit_payment(db, payment, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{payment_id}", response_model=CreditPaymentResponse)
def read_credit_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener detalles de un pago"""
    db_payment = get_credit_payment(db, payment_id, current_user.id)
    if not db_payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return db_payment


@router.put("/{payment_id}", response_model=CreditPaymentResponse)
def update_credit_payment_endpoint(
    payment_id: UUID,
    payment_update: CreditPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualizar un pago"""
    db_payment = update_credit_payment(db, payment_id, payment_update, current_user.id)
    if not db_payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return db_payment


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_credit_payment_endpoint(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Eliminar un pago"""
    success = delete_credit_payment(db, payment_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return None
