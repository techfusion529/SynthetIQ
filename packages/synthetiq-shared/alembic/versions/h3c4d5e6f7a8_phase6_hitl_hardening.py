"""phase6_hitl_hardening

Revision ID: h3c4d5e6f7a8
Revises: g2b3c4d5e6f7
Create Date: 2026-12-01 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = 'g2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add HITL columns to workflow_runs; create llm_usage_log table."""
    # --- Four new nullable columns on workflow_runs ---
    op.add_column('workflow_runs', sa.Column('initiated_by', sa.String(64), nullable=True))
    op.add_column('workflow_runs', sa.Column('hitl_resolved_at', sa.DateTime(), nullable=True))
    op.add_column('workflow_runs', sa.Column('hitl_resolver_id', sa.String(64), nullable=True))
    op.add_column('workflow_runs', sa.Column('hitl_reason_code', sa.String(64), nullable=True))

    # --- llm_usage_log table ---
    op.create_table(
        'llm_usage_log',
        sa.Column('id', sa.String(64), primary_key=True, nullable=False),
        sa.Column('org_id', sa.String(64), nullable=False),
        sa.Column('agent_name', sa.String(64), nullable=True),
        sa.Column('model', sa.String(64), nullable=True),
        sa.Column('input_tokens', sa.Integer(), nullable=True),
        sa.Column('output_tokens', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
    )

    # Index on (org_id, created_at) for efficient cost-cap queries
    op.create_index('ix_llm_usage_log_org_created', 'llm_usage_log', ['org_id', 'created_at'])

    # Row-level security on llm_usage_log (PostgreSQL only; silent fail on SQLite)
    try:
        op.execute("ALTER TABLE llm_usage_log ENABLE ROW LEVEL SECURITY")
        op.execute(
            "CREATE POLICY llm_usage_log_org_isolation ON llm_usage_log "
            "USING (org_id = current_setting('app.org_id', TRUE))"
        )
    except Exception:
        pass


def downgrade() -> None:
    """Remove HITL columns from workflow_runs; drop llm_usage_log table."""
    # Drop RLS policy (PostgreSQL only; ignore errors)
    try:
        op.execute("DROP POLICY IF EXISTS llm_usage_log_org_isolation ON llm_usage_log")
    except Exception:
        pass

    op.drop_index('ix_llm_usage_log_org_created', table_name='llm_usage_log')
    op.drop_table('llm_usage_log')

    op.drop_column('workflow_runs', 'hitl_reason_code')
    op.drop_column('workflow_runs', 'hitl_resolver_id')
    op.drop_column('workflow_runs', 'hitl_resolved_at')
    op.drop_column('workflow_runs', 'initiated_by')
