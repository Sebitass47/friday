from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.people import (
    PersonCreate, PersonOut, PendingDebt, PaymentCreate, PaymentOut,
    ClosingResponse, StatementCheckIn,
)
from app.services import people_service, closing_service

router = APIRouter(tags=["people"])


def _bad(e: ValueError):
    raise HTTPException(status_code=400, detail=str(e))


@router.get("/people/", response_model=List[PersonOut])
def list_people(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return people_service.list_people(db, current_user.id)


@router.post("/people/", response_model=PersonOut, status_code=status.HTTP_201_CREATED)
def create_person(data: PersonCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = people_service.create_person(db, current_user.id, data.name)
    return next(x for x in people_service.list_people(db, current_user.id) if x["id"] == p.id)


@router.put("/people/{person_id}", response_model=PersonOut)
def rename_person(person_id: UUID, data: PersonCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        people_service.rename_person(db, current_user.id, person_id, data.name)
    except ValueError as e:
        _bad(e)
    return next(x for x in people_service.list_people(db, current_user.id) if x["id"] == person_id)


@router.delete("/people/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person(person_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        people_service.delete_person(db, current_user.id, person_id)
    except ValueError as e:
        _bad(e)


@router.get("/people/{person_id}/pending", response_model=List[PendingDebt])
def pending(person_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return people_service.pending_debts(db, current_user.id, person_id)
    except ValueError as e:
        _bad(e)


@router.get("/people/{person_id}/payments", response_model=List[PaymentOut])
def payments(person_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return people_service.list_payments(db, current_user.id, person_id)
    except ValueError as e:
        _bad(e)


@router.post("/people/{person_id}/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(person_id: UUID, data: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return people_service.create_payment(db, current_user.id, person_id, data)
    except ValueError as e:
        _bad(e)


@router.delete("/people/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        people_service.delete_payment(db, current_user.id, payment_id)
    except ValueError as e:
        _bad(e)


@router.get("/closing/", response_model=ClosingResponse)
def closing(month: Optional[int] = None, year: Optional[int] = None,
            db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return closing_service.get_closing(db, current_user.id, month, year)


@router.put("/closing/check", status_code=status.HTTP_204_NO_CONTENT)
def closing_check(data: StatementCheckIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        closing_service.set_statement_check(db, current_user.id, data.account_id, data.month, data.year, data.real_total)
    except ValueError as e:
        _bad(e)
