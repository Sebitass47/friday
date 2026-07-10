from typing import List, Optional
from uuid import UUID
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.credit_payment import CreditPayment
from app.models.expense import Expense, PaymentMethod
from app.models.account import Account
from app.schemas.credit_payment import CreditPaymentCreate, CreditPaymentUpdate
from decimal import Decimal


def create_credit_payment(db: Session, payment: CreditPaymentCreate, user_id: UUID) -> CreditPayment:
    """Register a credit card payment and update available credit."""
    # Get account
    account = db.query(Account).filter(
        Account.id == payment.account_id,
        Account.user_id == user_id
    ).first()

    if not account:
        raise ValueError("Tarjeta no encontrada")

    # Create payment record
    db_payment = CreditPayment(
        user_id=user_id,
        account_id=payment.account_id,
        amount_paid=payment.amount_paid,
        payment_date=payment.payment_date,
        statement_month=payment.statement_month,
        statement_year=payment.statement_year,
    )

    # Update available credit
    account.current_balance_used = max(Decimal(0), (account.current_balance_used or 0) - payment.amount_paid)
    if account.credit_limit:
        account.available_credit = account.credit_limit - account.current_balance_used

    # Mark expenses in this statement as paid
    paid_expenses = db.query(Expense).filter(
        Expense.user_id == user_id,
        Expense.account_id == payment.account_id,
        Expense.payment_method == PaymentMethod.CREDIT,
        Expense.credit_statement_month == payment.statement_month,
        Expense.credit_statement_year == payment.statement_year,
    ).all()

    for expense in paid_expenses:
        expense.paid = True

    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


def get_credit_payments(db: Session, user_id: UUID) -> List[CreditPayment]:
    """Get all credit payments for a user."""
    return db.query(CreditPayment).filter(CreditPayment.user_id == user_id).all()


def get_credit_payments_for_account(db: Session, user_id: UUID, account_id: UUID) -> List[CreditPayment]:
    """Get all payments for a specific credit card."""
    return db.query(CreditPayment).filter(
        CreditPayment.user_id == user_id,
        CreditPayment.account_id == account_id
    ).all()


def get_credit_payments_for_month(db: Session, user_id: UUID, year: int, month: int) -> List[CreditPayment]:
    """Get credit payments due in a specific month."""
    return db.query(CreditPayment).filter(
        CreditPayment.user_id == user_id,
        CreditPayment.statement_month == month,
        CreditPayment.statement_year == year
    ).all()


def get_credit_payment(db: Session, payment_id: UUID, user_id: UUID) -> Optional[CreditPayment]:
    """Get a specific payment."""
    return db.query(CreditPayment).filter(
        CreditPayment.id == payment_id,
        CreditPayment.user_id == user_id
    ).first()


def update_credit_payment(db: Session, payment_id: UUID, payment_update: CreditPaymentUpdate, user_id: UUID) -> Optional[CreditPayment]:
    """Update a credit payment."""
    db_payment = get_credit_payment(db, payment_id, user_id)
    if not db_payment:
        return None

    update_data = payment_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_payment, key, value)

    db.commit()
    db.refresh(db_payment)
    return db_payment


def delete_credit_payment(db: Session, payment_id: UUID, user_id: UUID) -> bool:
    """Delete a credit payment and refund the balance."""
    db_payment = get_credit_payment(db, payment_id, user_id)
    if not db_payment:
        return False

    account = db.query(Account).filter(Account.id == db_payment.account_id, Account.user_id == db_payment.user_id).first()

    # Refund the credit
    account.current_balance_used = (account.current_balance_used or 0) + db_payment.amount_paid
    if account.credit_limit:
        account.available_credit = account.credit_limit - account.current_balance_used

    # Mark expenses as unpaid
    expenses = db.query(Expense).filter(
        Expense.user_id == db_payment.user_id,
        Expense.account_id == db_payment.account_id,
        Expense.payment_method == PaymentMethod.CREDIT,
        Expense.credit_statement_month == db_payment.statement_month,
        Expense.credit_statement_year == db_payment.statement_year,
    ).all()

    for expense in expenses:
        expense.paid = False

    db.delete(db_payment)
    db.commit()
    return True
