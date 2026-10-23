"""The people you split with, what they owe you, and the payments they make."""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.clock import today_local
from app.models.account import Account, AccountType
from app.models.people import Person, PersonDebt, PersonPayment, PaymentAllocation
from app.schemas.people import PaymentCreate

ZERO = Decimal("0")


def _dec(v) -> Decimal:
    return Decimal(str(v if v is not None else 0))


def _get(db: Session, user_id: UUID, person_id: UUID) -> Person:
    p = db.query(Person).filter(Person.id == person_id, Person.user_id == user_id).first()
    if not p:
        raise ValueError("Persona no encontrada")
    return p


def _due_pending(db: Session, user_id: UUID):
    """Debts already charged (not future MSI months) with something left to collect."""
    return db.query(PersonDebt).filter(
        PersonDebt.user_id == user_id,
        PersonDebt.charge_date <= today_local(),
        PersonDebt.amount > PersonDebt.settled_amount,
    )


# ── People ────────────────────────────────────────────────────────────────────

def list_people(db: Session, user_id: UUID) -> List[dict]:
    people = db.query(Person).filter(Person.user_id == user_id).order_by(Person.name).all()
    rows = (
        _due_pending(db, user_id)
        .with_entities(PersonDebt.person_id, func.sum(PersonDebt.amount - PersonDebt.settled_amount), func.count(PersonDebt.id))
        .group_by(PersonDebt.person_id).all()
    )
    pend = {pid: (_dec(total), n) for pid, total, n in rows}
    return [{"id": p.id, "name": p.name, "pending_total": pend.get(p.id, (ZERO, 0))[0], "pending_count": pend.get(p.id, (ZERO, 0))[1]} for p in people]


def create_person(db: Session, user_id: UUID, name: str) -> Person:
    name = " ".join(name.split())
    existing = db.query(Person).filter(Person.user_id == user_id, func.lower(Person.name) == name.lower()).first()
    if existing:
        return existing
    p = Person(user_id=user_id, name=name)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def rename_person(db: Session, user_id: UUID, person_id: UUID, name: str) -> Person:
    p = _get(db, user_id, person_id)
    p.name = " ".join(name.split())
    db.commit()
    db.refresh(p)
    return p


def delete_person(db: Session, user_id: UUID, person_id: UUID) -> None:
    p = _get(db, user_id, person_id)
    if db.query(PersonDebt).filter(PersonDebt.person_id == p.id, PersonDebt.amount > PersonDebt.settled_amount).count():
        raise ValueError("Esa persona todavía tiene cobros pendientes")
    db.delete(p)
    db.commit()


def pending_debts(db: Session, user_id: UUID, person_id: UUID) -> List[dict]:
    _get(db, user_id, person_id)
    debts = _due_pending(db, user_id).filter(PersonDebt.person_id == person_id).order_by(PersonDebt.charge_date, PersonDebt.created_at).all()
    accounts = {a.id: a.name for a in db.query(Account).filter(Account.user_id == user_id).all()}
    return [{
        "id": d.id, "description": d.description, "amount": d.amount,
        "pending": _dec(d.amount) - _dec(d.settled_amount), "charge_date": d.charge_date,
        "source": "installment" if d.installment_id else "expense",
        "account_name": accounts.get(d.account_id),
    } for d in debts]


# ── Payments received ─────────────────────────────────────────────────────────

def _payment_dict(db: Session, p: PersonPayment, person_name: str) -> dict:
    allocs = (
        db.query(PaymentAllocation, PersonDebt.description)
        .join(PersonDebt, PersonDebt.id == PaymentAllocation.debt_id)
        .filter(PaymentAllocation.payment_id == p.id).all()
    )
    allocated = [{"debt_id": a.debt_id, "description": desc, "amount": a.amount} for a, desc in allocs]
    return {
        "id": p.id, "person_id": p.person_id, "person_name": person_name, "amount": p.amount,
        "date": p.date, "account_id": p.account_id, "note": p.note, "allocated": allocated,
        "unallocated": _dec(p.amount) - sum((_dec(a["amount"]) for a in allocated), ZERO),
    }


def create_payment(db: Session, user_id: UUID, person_id: UUID, data: PaymentCreate) -> dict:
    person = _get(db, user_id, person_id)
    account: Optional[Account] = None
    if data.account_id:
        account = db.query(Account).filter(Account.id == data.account_id, Account.user_id == user_id).first()
        if not account:
            raise ValueError("Cuenta no encontrada")

    payment = PersonPayment(user_id=user_id, person_id=person.id, amount=data.amount, date=data.date,
                            account_id=data.account_id, note=data.note)
    db.add(payment)
    db.flush()

    pending = {d.id: d for d in _due_pending(db, user_id).filter(PersonDebt.person_id == person.id)
               .order_by(PersonDebt.charge_date, PersonDebt.created_at).all()}
    # Picked debts first, in the order given; whatever is left cascades to the oldest pending ones
    order = [i for i in data.debt_ids if i in pending] + [i for i in pending if i not in set(data.debt_ids)]
    remaining = _dec(data.amount)
    for debt_id in order:
        if remaining <= 0:
            break
        d = pending[debt_id]
        take = min(_dec(d.amount) - _dec(d.settled_amount), remaining)
        if take <= 0:
            continue
        d.settled_amount = _dec(d.settled_amount) + take
        db.add(PaymentAllocation(payment_id=payment.id, debt_id=d.id, amount=take))
        remaining -= take

    # The deposit lands in a real account, but it is NOT income: it never touches "disponible"
    if account and account.account_type != AccountType.CREDIT_CARD:
        account.balance = _dec(account.balance) + _dec(data.amount)

    db.commit()
    db.refresh(payment)
    return _payment_dict(db, payment, person.name)


def delete_payment(db: Session, user_id: UUID, payment_id: UUID) -> None:
    p = db.query(PersonPayment).filter(PersonPayment.id == payment_id, PersonPayment.user_id == user_id).first()
    if not p:
        raise ValueError("Cobro no encontrado")
    for a in db.query(PaymentAllocation).filter(PaymentAllocation.payment_id == p.id).all():
        debt = db.query(PersonDebt).filter(PersonDebt.id == a.debt_id).first()
        if debt:
            debt.settled_amount = max(_dec(debt.settled_amount) - _dec(a.amount), ZERO)
    if p.account_id:
        account = db.query(Account).filter(Account.id == p.account_id).first()
        if account and account.account_type != AccountType.CREDIT_CARD:
            account.balance = _dec(account.balance) - _dec(p.amount)
    db.delete(p)
    db.commit()


def list_payments(db: Session, user_id: UUID, person_id: UUID, limit: int = 20) -> List[dict]:
    person = _get(db, user_id, person_id)
    rows = (
        db.query(PersonPayment).filter(PersonPayment.person_id == person.id, PersonPayment.user_id == user_id)
        .order_by(PersonPayment.date.desc(), PersonPayment.created_at.desc()).limit(limit).all()
    )
    return [_payment_dict(db, p, person.name) for p in rows]
