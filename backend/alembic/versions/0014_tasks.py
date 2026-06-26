"""tasks and subtasks tables

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tasks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('is_event', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('due_time', sa.Time(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('is_starred', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('recurrence', sa.String(), nullable=True),
        sa.Column('reminder_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('remind_day_before', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reminded_main', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reminded_day_before', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reminded_3d', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reminded_1d', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reminded_1h', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_tasks_user_id', 'tasks', ['user_id'])
    op.create_index('ix_tasks_is_event', 'tasks', ['is_event'])
    op.create_index('ix_tasks_due_date', 'tasks', ['due_date'])

    op.create_table(
        'subtasks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('task_id', UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_subtasks_task_id', 'subtasks', ['task_id'])


def downgrade():
    op.drop_index('ix_subtasks_task_id', 'subtasks')
    op.drop_table('subtasks')
    op.drop_index('ix_tasks_due_date', 'tasks')
    op.drop_index('ix_tasks_is_event', 'tasks')
    op.drop_index('ix_tasks_user_id', 'tasks')
    op.drop_table('tasks')
