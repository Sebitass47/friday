from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.recurring_expense_service import (
    get_recurring_expenses,
    get_recurring_expense,
    create_recurring_expense,
    update_recurring_expense,
    delete_recurring_expense,
)
from app.schemas.recurring_expense import (
    RecurringExpenseCreate,
    RecurringExpenseUpdate,
    RecurringExpenseResponse,
)

router = APIRouter(prefix="/recurring-expenses", tags=["recurring-expenses"])


@router.get("/", response_model=List[RecurringExpenseResponse])
def read_recurring_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_recurring_expenses(db, current_user.id)


@router.post("/", response_model=RecurringExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_recurring_expense_endpoint(
    expense: RecurringExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_recurring_expense(db, expense, current_user.id)


@router.get("/{expense_id}", response_model=RecurringExpenseResponse)
def read_recurring_expense(
    expense_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_expense = get_recurring_expense(db, expense_id, current_user.id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Gasto recurrente no encontrado")
    return db_expense


@router.put("/{expense_id}", response_model=RecurringExpenseResponse)
def update_recurring_expense_endpoint(
    expense_id: UUID,
    expense: RecurringExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_expense = update_recurring_expense(db, expense_id, expense, current_user.id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Gasto recurrente no encontrado")
    return db_expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_expense_endpoint(
    expense_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = delete_recurring_expense(db, expense_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Gasto recurrente no encontrado")
