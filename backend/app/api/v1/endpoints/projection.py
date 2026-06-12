from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.projection_service import calculate_projection, simulate_projection
from app.schemas.projection import ProjectionResponse, SimulateInstallmentRequest, SimulationResponse

router = APIRouter(prefix="/projection", tags=["projection"])


@router.get("/", response_model=ProjectionResponse)
def get_projection(
    months: int = Query(default=12, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return calculate_projection(db, current_user.id, months)


@router.post("/simulate", response_model=SimulationResponse)
def simulate(
    simulation: SimulateInstallmentRequest,
    months: int = Query(default=12, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return simulate_projection(db, current_user.id, simulation, months)
