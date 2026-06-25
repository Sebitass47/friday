"""savings_goal: add contribution tracking fields

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('savings_goals', sa.Column('contributed_month', sa.Integer(), nullable=True))
    op.add_column('savings_goals', sa.Column('contributed_year', sa.Integer(), nullable=True))
    op.add_column('savings_goals', sa.Column('last_contribution_amount', sa.Numeric(12, 2), nullable=True))


def downgrade():
    op.drop_column('savings_goals', 'last_contribution_amount')
    op.drop_column('savings_goals', 'contributed_year')
    op.drop_column('savings_goals', 'contributed_month')
