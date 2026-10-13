"""phase3_dynamic_config

Revision ID: d4e5f6a7b8c9
Revises: c1d2e3f4a5b6
Create Date: 2026-10-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Phase 3 Dynamic Config: regulatory_packs, org_policies, plant_calibrations, obligation_ledger."""

    # -------------------------------------------------------------------------
    # 1. regulatory_packs — no RLS (platform-wide, not tenant-scoped)
    # -------------------------------------------------------------------------
    op.create_table(
        'regulatory_packs',
        sa.Column('id', sa.String(64), nullable=False),
        sa.Column('version', sa.String(64), nullable=False),
        sa.Column('jurisdiction', sa.String(8), server_default='IN', nullable=False),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('effective_to', sa.Date(), nullable=True),
        sa.Column('status', sa.String(32), server_default='draft', nullable=False),
        sa.Column('created_by', sa.String(64), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('approved_by', sa.String(64), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('version', name='uq_regulatory_pack_version'),
    )

    # -------------------------------------------------------------------------
    # 2. org_policies — RLS: one row per org
    # -------------------------------------------------------------------------
    op.create_table(
        'org_policies',
        sa.Column('id', sa.String(64), nullable=False),
        sa.Column('org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=False),
        sa.Column('approval_threshold_tons', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('categories_in_scope', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('signatory_name', sa.String(256), nullable=True),
        sa.Column('signatory_designation', sa.String(128), nullable=True),
        sa.Column('timezone', sa.String(64), server_default='Asia/Kolkata', nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('org_id', name='uq_org_policy_org_id'),
    )
    try:
        op.execute("ALTER TABLE org_policies ENABLE ROW LEVEL SECURITY")
        op.execute(
            "CREATE POLICY tenant_isolation ON org_policies "
            "USING (org_id::text = current_setting('app.org_id', true)) "
            "WITH CHECK (org_id::text = current_setting('app.org_id', true))"
        )
        op.execute(
            "CREATE POLICY platform_admin_bypass ON org_policies "
            "USING (current_setting('app.org_id', true) = '')"
        )
    except Exception:
        pass  # SQLite does not support RLS — skip silently

    # -------------------------------------------------------------------------
    # 3. plant_calibrations — RLS
    # -------------------------------------------------------------------------
    op.create_table(
        'plant_calibrations',
        sa.Column('id', sa.String(64), nullable=False),
        sa.Column('org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=False),
        sa.Column('plant_id', sa.String(64), nullable=False),
        sa.Column('material_grade', sa.String(64), nullable=False),
        sa.Column('sec_baseline_kwh_per_ton', sa.Float(), nullable=False),
        sa.Column('sec_variance', sa.Float(), nullable=False),
        sa.Column('motor_efficiency', sa.Float(), server_default='0.92', nullable=False),
        sa.Column('valid_from', sa.Date(), nullable=False),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('org_id', 'plant_id', 'material_grade', 'valid_from', name='uq_plant_cal'),
    )
    op.create_index('ix_plant_cal_org_id', 'plant_calibrations', ['org_id'])
    try:
        op.execute("ALTER TABLE plant_calibrations ENABLE ROW LEVEL SECURITY")
        op.execute(
            "CREATE POLICY tenant_isolation ON plant_calibrations "
            "USING (org_id::text = current_setting('app.org_id', true)) "
            "WITH CHECK (org_id::text = current_setting('app.org_id', true))"
        )
        op.execute(
            "CREATE POLICY platform_admin_bypass ON plant_calibrations "
            "USING (current_setting('app.org_id', true) = '')"
        )
    except Exception:
        pass  # SQLite does not support RLS — skip silently

    # -------------------------------------------------------------------------
    # 4. obligation_ledger — RLS
    # -------------------------------------------------------------------------
    op.create_table(
        'obligation_ledger',
        sa.Column('id', sa.String(64), nullable=False),
        sa.Column('org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=False),
        sa.Column('fiscal_year', sa.String(16), nullable=False),
        sa.Column('category', sa.String(64), nullable=False),
        sa.Column('obligation_tons', sa.Float(), nullable=False),
        sa.Column('source', sa.String(32), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('org_id', 'fiscal_year', 'category', name='uq_obligation'),
    )
    op.create_index('ix_obligation_ledger_org_id', 'obligation_ledger', ['org_id'])
    try:
        op.execute("ALTER TABLE obligation_ledger ENABLE ROW LEVEL SECURITY")
        op.execute(
            "CREATE POLICY tenant_isolation ON obligation_ledger "
            "USING (org_id::text = current_setting('app.org_id', true)) "
            "WITH CHECK (org_id::text = current_setting('app.org_id', true))"
        )
        op.execute(
            "CREATE POLICY platform_admin_bypass ON obligation_ledger "
            "USING (current_setting('app.org_id', true) = '')"
        )
    except Exception:
        pass  # SQLite does not support RLS — skip silently


def downgrade() -> None:
    """Reverse Phase 3 Dynamic Config changes — drop all 4 tables in reverse order."""

    # 4. obligation_ledger
    try:
        op.execute("DROP POLICY IF EXISTS platform_admin_bypass ON obligation_ledger")
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON obligation_ledger")
        op.execute("ALTER TABLE obligation_ledger DISABLE ROW LEVEL SECURITY")
    except Exception:
        pass
    op.drop_index('ix_obligation_ledger_org_id', table_name='obligation_ledger')
    op.drop_table('obligation_ledger')

    # 3. plant_calibrations
    try:
        op.execute("DROP POLICY IF EXISTS platform_admin_bypass ON plant_calibrations")
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON plant_calibrations")
        op.execute("ALTER TABLE plant_calibrations DISABLE ROW LEVEL SECURITY")
    except Exception:
        pass
    op.drop_index('ix_plant_cal_org_id', table_name='plant_calibrations')
    op.drop_table('plant_calibrations')

    # 2. org_policies
    try:
        op.execute("DROP POLICY IF EXISTS platform_admin_bypass ON org_policies")
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON org_policies")
        op.execute("ALTER TABLE org_policies DISABLE ROW LEVEL SECURITY")
    except Exception:
        pass
    op.drop_table('org_policies')

    # 1. regulatory_packs (no RLS)
    op.drop_table('regulatory_packs')
