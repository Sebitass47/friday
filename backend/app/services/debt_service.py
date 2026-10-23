"""Splitting card charges with other people.

Convention: `Expense.amount` / `InstallmentPurchase.monthly_amount` stay *your* part, so every
existing 'disponible' / chart / projection keeps working untouched. What the bank actually charges
(and what moves a card balance) is your part + the others' parts, stored as `person_debts`."""
import calendar
from datetime import date
from decimal import Decimal
from typing import Dict, Iterable, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.expense import Expense
from app.models.installment_purchase import InstallmentPurchase
from app.models.people import Person, PersonDebt, InstallmentShare
from app.schemas.people import ShareIn, InstallmentShareIn

ZERO = Decimal("0")


def add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    y, mo = d.year + m // 12, m % 12 + 1
    return date(y, mo, min(d.day, calendar.monthrange(y, mo)[1]))


def statement_of(charge_date: date, closing_day: int) -> tuple[int, int]:
    """(month, year) of the statement a charge lands on; same rule as card expenses."""
    from app.services.expense_service import _calculate_credit_statement_month
    return _calculate_credit_statement_month(charge_date, closing_day)


def _check_people(db: Session, user_id: UUID, person_ids: Iterable[UUID]) -> Dict[UUID, Person]:
    ids = set(person_ids)
    people = {p.id: p for p in db.query(Person).filter(Person.user_id == user_id, Person.id.in_(ids)).all()} if ids else {}
    if len(people) != len(ids):
        raise ValueError("Persona no encontrada")
    return people


# ── Expenses ──────────────────────────────────────────────────────────────────

def expense_total(db: Session, expense: Expense) -> Decimal:
    """What the card/account really paid: your part + everyone else's."""
    others = db.query(func.coalesce(func.sum(PersonDebt.amount), 0)).filter(PersonDebt.expense_id == expense.id).scalar()
    return Decimal(str(expense.amount)) + Decimal(str(others))


def set_expense_shares(db: Session, user_id: UUID, expense: Expense, shares: List[ShareIn]) -> None:
    existing = db.query(PersonDebt).filter(PersonDebt.expense_id == expense.id).all()
    if any(d.settled_amount and d.settled_amount > 0 for d in existing):
        raise ValueError("Este gasto ya tiene cobros aplicados; no se puede cambiar el reparto")
    _check_people(db, user_id, (s.person_id for s in shares))
    for d in existing:
        db.delete(d)
    db.flush()
    for s in shares:
        db.add(PersonDebt(
            user_id=user_id, person_id=s.person_id, description=expense.name, amount=s.amount,
            charge_date=expense.date, expense_id=expense.id, account_id=expense.account_id,
            statement_month=expense.credit_statement_month, statement_year=expense.credit_statement_year,
        ))
    db.flush()


def sync_expense_debts(db: Session, expense: Expense) -> None:
    """Keep the debts' name/date/card/statement in step when the expense itself is edited."""
    for d in db.query(PersonDebt).filter(PersonDebt.expense_id == expense.id).all():
        d.description = expense.name
        d.charge_date = expense.date
        d.account_id = expense.account_id
        d.statement_month = expense.credit_statement_month
        d.statement_year = expense.credit_statement_year


def annotate_expenses(db: Session, expenses: List[Expense]) -> None:
    """Attach total_amount + shares so ExpenseResponse can show 'tu parte $500 de $1,000'."""
    if not expenses:
        return
    rows = (
        db.query(PersonDebt, Person.name)
        .join(Person, Person.id == PersonDebt.person_id)
        .filter(PersonDebt.expense_id.in_([e.id for e in expenses]))
        .all()
    )
    by_exp: Dict[UUID, list] = {}
    for d, name in rows:
        by_exp.setdefault(d.expense_id, []).append(
            {"person_id": d.person_id, "person_name": name, "amount": d.amount, "settled": d.settled_amount or ZERO}
        )
    for e in expenses:
        shares = by_exp.get(e.id, [])
        e.shares = shares
        e.total_amount = Decimal(str(e.amount)) + sum((Decimal(str(s["amount"])) for s in shares), ZERO)


# ── MSI ───────────────────────────────────────────────────────────────────────

def total_monthly(db: Session, purchase: InstallmentPurchase) -> Decimal:
    """What the card is charged each month: your part + everyone else's."""
    others = db.query(func.coalesce(func.sum(InstallmentShare.monthly_amount), 0)).filter(
        InstallmentShare.installment_id == purchase.id
    ).scalar()
    return Decimal(str(purchase.monthly_amount)) + Decimal(str(others))


def ensure_installment_debts(db: Session, user_id: UUID, purchase: InstallmentPurchase) -> None:
    """Create the missing monthly debts for every share of this MSI (never deletes any)."""
    shares = db.query(InstallmentShare).filter(InstallmentShare.installment_id == purchase.id).all()
    if not shares:
        return
    account = db.query(Account).filter(Account.id == purchase.account_id).first() if purchase.account_id else None
    closing = account.closing_day if account else None
    existing = {
        (d.installment_index, d.person_id)
        for d in db.query(PersonDebt).filter(PersonDebt.installment_id == purchase.id).all()
    }
    first = max(purchase.total_installments - purchase.remaining_installments, 0)
    for i in range(first, purchase.total_installments):
        charge = add_months(purchase.start_date, i)
        month, year = statement_of(charge, closing) if closing else (None, None)
        for s in shares:
            if (i, s.person_id) in existing:
                continue
            db.add(PersonDebt(
                user_id=user_id, person_id=s.person_id,
                description=f"{purchase.name} ({i + 1}/{purchase.total_installments})",
                amount=s.monthly_amount, charge_date=charge,
                installment_id=purchase.id, installment_index=i, account_id=purchase.account_id,
                statement_month=month, statement_year=year,
            ))
    db.flush()


def set_installment_shares(db: Session, user_id: UUID, purchase: InstallmentPurchase, shares: List[InstallmentShareIn]) -> None:
    _check_people(db, user_id, (s.person_id for s in shares))
    db.query(InstallmentShare).filter(InstallmentShare.installment_id == purchase.id).delete()
    # Debts already (partly) collected are history: keep them, rebuild only the untouched ones
    db.query(PersonDebt).filter(
        PersonDebt.installment_id == purchase.id, PersonDebt.settled_amount == 0
    ).delete()
    for s in shares:
        db.add(InstallmentShare(installment_id=purchase.id, person_id=s.person_id, monthly_amount=s.monthly_amount))
    db.flush()
    ensure_installment_debts(db, user_id, purchase)


def annotate_installments(db: Session, purchases: List[InstallmentPurchase]) -> None:
    if not purchases:
        return
    rows = (
        db.query(InstallmentShare, Person.name)
        .join(Person, Person.id == InstallmentShare.person_id)
        .filter(InstallmentShare.installment_id.in_([p.id for p in purchases]))
        .all()
    )
    by_p: Dict[UUID, list] = {}
    for s, name in rows:
        by_p.setdefault(s.installment_id, []).append(
            {"person_id": s.person_id, "person_name": name, "monthly_amount": s.monthly_amount}
        )
    for p in purchases:
        shares = by_p.get(p.id, [])
        p.shares = shares
        p.total_monthly = Decimal(str(p.monthly_amount)) + sum((Decimal(str(s["monthly_amount"])) for s in shares), ZERO)
