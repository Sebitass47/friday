"""update accounts add credit fields

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-12

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0006'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('current_balance_used', sa.Numeric(12, 2), nullable=True, server_default='0'))
    op.add_column('accounts', sa.Column('available_credit', sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'available_credit')
    op.drop_column('accounts', 'current_balance_used')
