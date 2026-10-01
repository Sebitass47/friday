"""add days_of_week to habits

Revision ID: 0024
Revises: 0023
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa

revision = '0024'
down_revision = '0023'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'habits',
        sa.Column('days_of_week', sa.String(), nullable=False, server_default='0,1,2,3,4,5,6'),
    )


def downgrade():
    op.drop_column('habits', 'days_of_week')
