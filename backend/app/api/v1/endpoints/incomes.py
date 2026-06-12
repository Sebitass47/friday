from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.income_service import (
    get_incomes,
    get_income,
    create_income,
    update_income,
    delete_income,
)
from app.schemas.income import IncomeCreate, IncomeUpdate, IncomeResponse

router = APIRouter()


@router.get("/", response_model=List[IncomeResponse])
def list_incomes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_incomes(db, current_user.id)


@router.post("/", response_model=IncomeResponse, status_code=201)
def add_income(
    income: IncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_income(db, current_user.id, income)


@router.get("/{income_id}", response_model=IncomeResponse)
def get_single_income(
    income_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_income = get_income(db, current_user.id, income_id)
    if not db_income:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    return db_income


@router.patch("/{income_id}", response_model=IncomeResponse)
def modify_income(
    income_id: UUID,
    income: IncomeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_income = update_income(db, current_user.id, income_id, income)
    if not db_income:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    return db_income


@router.delete("/{income_id}", status_code=204)
def remove_income(
    income_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not delete_income(db, current_user.id, income_id):
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
