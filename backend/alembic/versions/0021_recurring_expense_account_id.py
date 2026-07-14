"""add account_id and last_charged_date to recurring_expenses

Revision ID: 0021
Revises: 0020
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0021'
down_revision = '0020'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'recurring_expenses',
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True)
    )


def downgrade():
    op.drop_column('recurring_expenses', 'account_id')
