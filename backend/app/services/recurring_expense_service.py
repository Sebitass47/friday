from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.recurring_expense import RecurringExpense
from app.schemas.recurring_expense import RecurringExpenseCreate, RecurringExpenseUpdate


def get_recurring_expenses(db: Session, user_id: UUID) -> List[RecurringExpense]:
    return db.query(RecurringExpense).filter(RecurringExpense.user_id == user_id).all()


def get_recurring_expense(db: Session, expense_id: UUID, user_id: UUID) -> Optional[RecurringExpense]:
    return db.query(RecurringExpense).filter(
        RecurringExpense.id == expense_id,
        RecurringExpense.user_id == user_id
    ).first()


def create_recurring_expense(db: Session, expense: RecurringExpenseCreate, user_id: UUID) -> RecurringExpense:
    db_expense = RecurringExpense(
        user_id=user_id,
        name=expense.name,
        amount=expense.amount,
        frequency=expense.frequency,
        interval_days=expense.interval_days,
    )
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
