from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import date
import math
from sqlalchemy.orm import Session
from app.models.savings_goal import SavingsGoal
from app.schemas.savings_goal import SavingsGoalCreate, SavingsGoalUpdate


def _estimated_completion(goal: SavingsGoal) -> Optional[date]:
    remaining = goal.target_amount - goal.current_amount
    if remaining <= 0:
        return date.today()
    if not goal.monthly_contribution or goal.monthly_contribution <= 0:
        return None
    months_needed = math.ceil(float(remaining) / float(goal.monthly_contribution))
    today = date.today()
    year = today.year + (today.month - 1 + months_needed) // 12
    month = (today.month - 1 + months_needed) % 12 + 1
    return date(year, month, 1)


def get_savings_goals(db: Session, user_id: UUID) -> List[SavingsGoal]:
    return db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id).all()


def get_savings_goal(db: Session, goal_id: UUID, user_id: UUID) -> Optional[SavingsGoal]:
    return db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == user_id,
    ).first()


def create_savings_goal(db: Session, goal: SavingsGoalCreate, user_id: UUID) -> SavingsGoal:
    db_goal = SavingsGoal(
        user_id=user_id,
        name=goal.name,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        monthly_contribution=goal.monthly_contribution,
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal


def update_savings_goal(
    db: Session, goal_id: UUID, goal: SavingsGoalUpdate, user_id: UUID
) -> Optional[SavingsGoal]:
    db_goal = get_savings_goal(db, goal_id, user_id)
    if not db_goal:
        return None

    update_data = goal.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_goal, key, value)

    db.commit()
    db.refresh(db_goal)
    return db_goal


def delete_savings_goal(db: Session, goal_id: UUID, user_id: UUID) -> bool:
    db_goal = get_savings_goal(db, goal_id, user_id)
    if not db_goal:
        return False

    db.delete(db_goal)
    db.commit()
    return True


def enrich_with_completion_date(goal: SavingsGoal) -> dict:
    data = {c.name: getattr(goal, c.name) for c in goal.__table__.columns}
    data["estimated_completion_date"] = _estimated_completion(goal)
    return data
