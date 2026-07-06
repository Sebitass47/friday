from fastapi import APIRouter
from .endpoints.auth import router as auth_router
from .endpoints.accounts import router as accounts_router
from .endpoints.recurring_expenses import router as recurring_expenses_router
from .endpoints.installment_purchases import router as installment_purchases_router
from .endpoints.savings_goals import router as savings_goals_router
from .endpoints.monthly_income import router as monthly_income_router
from .endpoints.projection import router as projection_router
from .endpoints.expenses import router as expenses_router
from .endpoints.credit_payments import router as credit_payments_router
from .endpoints.incomes import router as incomes_router
from .endpoints.push import router as push_router
from .endpoints.tasks import router as tasks_router
from .endpoints.notes import router as notes_router
from .endpoints.habits import router as habits_router
from .endpoints.categories import router as categories_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(accounts_router)
router.include_router(recurring_expenses_router)
router.include_router(installment_purchases_router)
router.include_router(savings_goals_router)
router.include_router(monthly_income_router)
router.include_router(projection_router)
router.include_router(expenses_router)
router.include_router(credit_payments_router)
router.include_router(incomes_router, prefix="/incomes", tags=["incomes"])
router.include_router(push_router)
router.include_router(tasks_router)
router.include_router(notes_router)
router.include_router(habits_router)
router.include_router(categories_router)
