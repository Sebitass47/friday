from enum import Enum


class PaymentMethod(str, Enum):
    CASH = "cash"
    DEBIT = "debit"
    CREDIT = "credit"
    SAVINGS = "savings"
