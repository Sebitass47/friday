"""add last_charged_date to recurring_expenses

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = '0022'
down_revision = '0021'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'recurring_expenses',
        sa.Column('last_charged_date', sa.Date(), nullable=True)
    )


def downgrade():
    op.drop_column('recurring_expenses', 'last_charged_date')
