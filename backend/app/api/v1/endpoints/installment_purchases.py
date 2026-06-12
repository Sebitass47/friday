from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.installment_purchase_service import (
    get_installment_purchases,
    get_installment_purchase,
    create_installment_purchase,
    update_installment_purchase,
    delete_installment_purchase,
)
from app.schemas.installment_purchase import (
    InstallmentPurchaseCreate,
    InstallmentPurchaseUpdate,
    InstallmentPurchaseResponse,
)

router = APIRouter(prefix="/installment-purchases", tags=["installment-purchases"])


@router.get("/", response_model=List[InstallmentPurchaseResponse])
def read_installment_purchases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_installment_purchases(db, current_user.id)


@router.post("/", response_model=InstallmentPurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_installment_purchase_endpoint(
    purchase: InstallmentPurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_installment_purchase(db, purchase, current_user.id)


@router.get("/{purchase_id}", response_model=InstallmentPurchaseResponse)
def read_installment_purchase(
    purchase_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_purchase = get_installment_purchase(db, purchase_id, current_user.id)
    if not db_purchase:
        raise HTTPException(status_code=404, detail="MSI no encontrado")
    return db_purchase


@router.put("/{purchase_id}", response_model=InstallmentPurchaseResponse)
def update_installment_purchase_endpoint(
    purchase_id: UUID,
    purchase: InstallmentPurchaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_purchase = update_installment_purchase(db, purchase_id, purchase, current_user.id)
    if not db_purchase:
        raise HTTPException(status_code=404, detail="MSI no encontrado")
    return db_purchase


@router.delete("/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_installment_purchase_endpoint(
    purchase_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = delete_installment_purchase(db, purchase_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="MSI no encontrado")
