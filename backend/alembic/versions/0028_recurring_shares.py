"""recurring expenses split with people (shares + charge history)

Revision ID: 0028
Revises: 0027
Create Date: 2026-10-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0028'
down_revision = '0027'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'recurring_shares',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('recurring_id', UUID(as_uuid=True), sa.ForeignKey('recurring_expenses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('person_id', UUID(as_uuid=True), sa.ForeignKey('people.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.UniqueConstraint('recurring_id', 'person_id', name='uq_recurring_share_person'),
    )
    op.create_table(
        'recurring_charges',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('recurring_id', UUID(as_uuid=True), sa.ForeignKey('recurring_expenses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('charge_date', sa.Date(), nullable=False),
        sa.Column('statement_month', sa.Integer(), nullable=True),
        sa.Column('statement_year', sa.Integer(), nullable=True),
        sa.Column('mine', sa.Numeric(12, 2), nullable=False),
        sa.Column('total', sa.Numeric(12, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_rcharges_statement', 'recurring_charges', ['account_id', 'statement_year', 'statement_month'])
    op.add_column('person_debts', sa.Column(
        'recurring_charge_id', UUID(as_uuid=True), sa.ForeignKey('recurring_charges.id', ondelete='CASCADE'), nullable=True))


def downgrade():
    op.drop_column('person_debts', 'recurring_charge_id')
    op.drop_index('ix_rcharges_statement', table_name='recurring_charges')
    op.drop_table('recurring_charges')
    op.drop_table('recurring_shares')
