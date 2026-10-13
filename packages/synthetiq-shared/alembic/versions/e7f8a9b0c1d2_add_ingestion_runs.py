"""add_ingestion_runs

Revision ID: e7f8a9b0c1d2
Revises: d4e5f6a7b8c9
Create Date: 2026-10-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add ingestion_runs table, extend audit_records and data_sources."""

    # -------------------------------------------------------------------------
    # 1. Create ingestion_runs table
    # -------------------------------------------------------------------------
    op.create_table(
        'ingestion_runs',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=False),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('org_id', sa.String(), nullable=False),
        sa.Column('data_source_id', sa.String(), nullable=False),
        sa.Column('schema_type', sa.String(), nullable=False),
        sa.Column('rows_read', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rows_accepted', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rows_quarantined', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('source_hash', sa.String(64), nullable=True),
        sa.Column('schema_fingerprint', sa.String(64), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text('now()'),
        ),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.org_id'], ondelete='CASCADE'),
    )
    op.create_index('ix_ingestion_runs_org_id', 'ingestion_runs', ['org_id'])

    # -------------------------------------------------------------------------
    # 2. Add ingestion_run_id to audit_records
    # -------------------------------------------------------------------------
    op.add_column(
        'audit_records',
        sa.Column('ingestion_run_id', sa.String(), nullable=True),
    )

    # -------------------------------------------------------------------------
    # 3. Add mapping and secret_ref to data_sources
    # -------------------------------------------------------------------------
    op.add_column(
        'data_sources',
        sa.Column('mapping', sa.JSON(), nullable=True),
    )
    op.add_column(
        'data_sources',
        sa.Column('secret_ref', sa.String(256), nullable=True),
    )

    # -------------------------------------------------------------------------
    # 4. Enable RLS on ingestion_runs (PostgreSQL only — skipped on SQLite)
    # -------------------------------------------------------------------------
    try:
        op.execute("ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY")
        op.execute(
            "CREATE POLICY tenant_isolation ON ingestion_runs "
            "USING (org_id::text = current_setting('app.org_id', true))"
        )
        op.execute(
            "CREATE POLICY platform_admin_bypass ON ingestion_runs "
            "USING (current_setting('app.org_id', true) = '')"
        )
    except Exception:
        pass  # SQLite does not support RLS — skip silently


def downgrade() -> None:
    """Reverse ingestion_runs migration in reverse order."""

    # 4. Remove RLS (PostgreSQL only)
    try:
        op.execute("DROP POLICY IF EXISTS platform_admin_bypass ON ingestion_runs")
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON ingestion_runs")
        op.execute("ALTER TABLE ingestion_runs DISABLE ROW LEVEL SECURITY")
    except Exception:
        pass  # SQLite does not support RLS — skip silently

    # 3. Drop mapping and secret_ref from data_sources
    op.drop_column('data_sources', 'secret_ref')
    op.drop_column('data_sources', 'mapping')

    # 2. Drop ingestion_run_id from audit_records
    op.drop_column('audit_records', 'ingestion_run_id')

    # 1. Drop ingestion_runs table
    op.drop_index('ix_ingestion_runs_org_id', table_name='ingestion_runs')
    op.drop_table('ingestion_runs')
