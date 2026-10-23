"""activity log (stats history) and digest settings

Revision ID: 0026
Revises: 0025
Create Date: 2026-10-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0026'
down_revision = '0025'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'activity_log',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('resource_id', UUID(as_uuid=True), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_activity_user_kind_at', 'activity_log', ['user_id', 'kind', 'occurred_at'])

    op.create_table(
        'digest_settings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('sunday_on', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('sunday_hour', sa.Integer(), nullable=False, server_default='19'),
        sa.Column('friday_on', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('friday_hour', sa.Integer(), nullable=False, server_default='8'),
        sa.Column('last_sent_key', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Best-effort backfill so the stats aren't empty on day one
    op.execute("""
        INSERT INTO activity_log (id, user_id, kind, resource_id, due_date, occurred_at)
        SELECT gen_random_uuid(), user_id, 'task_done', id, due_date, COALESCE(updated_at, now())
        FROM tasks WHERE is_completed AND NOT is_event
    """)
    op.execute("""
        INSERT INTO activity_log (id, user_id, kind, resource_id, due_date, occurred_at)
        SELECT gen_random_uuid(), l.user_id, 'list_item_done', i.id, NULL, COALESCE(l.updated_at, now())
        FROM list_items i JOIN lists l ON l.id = i.list_id WHERE i.is_done
    """)


def downgrade():
    op.drop_table('digest_settings')
    op.drop_index('ix_activity_user_kind_at', table_name='activity_log')
    op.drop_table('activity_log')
