from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.expense import Expense
from app.models.enums import PaymentMethod
from app.models.account import Account
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from decimal import Decimal


def _calculate_credit_statement_month(expense_date: date, closing_day: int) -> tuple[int, int]:
    """Calculate which month's statement a credit expense appears in.

    If expense date is after closing_day (day of month), it appears in next month's statement.
    """
    if expense_date.day > closing_day:
        # Next month
        if expense_date.month == 12:
            return 1, expense_date.year + 1
        else:
            return expense_date.month + 1, expense_date.year
    else:
        # Current month
        return expense_date.month, expense_date.year


def create_expense(db: Session, expense: ExpenseCreate, user_id: UUID) -> Expense:
    """Create a new expense and update account balances."""
    account = None
    if expense.account_id:
        account = db.query(Account).filter(
            Account.id == expense.account_id,
            Account.user_id == user_id
        ).first()
        if not account:
            raise ValueError("Cuenta no encontrada")

    db_expense = Expense(
        user_id=user_id,
        account_id=expense.account_id,
        name=expense.name,
        amount=expense.amount,
        date=expense.expense_date,
        payment_method=expense.payment_method,
        category=expense.category,
    )

    if account:
        if expense.payment_method == PaymentMethod.CREDIT:
            if not account.closing_day:
                raise ValueError("La tarjeta no tiene día de cierre configurado")
            stmt_month, stmt_year = _calculate_credit_statement_month(expense.expense_date, account.closing_day)
            db_expense.credit_statement_month = stmt_month
            db_expense.credit_statement_year = stmt_year
            account.current_balance_used = (account.current_balance_used or 0) + expense.amount
            if account.credit_limit:
                account.available_credit = account.credit_limit - account.current_balance_used
        elif expense.payment_method in (PaymentMethod.DEBIT, PaymentMethod.CASH):
            account.balance = (account.balance or 0) - expense.amount

    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


def get_expenses(db: Session, user_id: UUID) -> List[Expense]:
    """Get all user expenses."""
    return db.query(Expense).filter(Expense.user_id == user_id).all()


def get_expenses_for_month(db: Session, user_id: UUID, year: int, month: int) -> List[Expense]:
    """Get expenses for a specific month (by date for non-credit, by statement month for credit)."""
    return db.query(Expense).filter(
        Expense.user_id == user_id,
        and_(
            Expense.date >= date(year, month, 1),
            Expense.date < date(year, month + 1 if month < 12 else 1, 1)
        ) if month < 12 else and_(
            Expense.date >= date(year, month, 1),
            Expense.date < date(year + 1, 1, 1)
        )
    ).all()


def get_expenses_for_credit_statement(db: Session, user_id: UUID, account_id: UUID, year: int, month: int) -> List[Expense]:
    """Get all credit card expenses that appear in a specific month's statement."""
    return db.query(Expense).filter(
        Expense.user_id == user_id,
        Expense.account_id == account_id,
        Expense.payment_method == PaymentMethod.CREDIT,
        Expense.credit_statement_month == month,
        Expense.credit_statement_year == year
    ).all()


def get_expense(db: Session, expense_id: UUID, user_id: UUID) -> Optional[Expense]:
    """Get a specific expense."""
    return db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == user_id
    ).first()


def update_expense(db: Session, expense_id: UUID, expense_update: ExpenseUpdate, user_id: UUID) -> Optional[Expense]:
    """Update an expense."""
    db_expense = get_expense(db, expense_id, user_id)
    if not db_expense:
        return None

    # Get account for potential balance updates
    account = db.query(Account).filter(Account.id == db_expense.account_id).first()

    # If amount changed and it's a credit expense, update balances
    if expense_update.amount and expense_update.amount != db_expense.amount and db_expense.payment_method == PaymentMethod.CREDIT:
        diff = expense_update.amount - db_expense.amount
        account.current_balance_used = (account.current_balance_used or 0) + diff
        if account.credit_limit:
            account.available_credit = account.credit_limit - account.current_balance_used

    # Similar logic for debit/cash
    if expense_update.amount and expense_update.amount != db_expense.amount and db_expense.payment_method in (PaymentMethod.DEBIT, PaymentMethod.CASH):
        diff = expense_update.amount - db_expense.amount
        account.balance = (account.balance or 0) - diff

    update_data = expense_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_expense, key, value)

    db.commit()
    db.refresh(db_expense)
    return db_expense


def delete_expense(db: Session, expense_id: UUID, user_id: UUID) -> bool:
    """Delete an expense and refund balances."""
    db_expense = get_expense(db, expense_id, user_id)
    if not db_expense:
        return False

    account = db.query(Account).filter(Account.id == db_expense.account_id).first()

    # Refund balance
    if db_expense.payment_method == PaymentMethod.CREDIT:
        account.current_balance_used = (account.current_balance_used or 0) - db_expense.amount
        if account.credit_limit:
            account.available_credit = account.credit_limit - account.current_balance_used
    elif db_expense.payment_method in (PaymentMethod.DEBIT, PaymentMethod.CASH):
        account.balance = (account.balance or 0) + db_expense.amount

    db.delete(db_expense)
    db.commit()
    return True


def get_user_available_balance(db: Session, user_id: UUID) -> Decimal:
    """Get total available balance (cash/debit + available credit)."""
    from app.models.account import AccountType

    accounts = db.query(Account).filter(Account.user_id == user_id, Account.is_active == True).all()

    total = Decimal(0)
    for account in accounts:
        if account.account_type == AccountType.CREDIT_CARD:
            total += account.available_credit or 0
        else:
            total += account.balance or 0

    return total
