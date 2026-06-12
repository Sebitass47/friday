from fastapi import APIRouter
from .endpoints.auth import router as auth_router
from .endpoints.accounts import router as accounts_router
from .endpoints.recurring_expenses import router as recurring_expenses_router
from .endpoints.installment_purchases import router as installment_purchases_router
from .endpoints.savings_goals import router as savings_goals_router
from .endpoints.monthly_income import router as monthly_income_router
from .endpoints.projection import router as projection_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(accounts_router)
router.include_router(recurring_expenses_router)
router.include_router(installment_purchases_router)
router.include_router(savings_goals_router)
router.include_router(monthly_income_router)
router.include_router(projection_router)
