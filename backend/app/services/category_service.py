from uuid import UUID
from sqlalchemy.orm import Session
from app.models.category import UserCategory
from app.schemas.category import CategoryCreate

DEFAULT_CATEGORIES = [
    "Alimentos",
    "Transporte",
    "Casa",
    "Salud",
    "Ocio",
    "Restaurantes",
    "Ropa",
    "Educación",
    "Tecnología",
    "Servicios",
    "Mascotas",
    "Viajes",
    "Otros",
]


def get_custom_categories(db: Session, user_id: UUID) -> list[UserCategory]:
    return db.query(UserCategory).filter(UserCategory.user_id == user_id).order_by(UserCategory.created_at).all()


def create_custom_category(db: Session, data: CategoryCreate, user_id: UUID) -> UserCategory:
    cat = UserCategory(user_id=user_id, name=data.name.strip())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def delete_custom_category(db: Session, category_id: UUID, user_id: UUID) -> bool:
    cat = db.query(UserCategory).filter(UserCategory.id == category_id, UserCategory.user_id == user_id).first()
    if not cat:
        return False
    db.delete(cat)
    db.commit()
    return True
