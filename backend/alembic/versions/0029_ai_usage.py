"""ai assistant monthly usage

Revision ID: 0029
Revises: 0028
Create Date: 2026-11-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0029'
down_revision = '0028'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ai_usage',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('period', sa.String(7), nullable=False),
        sa.Column('cost_usd', sa.Numeric(12, 6), nullable=False, server_default='0'),
        sa.Column('calls', sa.Integer, nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'period', name='uq_ai_usage_user_period'),
    )


def downgrade():
    op.drop_table('ai_usage')
