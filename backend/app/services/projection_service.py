from decimal import Decimal
from datetime import date
from calendar import month_abbr
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.services.monthly_income_service import get_monthly_income
from app.services.recurring_expense_service import get_recurring_expenses
from app.services.installment_purchase_service import get_active_installment_purchases
from app.services.savings_goal_service import get_savings_goals
from app.models.recurring_expense import ExpenseFrequency
from app.models.expense import Expense
from app.models.enums import PaymentMethod
from app.models.credit_payment import CreditPayment
from app.schemas.projection import MonthProjection, ProjectionResponse, SimulateInstallmentRequest, SimulationResponse

MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


def _recurring_cost_for_month(expenses, target_month: int, target_year: int) -> Decimal:
    total = Decimal("0")
    days_in_month = _days_in_month(target_month, target_year)

    for expense in expenses:
        if expense.frequency == ExpenseFrequency.MONTHLY:
            total += expense.amount
        elif expense.frequency == ExpenseFrequency.WEEKLY:
            # approximate: weeks that fall in the month
            occurrences = days_in_month // 7
            total += expense.amount * occurrences
        elif expense.frequency == ExpenseFrequency.CUSTOM and expense.interval_days:
            occurrences = max(1, days_in_month // expense.interval_days)
            total += expense.amount * occurrences

    return total


def _days_in_month(month: int, year: int) -> int:
    import calendar
    return calendar.monthrange(year, month)[1]


def _installment_cost_for_month(purchases, target_month: int, target_year: int) -> Decimal:
    total = Decimal("0")
    for p in purchases:
        # calculate which installment number this month corresponds to
        months_elapsed = (target_year - p.start_date.year) * 12 + (target_month - p.start_date.month)
        if 0 <= months_elapsed < p.total_installments:
            installment_number = months_elapsed + 1
            # only charge if this installment hasn't been paid yet
            paid_installments = p.total_installments - p.remaining_installments
            if installment_number > paid_installments:
                total += p.monthly_amount
    return total


def _savings_cost(goals, month: int, year: int) -> Decimal:
    total = Decimal("0")
    today = date.today()
    is_current = month == today.month and year == today.year
    for g in goals:
        if is_current:
            # Only count what the user actually confirmed saving this month
            if g.contributed_month == today.month and g.contributed_year == today.year:
                total += g.last_contribution_amount or Decimal("0")
        else:
            total += g.monthly_contribution
    return total


def _cash_debit_expenses_for_month(db: Session, user_id: UUID, target_month: int, target_year: int) -> Decimal:
    """Get expenses paid with cash or debit in a specific month."""
    expenses = db.query(Expense).filter(
        Expense.user_id == user_id,
        Expense.payment_method.in_([PaymentMethod.CASH, PaymentMethod.DEBIT]),
        and_(
            Expense.date >= date(target_year, target_month, 1),
            Expense.date < date(target_year, target_month + 1 if target_month < 12 else 1, 1)
        ) if target_month < 12 else and_(
            Expense.date >= date(target_year, target_month, 1),
            Expense.date < date(target_year + 1, 1, 1)
        )
    ).all()
    return sum((Decimal(str(e.amount)) for e in expenses), Decimal("0"))


def _credit_payments_for_month(db: Session, user_id: UUID, target_month: int, target_year: int) -> Decimal:
    """Get credit card payments due in a specific month."""
    payments = db.query(CreditPayment).filter(
        CreditPayment.user_id == user_id,
        CreditPayment.statement_month == target_month,
        CreditPayment.statement_year == target_year,
    ).all()
    return sum((Decimal(str(p.amount_paid)) for p in payments), Decimal("0"))


def _build_month_projection(
    db: Session,
    user_id: UUID,
    month: int,
    year: int,
    income: Decimal,
    income_start_day: int,
    recurring_expenses,
    installments,
    savings_goals,
    extra_installment: Optional[SimulateInstallmentRequest] = None,
) -> MonthProjection:
    rec_total = _recurring_cost_for_month(recurring_expenses, month, year)
    inst_total = _installment_cost_for_month(installments, month, year)
    sav_total = _savings_cost(savings_goals, month, year)

    credit_payments = _credit_payments_for_month(db, user_id, month, year)

    today = date.today()
    is_current_month = month == today.month and year == today.year

    # For the current month: if today is before income_start_day, income hasn't
    # arrived yet — show 0 so the user sees their real available balance right now.
    effective_income = income
    if is_current_month and today.day < income_start_day:
        effective_income = Decimal("0")

    cash_debit_total = Decimal("0")
    if is_current_month:
        cash_debit_total = _cash_debit_expenses_for_month(db, user_id, month, year)

    if extra_installment:
        months_elapsed = (year - extra_installment.start_date.year) * 12 + (month - extra_installment.start_date.month)
        if 0 <= months_elapsed < extra_installment.total_installments:
            inst_total += extra_installment.monthly_amount

    available = effective_income - rec_total - inst_total - sav_total - credit_payments - cash_debit_total

    return MonthProjection(
        month=month,
        year=year,
        label=f"{MONTHS_ES[month - 1]} {year}",
        income=effective_income,
        recurring_expenses=rec_total,
        installments=inst_total,
        savings_contributions=sav_total,
        available=available,
    )


def calculate_projection(db: Session, user_id: UUID, months: int = 12) -> ProjectionResponse:
    income_record = get_monthly_income(db, user_id)
    income = income_record.amount if income_record else Decimal("0")
    income_start_day = income_record.income_start_day if income_record else 1

    recurring = get_recurring_expenses(db, user_id)
    installments = get_active_installment_purchases(db, user_id)
    goals = get_savings_goals(db, user_id)

    today = date.today()
    result = []
    for i in range(months):
        month = (today.month - 1 + i) % 12 + 1
        year = today.year + (today.month - 1 + i) // 12
        result.append(_build_month_projection(
            db, user_id, month, year, income, income_start_day, recurring, installments, goals
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
    income_start_day = income_record.income_start_day if income_record else 1

    recurring = get_recurring_expenses(db, user_id)
    installments = get_active_installment_purchases(db, user_id)
    goals = get_savings_goals(db, user_id)

    today = date.today()
    result = []
    for i in range(months):
        month = (today.month - 1 + i) % 12 + 1
        year = today.year + (today.month - 1 + i) // 12
        result.append(_build_month_projection(db, user_id, month, year, income, income_start_day, recurring, installments, goals, simulation))

    impact = sum(
        (simulation.monthly_amount
         for p in result
         if 0 <= (p.year - simulation.start_date.year) * 12 + (p.month - simulation.start_date.month) < simulation.total_installments),
        Decimal("0"),
    )

    return SimulationResponse(months=result, total_months=months, impact_summary=impact)
