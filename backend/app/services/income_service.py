from typing import List
from uuid import UUID
from datetime import date
from sqlalchemy.orm import Session
from app.models.income import Income
from app.models.account import Account, AccountType
from app.schemas.income import IncomeCreate, IncomeUpdate


def get_incomes(db: Session, user_id: UUID) -> List[Income]:
    return db.query(Income).filter(Income.user_id == user_id).order_by(Income.date.desc()).all()


def get_income(db: Session, user_id: UUID, income_id: UUID) -> Income | None:
    return db.query(Income).filter(Income.id == income_id, Income.user_id == user_id).first()


def _credit_account(db: Session, user_id: UUID, account_id, amount):
    """Add amount to account balance (for non-credit accounts)."""
    if not account_id:
        return
    account = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
    if account and account.account_type != AccountType.CREDIT_CARD:
        account.balance = (account.balance or 0) + amount


def _debit_account(db: Session, user_id: UUID, account_id, amount):
    """Remove amount from account balance (refund on delete)."""
    if not account_id:
        return
    account = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
    if account and account.account_type != AccountType.CREDIT_CARD:
        account.balance = (account.balance or 0) - amount


def create_income(db: Session, user_id: UUID, income: IncomeCreate) -> Income:
    db_income = Income(
        user_id=user_id,
        account_id=income.account_id,
        description=income.description,
        amount=income.amount,
        date=income.income_date,
        category=income.category,
    )
    db.add(db_income)
    _credit_account(db, user_id, income.account_id, income.amount)
    db.commit()
    db.refresh(db_income)
    return db_income


def update_income(db: Session, user_id: UUID, income_id: UUID, income: IncomeUpdate) -> Income | None:
    db_income = get_income(db, user_id, income_id)
    if not db_income:
        return None

    old_amount = db_income.amount
    old_account_id = db_income.account_id

    if income.description is not None:
        db_income.description = income.description
    if income.amount is not None:
        db_income.amount = income.amount
    if income.income_date is not None:
        db_income.date = income.income_date
    if income.category is not None:
        db_income.category = income.category
    if income.account_id is not None:
        db_income.account_id = income.account_id

    # Adjust account balances if amount or account changed
    new_amount = db_income.amount
    new_account_id = db_income.account_id

    if old_account_id != new_account_id:
        # Reverse old, apply new
        _debit_account(db, user_id, old_account_id, old_amount)
        _credit_account(db, user_id, new_account_id, new_amount)
    elif old_amount != new_amount and new_account_id:
        diff = new_amount - old_amount
        _credit_account(db, user_id, new_account_id, diff)

    db.commit()
    db.refresh(db_income)
    return db_income


def delete_income(db: Session, user_id: UUID, income_id: UUID) -> bool:
    db_income = get_income(db, user_id, income_id)
    if not db_income:
        return False
    _debit_account(db, user_id, db_income.account_id, db_income.amount)
    db.delete(db_income)
    db.commit()
    return True
