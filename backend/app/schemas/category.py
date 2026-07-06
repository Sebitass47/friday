from uuid import UUID
from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str


class CustomCategoryResponse(BaseModel):
    id: UUID
    name: str

    class Config:
        from_attributes = True


class CategoriesResponse(BaseModel):
    default: list[str]
    custom: list[CustomCategoryResponse]
