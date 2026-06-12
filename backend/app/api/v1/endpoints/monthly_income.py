from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.monthly_income_service import get_monthly_income, upsert_monthly_income
from app.schemas.monthly_income import MonthlyIncomeCreate, MonthlyIncomeResponse

router = APIRouter(prefix="/monthly-income", tags=["monthly-income"])


@router.get("/", response_model=MonthlyIncomeResponse)
def read_monthly_income(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    income = get_monthly_income(db, current_user.id)
    if not income:
        raise HTTPException(status_code=404, detail="Ingreso mensual no configurado")
    return income


@router.put("/", response_model=MonthlyIncomeResponse)
def set_monthly_income(
    income: MonthlyIncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return upsert_monthly_income(db, income, current_user.id)
