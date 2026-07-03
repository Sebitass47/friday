import calendar as cal_mod
from decimal import Decimal
from datetime import date, timedelta
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session

from app.services.monthly_income_service import get_monthly_income
from app.services.recurring_expense_service import get_recurring_expenses
from app.services.installment_purchase_service import get_active_installment_purchases
from app.services.savings_goal_service import get_savings_goals
from app.models.recurring_expense import ExpenseFrequency
from app.models.expense import Expense
from app.models.enums import PaymentMethod
from app.models.credit_payment import CreditPayment
from app.schemas.projection import (
    MonthProjection, ProjectionResponse,
    SimulateInstallmentRequest, SimulationResponse,
)

MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


# ── Cycle utilities ───────────────────────────────────────────────────────────

def _clamp_day(year: int, month: int, day: int) -> int:
    """Clamp day to the last valid day of the month (handles 29/30/31)."""
    return min(day, cal_mod.monthrange(year, month)[1])


def _cycle_date(year: int, month: int, cycle_start_day: int) -> date:
    return date(year, month, _clamp_day(year, month, cycle_start_day))


def _next_month(year: int, month: int) -> Tuple[int, int]:
    if month == 12:
        return year + 1, 1
    return year, month + 1


def _prev_month(year: int, month: int) -> Tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _next_cycle_start(cycle_start: date, cycle_start_day: int) -> date:
    ny, nm = _next_month(cycle_start.year, cycle_start.month)
    return _cycle_date(ny, nm, cycle_start_day)


def _current_cycle_start(today: date, cycle_start_day: int) -> date:
    """Return the start date of the cycle that contains today."""
    this_cycle = _cycle_date(today.year, today.month, cycle_start_day)
    if today >= this_cycle:
        return this_cycle
    py, pm = _prev_month(today.year, today.month)
    return _cycle_date(py, pm, cycle_start_day)


def _nth_cycle_bounds(n: int, today: date, cycle_start_day: int) -> Tuple[date, date]:
    """Return (start, end) for the n-th cycle from current (0 = current)."""
    start = _current_cycle_start(today, cycle_start_day)
    for _ in range(n):
        start = _next_cycle_start(start, cycle_start_day)
    end = _next_cycle_start(start, cycle_start_day) - timedelta(days=1)
    return start, end


def _cycle_label(cycle_start: date, cycle_start_day: int) -> str:
    if cycle_start_day == 1:
        return cycle_start.strftime("%-d %b %Y") if False else \
            f"{MONTHS_ES[cycle_start.month - 1]} {cycle_start.year}"
    end = _next_cycle_start(cycle_start, cycle_start_day) - timedelta(days=1)
    return (
        f"{cycle_start.day} {MONTHS_ES[cycle_start.month - 1]} – "
        f"{end.day} {MONTHS_ES[end.month - 1]}"
    )


# ── Per-cycle calculations ────────────────────────────────────────────────────

def _recurring_cost_for_cycle(expenses, cycle_start: date, cycle_end: date) -> Decimal:
    total = Decimal("0")
    cycle_days = (cycle_end - cycle_start).days + 1
    for expense in expenses:
        if expense.frequency == ExpenseFrequency.MONTHLY:
            total += expense.amount
        elif expense.frequency == ExpenseFrequency.WEEKLY:
            total += expense.amount * (cycle_days // 7)
        elif expense.frequency == ExpenseFrequency.CUSTOM and expense.interval_days:
            total += expense.amount * max(1, cycle_days // expense.interval_days)
    return total


def _installment_cost_for_cycle(
    purchases, cycle_start: date, cycle_start_day: int
) -> Decimal:
    """
    Attribute installments to cycles based on the number of cycle boundaries
    elapsed since the purchase date.
    """
    total = Decimal("0")
    for p in purchases:
        purchase_cycle = _current_cycle_start(p.start_date, cycle_start_day)
        # Cycles elapsed = month difference between purchase cycle and target cycle
        cycles_elapsed = (
            (cycle_start.year - purchase_cycle.year) * 12
            + (cycle_start.month - purchase_cycle.month)
        )
        if 0 <= cycles_elapsed < p.total_installments:
            installment_number = cycles_elapsed + 1
            paid_installments = p.total_installments - p.remaining_installments
            if installment_number > paid_installments:
                total += p.monthly_amount
    return total


def _savings_cost_for_cycle(goals, cycle_start: date, cycle_end: date, today: date) -> Decimal:
    total = Decimal("0")
    is_current = cycle_start <= today <= cycle_end
    # Months covered by this cycle (may span two calendar months)
    cycle_months = {(cycle_start.month, cycle_start.year)}
    if cycle_end.month != cycle_start.month or cycle_end.year != cycle_start.year:
        cycle_months.add((cycle_end.month, cycle_end.year))
    for g in goals:
        if is_current:
            contributed_in_cycle = (g.contributed_month, g.contributed_year) in cycle_months
            if contributed_in_cycle:
                total += g.last_contribution_amount or Decimal("0")
        else:
            total += g.monthly_contribution
    return total


def _cash_debit_spent_for_cycle(
    db: Session, user_id: UUID, cycle_start: date, cycle_end: date
) -> Decimal:
    expenses = db.query(Expense).filter(
        Expense.user_id == user_id,
        Expense.payment_method.in_([PaymentMethod.CASH, PaymentMethod.DEBIT]),
        Expense.date >= cycle_start,
        Expense.date <= cycle_end,
    ).all()
    return sum((Decimal(str(e.amount)) for e in expenses), Decimal("0"))


def _credit_payments_for_cycle(
    db: Session, user_id: UUID, cycle_start: date, cycle_end: date
) -> Decimal:
    """Sum credit card payments whose payment_date falls in this cycle."""
    payments = db.query(CreditPayment).filter(
        CreditPayment.user_id == user_id,
        CreditPayment.payment_date >= cycle_start,
        CreditPayment.payment_date <= cycle_end,
    ).all()
    return sum((Decimal(str(p.amount_paid)) for p in payments), Decimal("0"))


# ── Projection builder ────────────────────────────────────────────────────────

def _build_cycle_projection(
    db: Session,
    user_id: UUID,
    cycle_start: date,
    cycle_end: date,
    income: Decimal,
    cycle_start_day: int,
    recurring_expenses,
    installments,
    savings_goals,
    today: date,
    extra_installment: Optional[SimulateInstallmentRequest] = None,
) -> MonthProjection:
    is_current = cycle_start <= today <= cycle_end

    rec_total = _recurring_cost_for_cycle(recurring_expenses, cycle_start, cycle_end)
    inst_total = _installment_cost_for_cycle(installments, cycle_start, cycle_start_day)
    sav_total = _savings_cost_for_cycle(savings_goals, cycle_start, cycle_end, today)

    credit_total = Decimal("0")
    cash_debit_total = Decimal("0")
    if is_current:
        cash_debit_total = _cash_debit_spent_for_cycle(db, user_id, cycle_start, today)
        credit_total = _credit_payments_for_cycle(db, user_id, cycle_start, today)

    # For projections, income is always counted at full value.
    # The cycle starts precisely when income arrives, so there's no waiting period.
    effective_income = income

    if extra_installment:
        purchase_cycle = _current_cycle_start(extra_installment.start_date, cycle_start_day)
        cycles_elapsed = (
            (cycle_start.year - purchase_cycle.year) * 12
            + (cycle_start.month - purchase_cycle.month)
        )
        if 0 <= cycles_elapsed < extra_installment.total_installments:
            inst_total += extra_installment.monthly_amount

    available = effective_income - rec_total - inst_total - sav_total - credit_total - cash_debit_total

    return MonthProjection(
        month=cycle_start.month,
        year=cycle_start.year,
        label=_cycle_label(cycle_start, cycle_start_day),
        cycle_start=cycle_start,
        cycle_end=cycle_end,
        income=effective_income,
        recurring_expenses=rec_total,
        installments=inst_total,
        savings_contributions=sav_total,
        cash_debit_spent=cash_debit_total,
        available=available,
    )


# ── Public API ────────────────────────────────────────────────────────────────

def calculate_projection(db: Session, user_id: UUID, months: int = 12) -> ProjectionResponse:
    income_record = get_monthly_income(db, user_id)
    income = income_record.amount if income_record else Decimal("0")
    cycle_start_day = income_record.cycle_start_day if income_record else 1

    recurring = get_recurring_expenses(db, user_id)
    installments = get_active_installment_purchases(db, user_id)
    goals = get_savings_goals(db, user_id)

    today = date.today()
    result = []
    for i in range(months):
        cycle_start, cycle_end = _nth_cycle_bounds(i, today, cycle_start_day)
        result.append(_build_cycle_projection(
            db, user_id, cycle_start, cycle_end,
            income, cycle_start_day, recurring, installments, goals, today,
        ))

    return ProjectionResponse(months=result, total_months=months)


def simulate_projection(
    db: Session,
    user_id: UUID,
    simulation: SimulateInstallmentRequest,
    months: int = 12,
) -> SimulationResponse:
    income_record = get_monthly_income(db, user_id)
    income = income_record.amount if income_record else Decimal("0")
    cycle_start_day = income_record.cycle_start_day if income_record else 1

    recurring = get_recurring_expenses(db, user_id)
    installments = get_active_installment_purchases(db, user_id)
    goals = get_savings_goals(db, user_id)

    today = date.today()
    result = []
    for i in range(months):
        cycle_start, cycle_end = _nth_cycle_bounds(i, today, cycle_start_day)
        result.append(_build_cycle_projection(
            db, user_id, cycle_start, cycle_end,
            income, cycle_start_day, recurring, installments, goals, today, simulation,
        ))

    sim_purchase_cycle = _current_cycle_start(simulation.start_date, cycle_start_day)
    impact = sum(
        simulation.monthly_amount
        for p in result
        if 0 <= (
            (p.cycle_start.year - sim_purchase_cycle.year) * 12
            + (p.cycle_start.month - sim_purchase_cycle.month)
        ) < simulation.total_installments
    )

    return SimulationResponse(months=result, total_months=months, impact_summary=Decimal(str(impact)))
