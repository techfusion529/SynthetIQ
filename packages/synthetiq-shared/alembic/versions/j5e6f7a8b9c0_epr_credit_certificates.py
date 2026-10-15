"""epr_credit_certificates

Revision ID: j5e6f7a8b9c0
Revises: i4d5e6f7a8b9
Create Date: 2026-12-03 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'i4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create epr_credit_certificates table with RLS policy."""
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    op.create_table(
        'epr_credit_certificates',
        sa.Column('certificate_id', sa.String(64), primary_key=True, nullable=False),
        sa.Column('brand_org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=False),
        sa.Column('recycler_org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=False),
        sa.Column('facility_id', sa.String(64), nullable=True),
        sa.Column('category_code', sa.String(64), nullable=False),
        sa.Column('credit_volume_tons', sa.Float(), nullable=False),
        sa.Column('fiscal_year', sa.String(16), nullable=False, server_default='FY2025-26'),
        sa.Column('po_number', sa.String(64), nullable=True),
        sa.Column('form1_id', sa.String(64), nullable=True),
        sa.Column('cpcb_portal_credit_id', sa.String(128), nullable=True),
        sa.Column('status', sa.String(32), nullable=False, server_default='ISSUED'),
        sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index('ix_epr_credit_certificates_brand_org_id', 'epr_credit_certificates', ['brand_org_id'])
    op.create_index('ix_epr_credit_certificates_recycler_org_id', 'epr_credit_certificates', ['recycler_org_id'])

    if is_postgres:
        op.execute("""
            ALTER TABLE epr_credit_certificates ENABLE ROW LEVEL SECURITY;
        """)
        op.execute("""
            CREATE POLICY epr_credit_certificates_tenant_isolation ON epr_credit_certificates
                FOR ALL
                USING (
                    current_setting('app.org_id', true) = ''
                    OR brand_org_id = current_setting('app.org_id', true)
                    OR recycler_org_id = current_setting('app.org_id', true)
                );
        """)


def downgrade() -> None:
    """Drop epr_credit_certificates table."""
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("DROP POLICY IF EXISTS epr_credit_certificates_tenant_isolation ON epr_credit_certificates;")

    op.drop_table('epr_credit_certificates')
