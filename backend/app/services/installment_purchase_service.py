from typing import List, Optional
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.installment_purchase import InstallmentPurchase
from app.models.account import Account
from app.schemas.installment_purchase import InstallmentPurchaseCreate, InstallmentPurchaseUpdate


def _adjust_card_balance(account: Account, delta: Decimal) -> None:
    """Add delta to current_balance_used and recompute available_credit."""
    account.current_balance_used = (account.current_balance_used or Decimal(0)) + delta
    if account.credit_limit:
        account.available_credit = account.credit_limit - account.current_balance_used


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
        account_id=purchase.account_id,
        name=purchase.name,
        total_amount=purchase.total_amount,
        monthly_amount=purchase.monthly_amount,
        total_installments=purchase.total_installments,
        remaining_installments=purchase.remaining_installments,
        start_date=purchase.start_date,
    )

    # If linked to a card and it's a new charge, increase the card's used balance
    if purchase.account_id and purchase.is_new_charge:
        account = db.query(Account).filter(
            Account.id == purchase.account_id,
            Account.user_id == user_id,
        ).first()
        if account:
            remaining_total = purchase.monthly_amount * purchase.remaining_installments
            _adjust_card_balance(account, remaining_total)

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


def mark_paid_this_month(db: Session, purchase_id: UUID, user_id: UUID) -> Optional[InstallmentPurchase]:
    """Mark current month's installment as paid, decrement remaining, free card credit."""
    db_purchase = get_installment_purchase(db, purchase_id, user_id)
    if not db_purchase or db_purchase.remaining_installments <= 0:
        return None

    today = date.today()
    db_purchase.paid_month = today.month
    db_purchase.paid_year = today.year
    db_purchase.remaining_installments = db_purchase.remaining_installments - 1

    if db_purchase.account_id:
        account = db.query(Account).filter(Account.id == db_purchase.account_id, Account.user_id == user_id).first()
        if account:
            _adjust_card_balance(account, -db_purchase.monthly_amount)

    db.commit()
    db.refresh(db_purchase)
    return db_purchase


def liquidate(db: Session, purchase_id: UUID, user_id: UUID) -> Optional[InstallmentPurchase]:
    """Pay off the full remaining balance, set remaining_installments to 0, free card credit."""
    db_purchase = get_installment_purchase(db, purchase_id, user_id)
    if not db_purchase or db_purchase.remaining_installments <= 0:
        return None

    remaining_total = db_purchase.monthly_amount * db_purchase.remaining_installments
    db_purchase.remaining_installments = 0

    if db_purchase.account_id:
        account = db.query(Account).filter(Account.id == db_purchase.account_id, Account.user_id == user_id).first()
        if account:
            _adjust_card_balance(account, -remaining_total)

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
