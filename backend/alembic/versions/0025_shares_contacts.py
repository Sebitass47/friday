"""add shares and contacts

Revision ID: 0025
Revises: 0024
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0025'
down_revision = '0024'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'shares',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('resource_type', sa.String(), nullable=False),
        sa.Column('resource_id', UUID(as_uuid=True), nullable=False),
        sa.Column('owner_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('shared_with_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('resource_type', 'resource_id', 'shared_with_id', name='uq_share_resource_user'),
    )
    op.create_index('ix_shares_shared_with', 'shares', ['shared_with_id', 'resource_type'])
    op.create_index('ix_shares_resource', 'shares', ['resource_type', 'resource_id'])
    op.create_table(
        'contacts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('owner_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('contact_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('owner_id', 'contact_user_id', name='uq_contact_owner_user'),
    )
    op.create_index('ix_contacts_owner', 'contacts', ['owner_id'])


def downgrade():
    op.drop_index('ix_contacts_owner', table_name='contacts')
    op.drop_table('contacts')
    op.drop_index('ix_shares_resource', table_name='shares')
    op.drop_index('ix_shares_shared_with', table_name='shares')
    op.drop_table('shares')
