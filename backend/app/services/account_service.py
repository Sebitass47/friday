from typing import List, Optional
from uuid import UUID
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