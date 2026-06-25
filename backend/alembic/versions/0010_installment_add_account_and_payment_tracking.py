"""installment: add account_id, paid_month, paid_year

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('installment_purchases',
        sa.Column('account_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('accounts.id', ondelete='SET NULL'),
                  nullable=True))
    op.add_column('installment_purchases', sa.Column('paid_month', sa.Integer(), nullable=True))
    op.add_column('installment_purchases', sa.Column('paid_year', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('installment_purchases', 'paid_year')
    op.drop_column('installment_purchases', 'paid_month')
    op.drop_column('installment_purchases', 'account_id')
