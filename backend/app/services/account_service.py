from typing import List, Optional, Tuple
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.account import Account, AccountType
from app.schemas.account import AccountCreate, AccountUpdate
from app.models.user import User

def get_accounts(db: Session, user_id: UUID) -> List[Account]:
    """Obtener todas las cuentas de un usuario"""
    return db.query(Account).filter(Account.user_id == user_id).all()

def get_account(db: Session, account_id: UUID, user_id: UUID) -> Optional[Account]:
    """Obtener una cuenta específica de un usuario"""
    return db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == user_id
    ).first()

def create_account(db: Session, account: AccountCreate, user_id: UUID) -> Account:
    """Crear una nueva cuenta"""
    used = account.current_balance_used or 0
    available = (account.credit_limit - used) if account.credit_limit else None
    db_account = Account(
        user_id=user_id,
        name=account.name,
        account_type=account.account_type,
        balance=account.balance or 0,
        currency=account.currency or "MXN",
        credit_limit=account.credit_limit,
        current_balance_used=used,
        available_credit=available,
        closing_day=account.closing_day,
        payment_day=account.payment_day
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

def update_account(db: Session, account_id: UUID, account: AccountUpdate, user_id: UUID) -> Optional[Account]:
    """Actualizar una cuenta existente"""
    db_account = get_account(db, account_id, user_id)
    if not db_account:
        return None

    update_data = account.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_account, key, value)

    # Recompute available_credit if any credit field changed
    if any(k in update_data for k in ("credit_limit", "current_balance_used")):
        limit = db_account.credit_limit
        used = db_account.current_balance_used or 0
        db_account.available_credit = (limit - used) if limit else None

    db.commit()
    db.refresh(db_account)
    return db_account

def delete_account(db: Session, account_id: UUID, user_id: UUID) -> bool:
    """Eliminar una cuenta"""
    db_account = get_account(db, account_id, user_id)
    if not db_account:
        return False

    db.delete(db_account)
    db.commit()
    return True


def _recompute_available(account: Account) -> None:
    if account.credit_limit:
        account.available_credit = account.credit_limit - (account.current_balance_used or Decimal(0))


def pay_card_month(
    db: Session,
    account_id: UUID,
    user_id: UUID,
    new_balance_used: Optional[Decimal] = None,
) -> Optional[Account]:
    """Mark the card as paid for this month: advance all linked MSIs by one installment.

    new_balance_used: if provided, set credit used to this value directly (user override).
    Otherwise, auto-deduct each MSI's monthly_amount from the current balance.
    """
    from app.models.installment_purchase import InstallmentPurchase

    account = get_account(db, account_id, user_id)
    if not account:
        return None

    today = date.today()
    active_msi = db.query(InstallmentPurchase).filter(
        InstallmentPurchase.account_id == account_id,
        InstallmentPurchase.remaining_installments > 0,
    ).all()

    for msi in active_msi:
        msi.remaining_installments = msi.remaining_installments - 1
        msi.paid_month = today.month
        msi.paid_year = today.year

    if new_balance_used is not None:
        account.current_balance_used = new_balance_used
    else:
        for msi in active_msi:
            account.current_balance_used = (account.current_balance_used or Decimal(0)) - msi.monthly_amount

    if account.current_balance_used is not None and account.current_balance_used < Decimal(0):
        account.current_balance_used = Decimal(0)

    _recompute_available(account)
    db.commit()
    db.refresh(account)
    return account


def liquidate_card(db: Session, account_id: UUID, user_id: UUID) -> Optional[Account]:
    """Liquidate the card: pay off all linked MSIs entirely and zero the balance."""
    from app.models.installment_purchase import InstallmentPurchase

    account = get_account(db, account_id, user_id)
    if not account:
        return None

    active_msi = db.query(InstallmentPurchase).filter(
        InstallmentPurchase.account_id == account_id,
        InstallmentPurchase.remaining_installments > 0,
    ).all()

    for msi in active_msi:
        msi.remaining_installments = 0

    account.current_balance_used = Decimal(0)
    account.available_credit = account.credit_limit or Decimal(0)
    db.commit()
    db.refresh(account)
    return account