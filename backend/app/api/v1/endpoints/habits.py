from datetime import date
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.habit import HabitCreate, HabitResponse, HabitToggleRequest
from app.services import habit_service

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("/", response_model=List[HabitResponse])
def list_habits(
    week_start: date = Query(..., description="ISO date of the week's Monday"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return habit_service.get_habits(db, current_user.id, week_start)


@router.post("/", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
def create_habit(
    data: HabitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = habit_service.create_habit(db, data, current_user.id)
    return {
        "id": habit.id,
        "name": habit.name,
        "color": habit.color,
        "created_at": habit.created_at,
        "completed_dates": [],
        "week_percentage": 0,
    }


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not habit_service.delete_habit(db, habit_id, current_user.id):
        raise HTTPException(status_code=404, detail="Hábito no encontrado")


@router.post("/{habit_id}/toggle", status_code=status.HTTP_200_OK)
def toggle_habit(
    habit_id: UUID,
    data: HabitToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = habit_service.toggle_log(db, habit_id, data.date, current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Hábito no encontrado")
    return result
