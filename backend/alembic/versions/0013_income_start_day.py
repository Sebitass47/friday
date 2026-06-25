"""monthly_income: add income_start_day

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('monthly_income', sa.Column('income_start_day', sa.Integer(), nullable=False, server_default='1'))


def downgrade():
    op.drop_column('monthly_income', 'income_start_day')
