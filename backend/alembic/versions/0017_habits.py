"""habits and habit_logs tables

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'habits',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('color', sa.String(), nullable=False, server_default='#6B46E5'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_habits_user_id', 'habits', ['user_id'])

    op.create_table(
        'habit_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('habit_id', UUID(as_uuid=True), sa.ForeignKey('habits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('habit_id', 'date', name='uq_habit_log_date'),
    )
    op.create_index('ix_habit_logs_habit_id', 'habit_logs', ['habit_id'])


def downgrade():
    op.drop_index('ix_habit_logs_habit_id', table_name='habit_logs')
    op.drop_table('habit_logs')
    op.drop_index('ix_habits_user_id', table_name='habits')
    op.drop_table('habits')
