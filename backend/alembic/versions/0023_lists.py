"""add lists and list_items

Revision ID: 0023
Revises: 0022
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0023'
down_revision = '0022'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'lists',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('emoji', sa.String(), nullable=False, server_default='📝'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_lists_user_id', 'lists', ['user_id'])
    op.create_table(
        'list_items',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('list_id', UUID(as_uuid=True), sa.ForeignKey('lists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('text', sa.String(), nullable=False),
        sa.Column('is_done', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_list_items_list_id', 'list_items', ['list_id'])


def downgrade():
    op.drop_index('ix_list_items_list_id', table_name='list_items')
    op.drop_table('list_items')
    op.drop_index('ix_lists_user_id', table_name='lists')
    op.drop_table('lists')
