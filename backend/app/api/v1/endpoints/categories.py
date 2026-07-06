from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoriesResponse, CustomCategoryResponse
from app.services.category_service import (
    DEFAULT_CATEGORIES,
    get_custom_categories,
    create_custom_category,
    delete_custom_category,
)

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=CategoriesResponse)
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    custom = get_custom_categories(db, current_user.id)
    return CategoriesResponse(
        default=DEFAULT_CATEGORIES,
        custom=[CustomCategoryResponse.model_validate(c) for c in custom],
    )


@router.post("/", response_model=CustomCategoryResponse, status_code=status.HTTP_201_CREATED)
def add_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    return create_custom_category(db, data, current_user.id)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not delete_custom_category(db, category_id, current_user.id):
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
