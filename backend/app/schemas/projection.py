from decimal import Decimal
from datetime import date
from typing import List, Optional
from pydantic import BaseModel


class MonthProjection(BaseModel):
    month: int
    year: int
    label: str
    cycle_start: date
    cycle_end: date
    income: Decimal
    recurring_expenses: Decimal
    installments: Decimal
    savings_contributions: Decimal
    cash_debit_spent: Decimal
    credit_spent: Decimal
    available: Decimal


class ProjectionResponse(BaseModel):
    months: List[MonthProjection]
    total_months: int


class SimulateInstallmentRequest(BaseModel):
    name: str
    total_amount: Decimal
    monthly_amount: Decimal
    total_installments: int
    start_date: date


class SimulationResponse(BaseModel):
    months: List[MonthProjection]
    total_months: int
    impact_summary: Decimal
