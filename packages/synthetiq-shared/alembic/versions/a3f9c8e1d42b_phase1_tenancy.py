"""phase1_tenancy

Revision ID: a3f9c8e1d42b
Revises: bb863566fc2f
Create Date: 2026-10-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f9c8e1d42b'
down_revision: Union[str, Sequence[str], None] = 'bb863566fc2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Phase 1 Tenancy: add org_id to domain tables, create new tenancy tables, enable RLS."""

    # -------------------------------------------------------------------------
    # 1a. Create domain tables first (they may not exist yet)
    # -------------------------------------------------------------------------
    # audit_records
    op.create_table(
        'audit_records',
        sa.Column('audit_id', sa.String(length=64), nullable=False),
        sa.Column('recycler_id', sa.String(length=64), nullable=False),
        sa.Column('plant_id', sa.String(length=64), nullable=False),
        sa.Column('plastic_category', sa.String(length=64), nullable=False),
        sa.Column('reported_volume_tons', sa.Float(), nullable=False),
        sa.Column('verified_physical_melt_tons', sa.Float(), nullable=False),
        sa.Column('physical_melt_verified', sa.Boolean(), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False),
        sa.Column('eway_bill_verified', sa.Boolean(), nullable=False),
        sa.Column('audit_verdict', sa.String(length=32), nullable=False),
        sa.Column('rejection_reasons', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('audit_hash', sa.String(length=256), nullable=False),
        sa.Column('physics', sa.JSON(), nullable=True),
        sa.Column('triggered_by', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('audit_id'),
        if_not_exists=True,
    )

    # auctions
    op.create_table(
        'auctions',
        sa.Column('auction_id', sa.String(length=64), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False),
        sa.Column('target_tons', sa.Float(), nullable=False),
        sa.Column('statutory_rate_per_kg', sa.Float(), nullable=False),
        sa.Column('floor_price_inr', sa.Float(), nullable=False),
        sa.Column('ceiling_price_inr', sa.Float(), nullable=False),
        sa.Column('clearing_price_inr', sa.Float(), nullable=False),
        sa.Column('total_cleared_tons', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('company_id', sa.String(length=64), nullable=True),
        sa.Column('winning_recyclers', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('auction_id'),
        if_not_exists=True,
    )

    # bids
    op.create_table(
        'bids',
        sa.Column('bid_id', sa.String(length=64), nullable=False),
        sa.Column('auction_id', sa.String(length=64), nullable=False),
        sa.Column('recycler_id', sa.String(length=64), nullable=False),
        sa.Column('recycler_name', sa.String(length=256), nullable=False),
        sa.Column('plant_id', sa.String(length=64), nullable=False),
        sa.Column('plant_name', sa.String(length=256), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False),
        sa.Column('volume_tons', sa.Float(), nullable=False),
        sa.Column('price_per_kg', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['auction_id'], ['auctions.auction_id']),
        sa.PrimaryKeyConstraint('bid_id'),
        if_not_exists=True,
    )

    # escrow_pos
    op.create_table(
        'escrow_pos',
        sa.Column('po_number', sa.String(length=64), nullable=False),
        sa.Column('company_id', sa.String(length=64), nullable=False),
        sa.Column('recycler_id', sa.String(length=64), nullable=False),
        sa.Column('recycler_name', sa.String(length=256), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False),
        sa.Column('plastic_tons', sa.Float(), nullable=False),
        sa.Column('total_amount_inr', sa.Float(), nullable=False),
        sa.Column('advance_amount_inr', sa.Float(), nullable=False),
        sa.Column('retention_amount_inr', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('escrow_account', sa.String(length=64), nullable=True),
        sa.Column('audit_id', sa.String(length=64), nullable=True),
        sa.Column('sap_purchase_order_number', sa.String(length=64), nullable=True),
        sa.Column('sap_sync_status', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('po_number'),
        if_not_exists=True,
    )

    # form1_records
    op.create_table(
        'form1_records',
        sa.Column('form_id', sa.String(length=64), nullable=False),
        sa.Column('company_id', sa.String(length=64), nullable=False),
        sa.Column('recycler_id', sa.String(length=64), nullable=False),
        sa.Column('recycler_name', sa.String(length=256), nullable=False),
        sa.Column('po_number', sa.String(length=64), nullable=False),
        sa.Column('audit_id', sa.String(length=64), nullable=True),
        sa.Column('plastic_category', sa.String(length=64), nullable=False),
        sa.Column('physical_melt_tons', sa.Float(), nullable=False),
        sa.Column('conversion_factor_cf', sa.Float(), nullable=False),
        sa.Column('credited_tons', sa.Float(), nullable=False),
        sa.Column('portal_status', sa.String(length=32), nullable=False),
        sa.Column('portal_ack_number', sa.String(length=64), nullable=True),
        sa.Column('dsc_signature', sa.String(length=256), nullable=True),
        sa.Column('full_payload', sa.JSON(), nullable=True),
        sa.Column('dispatched_by', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('form_id'),
        if_not_exists=True,
    )

    # -------------------------------------------------------------------------
    # 1a. Add org_id (nullable first) to the 5 domain tables
    # -------------------------------------------------------------------------
    for table in ('audit_records', 'auctions', 'bids', 'escrow_pos', 'form1_records'):
        op.add_column(
            table,
            sa.Column('org_id', sa.String(64), nullable=True),
        )

    # Backfill: point all existing rows at the first org in the system
    for table in ('audit_records', 'auctions', 'bids', 'escrow_pos', 'form1_records'):
        op.execute(
            f"UPDATE {table} SET org_id = (SELECT org_id FROM organizations LIMIT 1) WHERE org_id IS NULL"
        )

    # Make org_id NOT NULL and add FK + index
    for table in ('audit_records', 'auctions', 'bids', 'escrow_pos', 'form1_records'):
        op.alter_column(table, 'org_id', nullable=False)
        op.create_foreign_key(
            f'fk_{table}_org_id',
            table, 'organizations',
            ['org_id'], ['org_id'],
        )
        op.create_index(f'ix_{table}_org_id', table, ['org_id'])

    # -------------------------------------------------------------------------
    # 1b. Create legal_entities table
    # -------------------------------------------------------------------------
    op.create_table(
        'legal_entities',
        sa.Column('id', sa.String(64), primary_key=True, server_default=sa.text("(lower(hex(randomblob(16))))")),
        sa.Column('org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=False),
        sa.Column('gstin', sa.String(15), nullable=True),
        sa.Column('legal_name', sa.String(), nullable=False),
        sa.Column('state_code', sa.String(2), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    )

    # -------------------------------------------------------------------------
    # 1c. Create memberships table
    # -------------------------------------------------------------------------
    op.create_table(
        'memberships',
        sa.Column('id', sa.String(64), primary_key=True, server_default=sa.text("(lower(hex(randomblob(16))))")),
        sa.Column('user_id', sa.String(64), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=False),
        sa.Column('role', sa.String(32), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.UniqueConstraint('user_id', 'org_id', name='uq_memberships_user_org'),
    )

    # -------------------------------------------------------------------------
    # 1d. Create invite_tokens table
    # -------------------------------------------------------------------------
    op.create_table(
        'invite_tokens',
        sa.Column('id', sa.String(64), primary_key=True, server_default=sa.text("(lower(hex(randomblob(16))))")),
        sa.Column('email', sa.String(256), nullable=False),
        sa.Column('org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=True),
        sa.Column('role', sa.String(32), nullable=False),
        sa.Column('token', sa.String(64), nullable=False, unique=True),
        sa.Column('purpose', sa.String(32), nullable=False, server_default='invite'),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(64), sa.ForeignKey('users.user_id'), nullable=True),
    )

    # -------------------------------------------------------------------------
    # 1e. Add org_type to organizations
    # -------------------------------------------------------------------------
    op.add_column('organizations', sa.Column('org_type', sa.String(64), nullable=True))

    # -------------------------------------------------------------------------
    # 1f. Add status column to organizations (for pending_verification / active)
    # -------------------------------------------------------------------------
    op.add_column('organizations', sa.Column('status', sa.String(32), nullable=True, server_default='active'))

    # -------------------------------------------------------------------------
    # 1g. platform_admin was already added in organization.py ORM model;
    #     the initial migration did NOT include it, so we add it here.
    # -------------------------------------------------------------------------
    op.add_column('users', sa.Column('platform_admin', sa.Boolean(), server_default=sa.false(), nullable=False))

    # -------------------------------------------------------------------------
    # 1h. RLS on the 5 domain tables (PostgreSQL only — skipped on SQLite)
    # -------------------------------------------------------------------------
    # We wrap in a try/execute so it degrades gracefully on SQLite dev environments.
    for table in ('audit_records', 'auctions', 'bids', 'escrow_pos', 'form1_records'):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {table} "
            f"USING (org_id::text = current_setting('app.org_id', true)) "
            f"WITH CHECK (org_id::text = current_setting('app.org_id', true))"
        )
        op.execute(
            f"CREATE POLICY platform_admin_bypass ON {table} "
            f"USING (current_setting('app.org_id', true) = '')"
        )


def downgrade() -> None:
    """Reverse all Phase 1 Tenancy changes."""

    # Remove RLS (PostgreSQL only)
    for table in ('audit_records', 'auctions', 'bids', 'escrow_pos', 'form1_records'):
        op.execute(f"DROP POLICY IF EXISTS platform_admin_bypass ON {table}")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # Remove platform_admin from users
    op.drop_column('users', 'platform_admin')

    # Remove status and org_type from organizations
    op.drop_column('organizations', 'status')
    op.drop_column('organizations', 'org_type')

    # Drop new tables
    op.drop_table('invite_tokens')
    op.drop_table('memberships')
    op.drop_table('legal_entities')

    # Remove org_id from domain tables
    for table in ('audit_records', 'auctions', 'bids', 'escrow_pos', 'form1_records'):
        op.drop_index(f'ix_{table}_org_id', table)
        op.drop_constraint(f'fk_{table}_org_id', table, type_='foreignkey')
        op.drop_column(table, 'org_id')

    # Drop domain tables (created in this migration)
    op.drop_table('form1_records')
    op.drop_table('escrow_pos')
    op.drop_table('bids')
    op.drop_table('auctions')
    op.drop_table('audit_records')
