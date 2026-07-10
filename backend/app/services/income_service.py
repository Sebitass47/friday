from typing import List
from uuid import UUID
from datetime import date
from sqlalchemy.orm import Session
from app.models.income import Income
from app.schemas.income import IncomeCreate, IncomeUpdate


def get_incomes(db: Session, user_id: UUID) -> List[Income]:
    return db.query(Income).filter(Income.user_id == user_id).order_by(Income.date.desc()).all()


def get_income(db: Session, user_id: UUID, income_id: UUID) -> Income | None:
    return db.query(Income).filter(Income.id == income_id, Income.user_id == user_id).first()


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
    db.commit()
    db.refresh(db_income)
    return db_income


def update_income(db: Session, user_id: UUID, income_id: UUID, income: IncomeUpdate) -> Income | None:
    db_income = get_income(db, user_id, income_id)
    if not db_income:
        return None

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

    db.commit()
    db.refresh(db_income)
    return db_income


def delete_income(db: Session, user_id: UUID, income_id: UUID) -> bool:
    db_income = get_income(db, user_id, income_id)
    if not db_income:
        return False
    db.delete(db_income)
    db.commit()
    return True
