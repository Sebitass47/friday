from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.savings_goal_service import (
    get_savings_goals,
    get_savings_goal,
    create_savings_goal,
    update_savings_goal,
    delete_savings_goal,
    enrich_with_completion_date,
)
from app.schemas.savings_goal import (
    SavingsGoalCreate,
    SavingsGoalUpdate,
    SavingsGoalResponse,
)

router = APIRouter(prefix="/savings-goals", tags=["savings-goals"])


@router.get("/", response_model=List[SavingsGoalResponse])
def read_savings_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goals = get_savings_goals(db, current_user.id)
    return [enrich_with_completion_date(g) for g in goals]


@router.post("/", response_model=SavingsGoalResponse, status_code=status.HTTP_201_CREATED)
def create_savings_goal_endpoint(
    goal: SavingsGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_goal = create_savings_goal(db, goal, current_user.id)
    return enrich_with_completion_date(db_goal)


@router.get("/{goal_id}", response_model=SavingsGoalResponse)
def read_savings_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_goal = get_savings_goal(db, goal_id, current_user.id)
    if not db_goal:
        raise HTTPException(status_code=404, detail="Meta de ahorro no encontrada")
    return enrich_with_completion_date(db_goal)


@router.put("/{goal_id}", response_model=SavingsGoalResponse)
def update_savings_goal_endpoint(
    goal_id: UUID,
    goal: SavingsGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_goal = update_savings_goal(db, goal_id, goal, current_user.id)
    if not db_goal:
        raise HTTPException(status_code=404, detail="Meta de ahorro no encontrada")
    return enrich_with_completion_date(db_goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_savings_goal_endpoint(
    goal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = delete_savings_goal(db, goal_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Meta de ahorro no encontrada")
