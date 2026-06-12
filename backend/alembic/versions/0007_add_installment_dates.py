"""add installment purchase dates

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-12

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0007'
down_revision: Union[str, None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column('installment_purchases', sa.Column('payment_day', sa.Integer(), nullable=True))
    op.add_column('installment_purchases', sa.Column('closing_day', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('installment_purchases', 'closing_day')
    op.drop_column('installment_purchases', 'payment_day')
