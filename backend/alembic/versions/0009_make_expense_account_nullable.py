"""make expense account_id nullable for cash payments

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('expenses', 'account_id', nullable=True)


def downgrade():
    op.alter_column('expenses', 'account_id', nullable=False)
