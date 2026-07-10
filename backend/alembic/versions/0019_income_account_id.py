"""Add account_id to incomes and monthly_income tables

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('incomes', sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True))
    op.add_column('monthly_income', sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True))


def downgrade():
    op.drop_column('incomes', 'account_id')
    op.drop_column('monthly_income', 'account_id')
