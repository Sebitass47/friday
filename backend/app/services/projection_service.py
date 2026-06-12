from decimal import Decimal
from datetime import date
from calendar import month_abbr
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.services.monthly_income_service import get_monthly_income
from app.services.recurring_expense_service import get_recurring_expenses
from app.services.installment_purchase_service import get_active_installment_purchases
from app.services.savings_goal_service import get_savings_goals
from app.models.recurring_expense import ExpenseFrequency
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


def _savings_cost(goals) -> Decimal:
    return sum((g.monthly_contribution for g in goals), Decimal("0"))


def _build_month_projection(
    month: int,
    year: int,
    income: Decimal,
    recurring_expenses,
    installments,
    savings_goals,
    extra_installment: Optional[SimulateInstallmentRequest] = None,
) -> MonthProjection:
    rec_total = _recurring_cost_for_month(recurring_expenses, month, year)
    inst_total = _installment_cost_for_month(installments, month, year)
    sav_total = _savings_cost(savings_goals)

    if extra_installment:
        months_elapsed = (year - extra_installment.start_date.year) * 12 + (month - extra_installment.start_date.month)
        if 0 <= months_elapsed < extra_installment.total_installments:
            inst_total += extra_installment.monthly_amount

    available = income - rec_total - inst_total - sav_total

    return MonthProjection(
        month=month,
        year=year,
        label=f"{MONTHS_ES[month - 1]} {year}",
        income=income,
        recurring_expenses=rec_total,
        installments=inst_total,
        savings_contributions=sav_total,
        available=available,
    )


def calculate_projection(db: Session, user_id: UUID, months: int = 12) -> ProjectionResponse:
    income_record = get_monthly_income(db, user_id)
    income = income_record.amount if income_record else Decimal("0")

    recurring = get_recurring_expenses(db, user_id)
    installments = get_active_installment_purchases(db, user_id)
    goals = get_savings_goals(db, user_id)

    today = date.today()
    result = []
    for i in range(months):
        month = (today.month - 1 + i) % 12 + 1
        year = today.year + (today.month - 1 + i) // 12
        result.append(_build_month_projection(month, year, income, recurring, installments, goals))

    return ProjectionResponse(months=result, total_months=months)


def simulate_projection(
    db: Session,
    user_id: UUID,
    simulation: SimulateInstallmentRequest,
    months: int = 12,
) -> SimulationResponse:
    income_record = get_monthly_income(db, user_id)
    income = income_record.amount if income_record else Decimal("0")

    recurring = get_recurring_expenses(db, user_id)
    installments = get_active_installment_purchases(db, user_id)
    goals = get_savings_goals(db, user_id)

    today = date.today()
    result = []
    for i in range(months):
        month = (today.month - 1 + i) % 12 + 1
        year = today.year + (today.month - 1 + i) // 12
        result.append(_build_month_projection(month, year, income, recurring, installments, goals, simulation))

    impact = sum(
        (simulation.monthly_amount
         for p in result
         if 0 <= (p.year - simulation.start_date.year) * 12 + (p.month - simulation.start_date.month) < simulation.total_installments),
        Decimal("0"),
    )

    return SimulationResponse(months=result, total_months=months, impact_summary=impact)
