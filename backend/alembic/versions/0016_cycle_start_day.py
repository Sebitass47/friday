"""rename income_start_day to cycle_start_day

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-02
"""
from alembic import op

revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('monthly_income', 'income_start_day', new_column_name='cycle_start_day')


def downgrade():
    op.alter_column('monthly_income', 'cycle_start_day', new_column_name='income_start_day')
