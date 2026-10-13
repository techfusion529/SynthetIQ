"""phase2_runs

Revision ID: c1d2e3f4a5b6
Revises: a3f9c8e1d42b
Create Date: 2026-10-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'a3f9c8e1d42b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Phase 2 Runs: extend workflow_runs with input_params, hitl_required, temporal_run_id."""

    # Add three new columns to workflow_runs
    op.add_column('workflow_runs', sa.Column('input_params', sa.JSON(), nullable=True))
    op.add_column('workflow_runs', sa.Column('hitl_required', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('workflow_runs', sa.Column('temporal_run_id', sa.String(256), nullable=True))

    # RLS on workflow_runs (PostgreSQL only — degrades gracefully on SQLite)
    try:
        op.execute("ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY")
        op.execute(
            "CREATE POLICY tenant_isolation ON workflow_runs "
            "USING (org_id::text = current_setting('app.org_id', true)) "
            "WITH CHECK (org_id::text = current_setting('app.org_id', true))"
        )
        op.execute(
            "CREATE POLICY platform_admin_bypass ON workflow_runs "
            "USING (current_setting('app.org_id', true) = '')"
        )
    except Exception:
        pass  # SQLite does not support RLS — skip silently


def downgrade() -> None:
    """Reverse Phase 2 Runs changes."""

    # Remove RLS (PostgreSQL only)
    try:
        op.execute("DROP POLICY IF EXISTS platform_admin_bypass ON workflow_runs")
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON workflow_runs")
        op.execute("ALTER TABLE workflow_runs DISABLE ROW LEVEL SECURITY")
    except Exception:
        pass  # SQLite does not support RLS — skip silently

    # Drop the three new columns
    op.drop_column('workflow_runs', 'temporal_run_id')
    op.drop_column('workflow_runs', 'hitl_required')
    op.drop_column('workflow_runs', 'input_params')
