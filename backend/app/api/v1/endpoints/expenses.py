from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.expense_service import (
    get_expenses,
    get_expenses_for_month,
    get_expenses_for_credit_statement,
    get_expense,
    create_expense,
    update_expense,
    delete_expense,
)
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("/", response_model=List[ExpenseResponse])
def list_expenses(
    year: Optional[int] = Query(None, description="Año para filtrar"),
    month: Optional[int] = Query(None, description="Mes para filtrar"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener gastos del usuario"""
    if year and month:
        return get_expenses_for_month(db, current_user.id, year, month)
    return get_expenses(db, current_user.id)


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense_endpoint(
    expense: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear un nuevo gasto"""
    try:
        return create_expense(db, expense, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{expense_id}", response_model=ExpenseResponse)
def read_expense(
    expense_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener detalles de un gasto"""
    db_expense = get_expense(db, expense_id, current_user.id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return db_expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense_endpoint(
    expense_id: UUID,
    expense_update: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualizar un gasto"""
    db_expense = update_expense(db, expense_id, expense_update, current_user.id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return db_expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense_endpoint(
    expense_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Eliminar un gasto"""
    success = delete_expense(db, expense_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return None
