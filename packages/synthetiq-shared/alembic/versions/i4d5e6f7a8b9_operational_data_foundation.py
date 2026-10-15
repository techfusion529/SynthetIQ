"""operational_data_foundation

Revision ID: i4d5e6f7a8b9
Revises: h3c4d5e6f7a8
Create Date: 2026-12-02 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = 'h3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create plastic_categories, facilities, eway_bills, telemetry_batches tables and seed master data."""

    # -------------------------------------------------------------------------
    # 1. plastic_categories — platform-wide master taxonomy (no RLS)
    # -------------------------------------------------------------------------
    op.create_table(
        'plastic_categories',
        sa.Column('category_code', sa.String(64), primary_key=True, nullable=False),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('statutory_schedule', sa.String(128), server_default='Schedule II', nullable=False),
        sa.Column('cpcb_description', sa.Text(), nullable=True),
        sa.Column('default_penalty_rate_inr_kg', sa.Float(), server_default='12.0', nullable=False),
        sa.Column('default_target_percentage', sa.Float(), server_default='0.80', nullable=False),
        sa.Column('requires_extrusive_verification', sa.Boolean(), server_default='true', nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
    )

    # -------------------------------------------------------------------------
    # 2. facilities — recycling plants, manufacturing units, collection hubs (RLS)
    # -------------------------------------------------------------------------
    op.create_table(
        'facilities',
        sa.Column('facility_id', sa.String(64), primary_key=True, nullable=False),
        sa.Column('org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=False),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('facility_type', sa.String(64), server_default='recycler_pwp', nullable=False),
        sa.Column('state_code', sa.String(8), server_default='DL', nullable=False),
        sa.Column('pincode', sa.String(16), nullable=True),
        sa.Column('cpcb_pwp_reg_no', sa.String(128), nullable=True),
        sa.Column('cto_number', sa.String(128), nullable=True),
        sa.Column('cto_valid_until', sa.Date(), nullable=True),
        sa.Column('licensed_capacity_tons_year', sa.Float(), server_default='5000.0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
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
    )
    op.create_index('ix_facilities_org_id', 'facilities', ['org_id'])
    try:
        op.execute("ALTER TABLE facilities ENABLE ROW LEVEL SECURITY")
        op.execute(
            "CREATE POLICY tenant_isolation ON facilities "
            "USING (org_id::text = current_setting('app.org_id', true)) "
            "WITH CHECK (org_id::text = current_setting('app.org_id', true))"
        )
        op.execute(
            "CREATE POLICY platform_admin_bypass ON facilities "
            "USING (current_setting('app.org_id', true) = '')"
        )
    except Exception:
        pass

    # -------------------------------------------------------------------------
    # 3. eway_bills — logistics consignments and transit provenance (RLS)
    # -------------------------------------------------------------------------
    op.create_table(
        'eway_bills',
        sa.Column('eway_bill_no', sa.String(64), primary_key=True, nullable=False),
        sa.Column('org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=False),
        sa.Column('facility_id', sa.String(64), nullable=True),
        sa.Column('transporter_gstin', sa.String(15), nullable=True),
        sa.Column('vehicle_number', sa.String(32), nullable=True),
        sa.Column('source_pincode', sa.String(16), nullable=True),
        sa.Column('destination_pincode', sa.String(16), nullable=True),
        sa.Column('category_code', sa.String(64), nullable=True),
        sa.Column('consignment_weight_tons', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('status', sa.String(32), server_default='VERIFIED', nullable=False),
        sa.Column('verification_source', sa.String(64), server_default='NIC_PORTAL', nullable=False),
        sa.Column(
            'generated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
    )
    op.create_index('ix_eway_bills_org_id', 'eway_bills', ['org_id'])
    try:
        op.execute("ALTER TABLE eway_bills ENABLE ROW LEVEL SECURITY")
        op.execute(
            "CREATE POLICY tenant_isolation ON eway_bills "
            "USING (org_id::text = current_setting('app.org_id', true)) "
            "WITH CHECK (org_id::text = current_setting('app.org_id', true))"
        )
        op.execute(
            "CREATE POLICY platform_admin_bypass ON eway_bills "
            "USING (current_setting('app.org_id', true) = '')"
        )
    except Exception:
        pass

    # -------------------------------------------------------------------------
    # 4. telemetry_batches — SCADA extruder batch recordings (RLS)
    # -------------------------------------------------------------------------
    op.create_table(
        'telemetry_batches',
        sa.Column('batch_id', sa.String(64), primary_key=True, nullable=False),
        sa.Column('facility_id', sa.String(64), nullable=False),
        sa.Column('org_id', sa.String(64), sa.ForeignKey('organizations.org_id'), nullable=False),
        sa.Column('category_code', sa.String(64), nullable=False),
        sa.Column(
            'start_time',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.Column(
            'end_time',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.Column('total_kwh', sa.Float(), nullable=False),
        sa.Column('actual_melt_kg', sa.Float(), nullable=False),
        sa.Column('avg_torque_nm', sa.Float(), nullable=False),
        sa.Column('avg_power_factor', sa.Float(), nullable=False),
        sa.Column('avg_power_kw', sa.Float(), nullable=False),
        sa.Column('measured_sec_kwh_per_ton', sa.Float(), nullable=False),
        sa.Column('is_tampered', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('audit_id', sa.String(64), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
    )
    op.create_index('ix_telemetry_batches_org_id', 'telemetry_batches', ['org_id'])
    op.create_index('ix_telemetry_batches_facility_id', 'telemetry_batches', ['facility_id'])
    try:
        op.execute("ALTER TABLE telemetry_batches ENABLE ROW LEVEL SECURITY")
        op.execute(
            "CREATE POLICY tenant_isolation ON telemetry_batches "
            "USING (org_id::text = current_setting('app.org_id', true)) "
            "WITH CHECK (org_id::text = current_setting('app.org_id', true))"
        )
        op.execute(
            "CREATE POLICY platform_admin_bypass ON telemetry_batches "
            "USING (current_setting('app.org_id', true) = '')"
        )
    except Exception:
        pass

    # -------------------------------------------------------------------------
    # 5. Seed statutory CPCB categories & seed test facility for ORG-DEV-001
    # -------------------------------------------------------------------------
    categories_table = sa.table(
        'plastic_categories',
        sa.column('category_code', sa.String),
        sa.column('name', sa.String),
        sa.column('statutory_schedule', sa.String),
        sa.column('cpcb_description', sa.Text),
        sa.column('default_penalty_rate_inr_kg', sa.Float),
        sa.column('default_target_percentage', sa.Float),
        sa.column('requires_extrusive_verification', sa.Boolean),
    )
    op.bulk_insert(
        categories_table,
        [
            {
                'category_code': 'cat_i_rigid',
                'name': 'Category I - Rigid Plastic Packaging',
                'statutory_schedule': 'Schedule II (PWM Rules 2016/2026)',
                'cpcb_description': 'Rigid plastic packaging including PET, HDPE, and PP containers and bottles.',
                'default_penalty_rate_inr_kg': 12.0,
                'default_target_percentage': 0.80,
                'requires_extrusive_verification': True,
            },
            {
                'category_code': 'cat_ii_flexible',
                'name': 'Category II - Flexible Plastic Packaging',
                'statutory_schedule': 'Schedule II (PWM Rules 2016/2026)',
                'cpcb_description': 'Flexible plastic packaging of single layer or multilayer (more than one layer with different types of plastic), plastic sheets and covers.',
                'default_penalty_rate_inr_kg': 10.0,
                'default_target_percentage': 0.70,
                'requires_extrusive_verification': True,
            },
            {
                'category_code': 'cat_iii_mlp',
                'name': 'Category III - Multi-Layered Plastic Packaging',
                'statutory_schedule': 'Schedule II (PWM Rules 2016/2026)',
                'cpcb_description': 'Multi-layered plastic packaging (at least one layer of other material such as aluminium and other non-plastics).',
                'default_penalty_rate_inr_kg': 15.0,
                'default_target_percentage': 0.60,
                'requires_extrusive_verification': True,
            },
            {
                'category_code': 'cat_iv_compostable',
                'name': 'Category IV - Compostable & Biodegradable Plastics',
                'statutory_schedule': 'Schedule II (PWM Rules 2016/2026)',
                'cpcb_description': 'Plastic sheet or like used for packaging as well as carry bags made of compostable and biodegradable plastics conforming to IS/ISO 17088.',
                'default_penalty_rate_inr_kg': 8.0,
                'default_target_percentage': 1.00,
                'requires_extrusive_verification': False,
            },
        ]
    )

    # Seed facility for ORG-DEV-001 so existing runs and tests resolve cleanly
    try:
        facilities_table = sa.table(
            'facilities',
            sa.column('facility_id', sa.String),
            sa.column('org_id', sa.String),
            sa.column('name', sa.String),
            sa.column('facility_type', sa.String),
            sa.column('state_code', sa.String),
            sa.column('pincode', sa.String),
            sa.column('cpcb_pwp_reg_no', sa.String),
            sa.column('cto_number', sa.String),
            sa.column('licensed_capacity_tons_year', sa.Float),
            sa.column('is_active', sa.Boolean),
        )
        op.bulk_insert(
            facilities_table,
            [
                {
                    'facility_id': 'PLANT-OKHLA-2',
                    'org_id': 'ORG-DEV-001',
                    'name': 'Okhla Polymer Processing Facility 2',
                    'facility_type': 'recycler_pwp',
                    'state_code': 'DL',
                    'pincode': '110020',
                    'cpcb_pwp_reg_no': 'CPCB/PWP/DL/2025/00482',
                    'cto_number': 'DPCC/CTO/2025/9921',
                    'licensed_capacity_tons_year': 10000.0,
                    'is_active': True,
                }
            ]
        )
    except Exception:
        pass

    # Seed default eway bill for ORG-DEV-001
    try:
        eway_table = sa.table(
            'eway_bills',
            sa.column('eway_bill_no', sa.String),
            sa.column('org_id', sa.String),
            sa.column('facility_id', sa.String),
            sa.column('transporter_gstin', sa.String),
            sa.column('vehicle_number', sa.String),
            sa.column('source_pincode', sa.String),
            sa.column('destination_pincode', sa.String),
            sa.column('category_code', sa.String),
            sa.column('consignment_weight_tons', sa.Float),
            sa.column('status', sa.String),
            sa.column('verification_source', sa.String),
        )
        op.bulk_insert(
            eway_table,
            [
                {
                    'eway_bill_no': 'EWB-2026-99210',
                    'org_id': 'ORG-DEV-001',
                    'facility_id': 'PLANT-OKHLA-2',
                    'transporter_gstin': '07AAAAA0000A1Z5',
                    'vehicle_number': 'DL-01-AB-1234',
                    'source_pincode': '110001',
                    'destination_pincode': '110020',
                    'category_code': 'cat_i_rigid',
                    'consignment_weight_tons': 250.0,
                    'status': 'VERIFIED',
                    'verification_source': 'NIC_PORTAL',
                }
            ]
        )
    except Exception:
        pass

    # Seed default telemetry batch for ORG-DEV-001 / PLANT-OKHLA-2
    try:
        batch_table = sa.table(
            'telemetry_batches',
            sa.column('batch_id', sa.String),
            sa.column('facility_id', sa.String),
            sa.column('org_id', sa.String),
            sa.column('category_code', sa.String),
            sa.column('total_kwh', sa.Float),
            sa.column('actual_melt_kg', sa.Float),
            sa.column('avg_torque_nm', sa.Float),
            sa.column('avg_power_factor', sa.Float),
            sa.column('avg_power_kw', sa.Float),
            sa.column('measured_sec_kwh_per_ton', sa.Float),
            sa.column('is_tampered', sa.Boolean),
        )
        op.bulk_insert(
            batch_table,
            [
                {
                    'batch_id': 'BATCH-OKHLA-001',
                    'facility_id': 'PLANT-OKHLA-2',
                    'org_id': 'ORG-DEV-001',
                    'category_code': 'cat_i_rigid',
                    'total_kwh': 95000.0,
                    'actual_melt_kg': 250000.0,
                    'avg_torque_nm': 46.5,
                    'avg_power_factor': 0.842,
                    'avg_power_kw': 94.0,
                    'measured_sec_kwh_per_ton': 380.0,
                    'is_tampered': False,
                }
            ]
        )
    except Exception:
        pass


def downgrade() -> None:
    """Drop telemetry_batches, eway_bills, facilities, plastic_categories tables."""
    try:
        op.execute("DROP POLICY IF EXISTS platform_admin_bypass ON telemetry_batches")
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON telemetry_batches")
        op.execute("ALTER TABLE telemetry_batches DISABLE ROW LEVEL SECURITY")
    except Exception:
        pass
    op.drop_index('ix_telemetry_batches_facility_id', table_name='telemetry_batches')
    op.drop_index('ix_telemetry_batches_org_id', table_name='telemetry_batches')
    op.drop_table('telemetry_batches')

    try:
        op.execute("DROP POLICY IF EXISTS platform_admin_bypass ON eway_bills")
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON eway_bills")
        op.execute("ALTER TABLE eway_bills DISABLE ROW LEVEL SECURITY")
    except Exception:
        pass
    op.drop_index('ix_eway_bills_org_id', table_name='eway_bills')
    op.drop_table('eway_bills')

    try:
        op.execute("DROP POLICY IF EXISTS platform_admin_bypass ON facilities")
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON facilities")
        op.execute("ALTER TABLE facilities DISABLE ROW LEVEL SECURITY")
    except Exception:
        pass
    op.drop_index('ix_facilities_org_id', table_name='facilities')
    op.drop_table('facilities')

    op.drop_table('plastic_categories')
