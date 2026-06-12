from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.installment_purchase import InstallmentPurchase
from app.schemas.installment_purchase import InstallmentPurchaseCreate, InstallmentPurchaseUpdate


def get_installment_purchases(db: Session, user_id: UUID) -> List[InstallmentPurchase]:
    return db.query(InstallmentPurchase).filter(InstallmentPurchase.user_id == user_id).all()


def get_active_installment_purchases(db: Session, user_id: UUID) -> List[InstallmentPurchase]:
    return db.query(InstallmentPurchase).filter(
        InstallmentPurchase.user_id == user_id,
        InstallmentPurchase.remaining_installments > 0,
    ).all()


def get_installment_purchase(db: Session, purchase_id: UUID, user_id: UUID) -> Optional[InstallmentPurchase]:
    return db.query(InstallmentPurchase).filter(
        InstallmentPurchase.id == purchase_id,
        InstallmentPurchase.user_id == user_id,
    ).first()


def create_installment_purchase(db: Session, purchase: InstallmentPurchaseCreate, user_id: UUID) -> InstallmentPurchase:
    db_purchase = InstallmentPurchase(
        user_id=user_id,
        name=purchase.name,
        total_amount=purchase.total_amount,
        monthly_amount=purchase.monthly_amount,
        total_installments=purchase.total_installments,
        remaining_installments=purchase.remaining_installments,
        start_date=purchase.start_date,
    )
    db.add(db_purchase)
    db.commit()
    db.refresh(db_purchase)
    return db_purchase


def update_installment_purchase(
    db: Session, purchase_id: UUID, purchase: InstallmentPurchaseUpdate, user_id: UUID
) -> Optional[InstallmentPurchase]:
    db_purchase = get_installment_purchase(db, purchase_id, user_id)
    if not db_purchase:
        return None

    update_data = purchase.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_purchase, key, value)

    db.commit()
    db.refresh(db_purchase)
    return db_purchase


def delete_installment_purchase(db: Session, purchase_id: UUID, user_id: UUID) -> bool:
    db_purchase = get_installment_purchase(db, purchase_id, user_id)
    if not db_purchase:
        return False

    db.delete(db_purchase)
    db.commit()
    return True
