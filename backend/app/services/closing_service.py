"""'Cierre' view: for one statement month, per card, what the bank should show,
what is yours, what each person owes, and how far that is from the real statement."""
import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.clock import today_local
from app.models.account import Account, AccountType
from app.models.credit_payment import CreditPayment
from app.models.enums import PaymentMethod
from app.models.expense import Expense
from app.models.installment_purchase import InstallmentPurchase
from app.models.people import Person, PersonDebt, StatementCheck, InstallmentShare, RecurringCharge
from app.services.debt_service import add_months, statement_of
from app.services.projection_service import MONTHS_ES

ZERO = Decimal("0")


def _dec(v) -> Decimal:
    return Decimal(str(v if v is not None else 0))


def _closing_date(year: int, month: int, closing_day: int) -> date:
    return date(year, month, min(closing_day, calendar.monthrange(year, month)[1]))


def _prev(year: int, month: int) -> Tuple[int, int]:
    return (year - 1, 12) if month == 1 else (year, month - 1)


def default_statement(db: Session, user_id: UUID) -> Tuple[int, int]:
    """The statement of the most recent closing date that has already passed (what you'd be reviewing now)."""
    today = today_local()
    best: Optional[date] = None
    cards = db.query(Account).filter(
        Account.user_id == user_id, Account.account_type == AccountType.CREDIT_CARD, Account.closing_day.isnot(None)
    ).all()
    for c in cards:
        d = _closing_date(today.year, today.month, c.closing_day)
        if d > today:
            d = _closing_date(*_prev(today.year, today.month), c.closing_day)
        if best is None or d > best:
            best = d
    best = best or today
    return best.month, best.year


def _person_rows(debts: List[PersonDebt], names: Dict[UUID, str]) -> List[dict]:
    agg: Dict[UUID, List[Decimal]] = defaultdict(lambda: [ZERO, ZERO])
    for d in debts:
        agg[d.person_id][0] += _dec(d.amount)
        agg[d.person_id][1] += _dec(d.settled_amount)
    return [
        {"person_id": pid, "person_name": names.get(pid, "?"), "owed": o, "settled": s, "pending": o - s}
        for pid, (o, s) in sorted(agg.items(), key=lambda kv: names.get(kv[0], ""))
    ]


def get_closing(db: Session, user_id: UUID, month: Optional[int], year: Optional[int]) -> dict:
    if not month or not year:
        month, year = default_statement(db, user_id)

    names = {p.id: p.name for p in db.query(Person).filter(Person.user_id == user_id).all()}
    cards = db.query(Account).filter(
        Account.user_id == user_id, Account.account_type == AccountType.CREDIT_CARD,
        Account.closing_day.isnot(None), Account.is_active.is_(True),
    ).order_by(Account.name).all()

    out_cards: List[dict] = []
    all_debts: List[PersonDebt] = []

    for card in cards:
        debts = db.query(PersonDebt).filter(
            PersonDebt.user_id == user_id, PersonDebt.account_id == card.id,
            PersonDebt.statement_month == month, PersonDebt.statement_year == year,
        ).all()
        all_debts += debts
        by_expense: Dict[UUID, list] = defaultdict(list)
        by_msi: Dict[Tuple[UUID, int], list] = defaultdict(list)
        by_rc: Dict[UUID, list] = defaultdict(list)
        for d in debts:
            if d.expense_id:
                by_expense[d.expense_id].append(d)
            elif d.installment_id is not None:
                by_msi[(d.installment_id, d.installment_index)].append(d)
            elif d.recurring_charge_id:
                by_rc[d.recurring_charge_id].append(d)

        def shares_of(ds: List[PersonDebt]) -> List[dict]:
            return [{"person_id": d.person_id, "person_name": names.get(d.person_id, "?"),
                     "amount": d.amount, "settled": d.settled_amount or ZERO} for d in ds]

        charges: List[dict] = []
        mine = others = msi_total = ZERO

        expenses = db.query(Expense).filter(
            Expense.user_id == user_id, Expense.account_id == card.id, Expense.payment_method == PaymentMethod.CREDIT,
            Expense.credit_statement_month == month, Expense.credit_statement_year == year,
        ).order_by(Expense.date, Expense.created_at).all()
        for e in expenses:
            ds = by_expense.get(e.id, [])
            o = sum((_dec(d.amount) for d in ds), ZERO)
            charges.append({"kind": "expense", "id": e.id, "name": e.name, "date": e.date,
                            "mine": _dec(e.amount), "total": _dec(e.amount) + o, "shares": shares_of(ds)})
            mine += _dec(e.amount)
            others += o

        purchases = db.query(InstallmentPurchase).filter(
            InstallmentPurchase.user_id == user_id, InstallmentPurchase.account_id == card.id
        ).all()
        share_defs = defaultdict(list)
        for s in db.query(InstallmentShare).filter(InstallmentShare.installment_id.in_([p.id for p in purchases])).all() if purchases else []:
            share_defs[s.installment_id].append(s)
        for p in purchases:
            for i in range(p.total_installments):
                charge = add_months(p.start_date, i)
                if statement_of(charge, card.closing_day) != (month, year):
                    continue
                ds = by_msi.get((p.id, i), [])
                o = sum((_dec(d.amount) for d in ds), ZERO)
                charges.append({"kind": "installment", "id": p.id, "name": f"{p.name} ({i + 1}/{p.total_installments})",
                                "date": charge, "mine": _dec(p.monthly_amount), "total": _dec(p.monthly_amount) + o,
                                "shares": shares_of(ds)})
                mine += _dec(p.monthly_amount)
                others += o
                msi_total += _dec(p.monthly_amount) + o

        for rc in db.query(RecurringCharge).filter(
            RecurringCharge.user_id == user_id, RecurringCharge.account_id == card.id,
            RecurringCharge.statement_month == month, RecurringCharge.statement_year == year,
        ).all():
            ds = by_rc.get(rc.id, [])
            o = sum((_dec(d.amount) for d in ds), ZERO)
            charges.append({"kind": "recurring", "id": rc.id, "name": rc.name, "date": rc.charge_date,
                            "mine": _dec(rc.mine), "total": _dec(rc.mine) + o, "shares": shares_of(ds)})
            mine += _dec(rc.mine)
            others += o

        charges.sort(key=lambda c: c["date"])
        total = mine + others
        check = db.query(StatementCheck).filter(
            StatementCheck.account_id == card.id, StatementCheck.statement_month == month, StatementCheck.statement_year == year
        ).first()
        real = _dec(check.real_total) if check and check.real_total is not None else None
        paid = sum((_dec(p.amount_paid) for p in db.query(CreditPayment).filter(
            CreditPayment.user_id == user_id, CreditPayment.account_id == card.id,
            CreditPayment.statement_month == month, CreditPayment.statement_year == year).all()), ZERO)

        end = _closing_date(year, month, card.closing_day)
        start = _closing_date(*_prev(year, month), card.closing_day) + timedelta(days=1)
        out_cards.append({
            "account_id": card.id, "name": card.name, "closing_day": card.closing_day, "payment_day": card.payment_day,
            "period_start": start, "period_end": end,
            "total": total, "mine": mine, "others": others, "msi_total": msi_total, "paid": paid,
            "real_total": real, "difference": (real - total) if real is not None else None,
            "people": _person_rows(debts, names), "charges": charges,
        })

    people = _person_rows(all_debts, names)
    return {
        "month": month, "year": year, "label": f"{MONTHS_ES[month - 1]} {year}",
        "cards": out_cards,
        "total": sum((c["total"] for c in out_cards), ZERO),
        "mine": sum((c["mine"] for c in out_cards), ZERO),
        "others": sum((c["others"] for c in out_cards), ZERO),
        "to_collect": sum((p["pending"] for p in people), ZERO),
        "people": people,
    }


def set_statement_check(db: Session, user_id: UUID, account_id: UUID, month: int, year: int, real_total: Optional[Decimal]) -> None:
    if not db.query(Account).filter(Account.id == account_id, Account.user_id == user_id).first():
        raise ValueError("Tarjeta no encontrada")
    row = db.query(StatementCheck).filter(
        StatementCheck.account_id == account_id, StatementCheck.statement_month == month, StatementCheck.statement_year == year
    ).first()
    if row:
        row.real_total = real_total
    else:
        db.add(StatementCheck(user_id=user_id, account_id=account_id, statement_month=month, statement_year=year, real_total=real_total))
    db.commit()
