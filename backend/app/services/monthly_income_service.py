from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.monthly_income import MonthlyIncome
from app.schemas.monthly_income import MonthlyIncomeCreate, MonthlyIncomeUpdate


def get_monthly_income(db: Session, user_id: UUID) -> Optional[MonthlyIncome]:
    return db.query(MonthlyIncome).filter(MonthlyIncome.user_id == user_id).first()


def upsert_monthly_income(db: Session, income: MonthlyIncomeCreate, user_id: UUID) -> MonthlyIncome:
    db_income = get_monthly_income(db, user_id)
    if db_income:
        db_income.amount = income.amount
    else:
        db_income = MonthlyIncome(user_id=user_id, amount=income.amount)
        db.add(db_income)
    db.commit()
    db.refresh(db_income)
    return db_income
