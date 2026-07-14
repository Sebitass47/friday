from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import date
from sqlalchemy.orm import Session
from app.models.recurring_expense import RecurringExpense
from app.models.account import Account, AccountType
from app.schemas.recurring_expense import RecurringExpenseCreate, RecurringExpenseUpdate


def _adjust_card_balance(account: Account, delta: Decimal) -> None:
    account.current_balance_used = (account.current_balance_used or Decimal(0)) + delta
    if account.credit_limit:
        account.available_credit = account.credit_limit - account.current_balance_used


def _load_credit_account(db: Session, account_id: UUID, user_id: UUID) -> Optional[Account]:
    account = db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first()
    if account and account.account_type == AccountType.CREDIT_CARD:
        return account
    return None


def get_recurring_expenses(db: Session, user_id: UUID) -> List[RecurringExpense]:
    return db.query(RecurringExpense).filter(RecurringExpense.user_id == user_id).all()


def get_recurring_expense(db: Session, expense_id: UUID, user_id: UUID) -> Optional[RecurringExpense]:
    return db.query(RecurringExpense).filter(
        RecurringExpense.id == expense_id,
        RecurringExpense.user_id == user_id
    ).first()


def create_recurring_expense(db: Session, expense: RecurringExpenseCreate, user_id: UUID) -> RecurringExpense:
    today = date.today()
    db_expense = RecurringExpense(
        user_id=user_id,
        account_id=expense.account_id,
        name=expense.name,
        amount=expense.amount,
        frequency=expense.frequency,
        interval_days=expense.interval_days,
    )

    if expense.account_id:
        card = _load_credit_account(db, expense.account_id, user_id)
        if card:
            _adjust_card_balance(card, Decimal(str(expense.amount)))
            db_expense.last_charged_date = today

    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


def update_recurring_expense(
    db: Session, expense_id: UUID, expense: RecurringExpenseUpdate, user_id: UUID
) -> Optional[RecurringExpense]:
    db_expense = get_recurring_expense(db, expense_id, user_id)
    if not db_expense:
        return None

    update_data = expense.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_expense, key, value)

    db.commit()
    db.refresh(db_expense)
    return db_expense


def delete_recurring_expense(db: Session, expense_id: UUID, user_id: UUID) -> bool:
    db_expense = get_recurring_expense(db, expense_id, user_id)
    if not db_expense:
        return False

    db.delete(db_expense)
    db.commit()
    return True
