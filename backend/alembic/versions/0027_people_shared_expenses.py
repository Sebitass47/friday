"""people, shared expenses/MSI debts, payments received and statement checks

Revision ID: 0027
Revises: 0026
Create Date: 2026-10-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0027'
down_revision = '0026'
branch_labels = None
depends_on = None


def _uuid_pk():
    return sa.Column('id', UUID(as_uuid=True), primary_key=True)


def upgrade():
    op.create_table(
        'people',
        _uuid_pk(),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_people_user', 'people', ['user_id'])

    op.create_table(
        'installment_shares',
        _uuid_pk(),
        sa.Column('installment_id', UUID(as_uuid=True), sa.ForeignKey('installment_purchases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('person_id', UUID(as_uuid=True), sa.ForeignKey('people.id', ondelete='CASCADE'), nullable=False),
        sa.Column('monthly_amount', sa.Numeric(12, 2), nullable=False),
        sa.UniqueConstraint('installment_id', 'person_id', name='uq_installment_share_person'),
    )

    op.create_table(
        'person_debts',
        _uuid_pk(),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('person_id', UUID(as_uuid=True), sa.ForeignKey('people.id', ondelete='CASCADE'), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('settled_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('charge_date', sa.Date(), nullable=False),
        sa.Column('expense_id', UUID(as_uuid=True), sa.ForeignKey('expenses.id', ondelete='CASCADE'), nullable=True),
        sa.Column('installment_id', UUID(as_uuid=True), sa.ForeignKey('installment_purchases.id', ondelete='CASCADE'), nullable=True),
        sa.Column('installment_index', sa.Integer(), nullable=True),
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('statement_month', sa.Integer(), nullable=True),
        sa.Column('statement_year', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_debts_user_person', 'person_debts', ['user_id', 'person_id'])
    op.create_index('ix_debts_statement', 'person_debts', ['account_id', 'statement_year', 'statement_month'])

    op.create_table(
        'person_payments',
        _uuid_pk(),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('person_id', UUID(as_uuid=True), sa.ForeignKey('people.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'payment_allocations',
        _uuid_pk(),
        sa.Column('payment_id', UUID(as_uuid=True), sa.ForeignKey('person_payments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('debt_id', UUID(as_uuid=True), sa.ForeignKey('person_debts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
    )

    op.create_table(
        'statement_checks',
        _uuid_pk(),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('statement_month', sa.Integer(), nullable=False),
        sa.Column('statement_year', sa.Integer(), nullable=False),
        sa.Column('real_total', sa.Numeric(12, 2), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('account_id', 'statement_year', 'statement_month', name='uq_statement_check'),
    )


def downgrade():
    for t in ('statement_checks', 'payment_allocations', 'person_payments', 'person_debts', 'installment_shares'):
        op.drop_table(t)
    op.drop_index('ix_people_user', table_name='people')
    op.drop_table('people')
