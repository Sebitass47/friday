from fastapi import APIRouter
from .endpoints.auth import router as auth_router
from .endpoints.accounts import router as accounts_router
from .endpoints.recurring_expenses import router as recurring_expenses_router
from .endpoints.installment_purchases import router as installment_purchases_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(accounts_router)
router.include_router(recurring_expenses_router)
router.include_router(installment_purchases_router)
