from typing import List, Optional
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.user_list import UserList, ListItem
from app.schemas.user_list import ListCreate, ListUpdate, ListItemCreate, ListItemUpdate


def _get_list(db: Session, list_id: UUID, user_id: UUID) -> Optional[UserList]:
    return (
        db.query(UserList)
        .options(joinedload(UserList.items))
        .filter(UserList.id == list_id, UserList.user_id == user_id)
        .first()
    )


def _touch(db: Session, lst: UserList) -> None:
    """Child changes don't trigger onupdate, so bump updated_at (drives 'most recent')."""
    lst.updated_at = func.now()
    db.commit()
    db.refresh(lst)


def get_lists(db: Session, user_id: UUID) -> List[UserList]:
    return (
        db.query(UserList)
        .options(joinedload(UserList.items))
        .filter(UserList.user_id == user_id)
        .order_by(UserList.updated_at.desc())
        .all()
    )


def create_list(db: Session, data: ListCreate, user_id: UUID) -> UserList:
    lst = UserList(user_id=user_id, name=data.name.strip(), emoji=data.emoji or "📝")
    db.add(lst)
    db.commit()
    return _get_list(db, lst.id, user_id)


def update_list(db: Session, list_id: UUID, data: ListUpdate, user_id: UUID) -> Optional[UserList]:
    lst = _get_list(db, list_id, user_id)
    if not lst:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(lst, field, value.strip() if field == "name" else value)
    _touch(db, lst)
    return lst


def delete_list(db: Session, list_id: UUID, user_id: UUID) -> bool:
    lst = _get_list(db, list_id, user_id)
    if not lst:
        return False
    db.delete(lst)
    db.commit()
    return True


def add_item(db: Session, list_id: UUID, data: ListItemCreate, user_id: UUID) -> Optional[UserList]:
    lst = _get_list(db, list_id, user_id)
    if not lst:
        return None
    position = max((i.position for i in lst.items), default=-1) + 1
    db.add(ListItem(list_id=lst.id, text=data.text.strip(), position=position))
    db.flush()
    db.refresh(lst)
    _touch(db, lst)
    return lst


def update_item(
    db: Session, list_id: UUID, item_id: UUID, data: ListItemUpdate, user_id: UUID
) -> Optional[UserList]:
    lst = _get_list(db, list_id, user_id)
    if not lst:
        return None
    item = next((i for i in lst.items if i.id == item_id), None)
    if not item:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(item, field, value.strip() if field == "text" else value)
    _touch(db, lst)
    return lst


def delete_item(db: Session, list_id: UUID, item_id: UUID, user_id: UUID) -> Optional[UserList]:
    lst = _get_list(db, list_id, user_id)
    if not lst:
        return None
    item = next((i for i in lst.items if i.id == item_id), None)
    if not item:
        return None
    db.delete(item)
    db.flush()
    db.refresh(lst)
    _touch(db, lst)
    return lst


def clear_completed(db: Session, list_id: UUID, user_id: UUID) -> Optional[UserList]:
    lst = _get_list(db, list_id, user_id)
    if not lst:
        return None
    for item in [i for i in lst.items if i.is_done]:
        db.delete(item)
    db.flush()
    db.refresh(lst)
    _touch(db, lst)
    return lst
