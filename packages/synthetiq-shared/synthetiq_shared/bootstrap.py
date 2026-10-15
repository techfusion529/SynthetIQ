"""Platform bootstrap — idempotent seed of admin user, platform org, and default pack.

CFG-01: Called once from the API lifespan after DB tables are ready.
All operations are idempotent: no-ops if the target rows already exist.
"""
from __future__ import annotations

import logging
import os
from datetime import date

logger = logging.getLogger(__name__)

# Default payload for the seed regulatory pack.
# Values match India PWM 2026 statutory defaults.
_DEFAULT_PACK_PAYLOAD = {
    "category_targets": {
        "cat_i_rigid": 0.0,
        "cat_ii_flexible": 0.0,
        "cat_iii_mlp": 0.0,
        "cat_iv_compostable": 0.0,
    },
    "conversion_factors": {
        "cat_i_rigid": 1.0,
        "cat_ii_flexible": 0.8,
        "cat_iii_mlp": 0.5,
        "cat_iv_compostable": 1.0,
    },
    "base_rate_inr_per_kg": 12.0,
    "price_corridor_min": 3.6,
    "price_corridor_max": 12.0,
    "escrow_split_primary": 0.8,
    "escrow_split_holdback": 0.2,
    "delta_threshold_default": 0.02,   # fraction, not percent
    "fiscal_year_start_month": 4,
    "amortisation_months": 36,
}


async def bootstrap_platform() -> None:
    """Idempotent platform seed.

    Steps:
      1. Ensure a platform org exists (org_type='platform').
      2. Ensure a platform_admin User exists.
      3. Ensure at least one active RegulatoryPack exists.
    """
    from sqlalchemy import select
    from synthetiq_shared.database import get_db_session
    from synthetiq_shared.models import Organization, User
    from synthetiq_shared.models.dynamic_config import RegulatoryPack

    seed_email = os.getenv("SEED_ADMIN_EMAIL", "admin@synthetiq.io")
    # SEED_ADMIN_PASSWORD should be a pre-hashed bcrypt/passlib hash or plain text.
    # In production set this env var to a bcrypt hash.
    seed_password_hash = os.getenv("SEED_ADMIN_PASSWORD", "")

    async with get_db_session() as session:
        # 1. Platform org
        platform_org = (await session.execute(
            select(Organization).where(Organization.org_type == "platform").limit(1)
        )).scalar_one_or_none()

        if not platform_org:
            platform_org = Organization(
                name="SynthetIQ Platform",
                org_type="platform",
                industry_sector="Platform",
                country="IN",
            )
            session.add(platform_org)
            await session.flush()  # populate org_id
            logger.info(f"[Bootstrap] Created platform org: {platform_org.org_id}")
        else:
            logger.info(f"[Bootstrap] Platform org already exists: {platform_org.org_id}")

        # 2. Platform admin user
        admin_user = (await session.execute(
            select(User).where(User.platform_admin.is_(True)).limit(1)
        )).scalar_one_or_none()

        if not admin_user:
            if not seed_password_hash:
                logger.warning(
                    "[Bootstrap] SEED_ADMIN_PASSWORD not set; "
                    "platform admin will have no password — set this env var."
                )
            admin_user = User(
                email=seed_email,
                password_hash=seed_password_hash or None,
                display_name="Platform Admin",
                role="admin",
                platform_admin=True,
                org_id=platform_org.org_id,
            )
            session.add(admin_user)
            await session.flush()  # populate user_id
            logger.info(f"[Bootstrap] Created platform admin user: {seed_email}")
        else:
            logger.info(f"[Bootstrap] Platform admin already exists: {admin_user.email}")

        # 3. Default regulatory pack
        active_pack = (await session.execute(
            select(RegulatoryPack).where(RegulatoryPack.status == "active").limit(1)
        )).scalar_one_or_none()

        if not active_pack:
            active_pack = RegulatoryPack(
                version="PWM_2026_v1_default",
                jurisdiction="IN",
                effective_from=date(2026, 4, 1),
                effective_to=None,
                status="active",
                payload=_DEFAULT_PACK_PAYLOAD,
                approved_by=admin_user.user_id,
            )
            session.add(active_pack)
            logger.info("[Bootstrap] Created default regulatory pack: PWM_2026_v1_default")
        else:
            logger.info(f"[Bootstrap] Active regulatory pack already exists: {active_pack.version}")

        # 4. Default Dev Tenant (ORG-DEV-001) for out-of-the-box runs
        from synthetiq_shared.models import DataSource
        from synthetiq_shared.models.dynamic_config import PlantCalibration, ObligationLedger, OrgPolicy

        dev_org = (await session.execute(
            select(Organization).where(Organization.org_id == "ORG-DEV-001").limit(1)
        )).scalar_one_or_none()
        if not dev_org:
            dev_org = Organization(
                org_id="ORG-DEV-001",
                name="Hindustan Consumer Goods Ltd",
                org_type="brand",
                industry_sector="FMCG",
                country="IN",
                is_active=True,
            )
            session.add(dev_org)
            logger.info("[Bootstrap] Created default org: ORG-DEV-001")

        recycler_org = (await session.execute(
            select(Organization).where(Organization.org_id == "RECYC-DELHI-01").limit(1)
        )).scalar_one_or_none()
        if not recycler_org:
            recycler_org = Organization(
                org_id="RECYC-DELHI-01",
                name="Delhi EcoRecycle Facilities Ltd",
                org_type="recycler",
                industry_sector="Recycling & Waste Management",
                country="IN",
                is_active=True,
            )
            session.add(recycler_org)
            logger.info("[Bootstrap] Created default recycler org: RECYC-DELHI-01")

        # 5. Default Plant Calibration for PLANT-OKHLA-2

        existing_cal = (await session.execute(
            select(PlantCalibration).where(
                PlantCalibration.org_id == "ORG-DEV-001",
                PlantCalibration.plant_id == "PLANT-OKHLA-2",
                PlantCalibration.material_grade == "cat_i_rigid",
            ).limit(1)
        )).scalar_one_or_none()
        if not existing_cal:
            session.add(PlantCalibration(
                org_id="ORG-DEV-001",
                plant_id="PLANT-OKHLA-2",
                material_grade="cat_i_rigid",
                sec_baseline_kwh_per_ton=380.0,
                sec_variance=25.0,
                valid_from=date(2025, 4, 1),
            ))
            logger.info("[Bootstrap] Seeded default PlantCalibration for PLANT-OKHLA-2")

        # 6. Default Obligation Ledger for FY2025-26 & FY2026-27
        for fy in ["FY2025-26", "FY2026-27"]:
            existing_ob = (await session.execute(
                select(ObligationLedger).where(
                    ObligationLedger.org_id == "ORG-DEV-001",
                    ObligationLedger.fiscal_year == fy,
                    ObligationLedger.category == "cat_i_rigid",
                ).limit(1)
            )).scalar_one_or_none()
            if not existing_ob:
                session.add(ObligationLedger(
                    org_id="ORG-DEV-001",
                    fiscal_year=fy,
                    category="cat_i_rigid",
                    obligation_tons=250.0,
                    source="onboarding",
                ))
                logger.info(f"[Bootstrap] Seeded default ObligationLedger for {fy}")

        # 7. Default Mapped DataSource (BigQuery ERP Sales)
        existing_ds = (await session.execute(
            select(DataSource).where(DataSource.org_id == "ORG-DEV-001").limit(1)
        )).scalar_one_or_none()
        if not existing_ds:
            session.add(DataSource(
                source_id="DS-DEV-SALES-001",
                org_id="ORG-DEV-001",
                name="Google BigQuery ERP Sales Connection",
                source_type="bigquery",
                purpose="erp_sales",
                description="Live Google BigQuery dataset (synthetiq-dev.epr_compliance.sales_data)",
                connection_config={
                    "project_id": "synthetiq-dev",
                    "dataset_id": "epr_compliance",
                    "sales_table": "sales_data",
                },
                mapping={
                    "sku": "sku",
                    "category": "category",
                    "volume_tons": "volume_tons",
                    "fiscal_year": "fiscal_year",
                },
                is_active=True,
            ))
            logger.info("[Bootstrap] Seeded default BigQuery DataSource with mapping")
        elif not existing_ds.mapping:
            existing_ds.mapping = {
                "sku": "sku",
                "category": "category",
                "volume_tons": "volume_tons",
                "fiscal_year": "fiscal_year",
            }

        # 8. Default OrgPolicy
        existing_pol = (await session.execute(
            select(OrgPolicy).where(OrgPolicy.org_id == "ORG-DEV-001").limit(1)
        )).scalar_one_or_none()
        if not existing_pol:
            session.add(OrgPolicy(
                org_id="ORG-DEV-001",
                categories_in_scope=["cat_i_rigid", "cat_ii_flexible"],
                signatory_name="Dr. Rajesh Sharma",
                signatory_designation="Head of Regulatory Compliance",
                timezone="Asia/Kolkata",
            ))
            logger.info("[Bootstrap] Seeded default OrgPolicy for ORG-DEV-001")

        # 9. Default Agent Configurations for all 7 agents
        from synthetiq_shared.models import AgentConfiguration
        from synthetiq_shared.seed import DEFAULT_AGENTS_CONFIG
        for agent_def in DEFAULT_AGENTS_CONFIG:
            agent_name = agent_def["agent_name"]
            existing_cfg = (await session.execute(
                select(AgentConfiguration).where(
                    AgentConfiguration.org_id == "ORG-DEV-001",
                    AgentConfiguration.agent_name == agent_name,
                ).limit(1)
            )).scalar_one_or_none()
            if not existing_cfg:
                session.add(AgentConfiguration(
                    org_id="ORG-DEV-001",
                    agent_name=agent_name,
                    data_source_id="DS-DEV-SALES-001" if agent_name == "brand_liability" else None,
                    model_name=agent_def["model_name"],
                    temperature=agent_def["temperature"],
                    system_prompt=agent_def["system_prompt"],
                    parameters=agent_def["parameters"],
                    is_active=True,
                ))
                logger.info(f"[Bootstrap] Seeded default AgentConfiguration: {agent_name}")

        # 10. Canonical CPCB Plastic Categories
        from synthetiq_shared.models.facilities import PlasticCategory, Facility, EWayBillRecord, TelemetryBatch, EPRCreditCertificate
        canonical_categories = [
            {
                "category_code": "cat_i_rigid",
                "name": "Category I - Rigid Plastic Packaging",
                "statutory_schedule": "Schedule II",
                "cpcb_description": "Rigid plastic packaging including PET, HDPE bottles, containers, crates",
                "default_penalty_rate_inr_kg": 12.0,
                "default_target_percentage": 0.80,
                "requires_extrusive_verification": True,
            },
            {
                "category_code": "cat_ii_flexible",
                "name": "Category II - Flexible Plastic Packaging",
                "statutory_schedule": "Schedule II",
                "cpcb_description": "Flexible plastic packaging of single or multi-layer, plastic sheets, pouches, covers",
                "default_penalty_rate_inr_kg": 10.0,
                "default_target_percentage": 0.80,
                "requires_extrusive_verification": False,
            },
            {
                "category_code": "cat_iii_mlp",
                "name": "Category III - Multi-Layered Plastic (MLP)",
                "statutory_schedule": "Schedule II",
                "cpcb_description": "Multi-layered plastic packaging (at least one layer of plastic and at least one layer of other material)",
                "default_penalty_rate_inr_kg": 15.0,
                "default_target_percentage": 0.70,
                "requires_extrusive_verification": False,
            },
            {
                "category_code": "cat_iv_compostable",
                "name": "Category IV - Compostable & Biodegradable Plastic",
                "statutory_schedule": "Schedule II",
                "cpcb_description": "Plastic sheet or like used for packaging and carry bags made in accordance with IS/ISO 17088",
                "default_penalty_rate_inr_kg": 8.0,
                "default_target_percentage": 0.50,
                "requires_extrusive_verification": False,
            },
        ]
        for cat in canonical_categories:
            existing_cat = (await session.execute(
                select(PlasticCategory).where(PlasticCategory.category_code == cat["category_code"]).limit(1)
            )).scalar_one_or_none()
            if not existing_cat:
                session.add(PlasticCategory(**cat))
                logger.info(f"[Bootstrap] Seeded PlasticCategory: {cat['category_code']}")

        # 11. Default Facility (FAC-OKHLA-01) for ORG-DEV-001
        existing_facility = (await session.execute(
            select(Facility).where(Facility.facility_id == "FAC-OKHLA-01").limit(1)
        )).scalar_one_or_none()
        if not existing_facility:
            session.add(Facility(
                facility_id="FAC-OKHLA-01",
                org_id="ORG-DEV-001",
                name="Okhla Recycling & Extrusion Plant 2",
                facility_type="recycler_pwp",
                state_code="DL",
                pincode="110020",
                cpcb_pwp_reg_no="CPCB-PWP-DL-2024-8841",
                cto_number="SPCB/DPCC/CTO/2024/9182",
                cto_valid_until=date(2028, 3, 31),
                licensed_capacity_tons_year=12000.0,
                is_active=True,
            ))
            logger.info("[Bootstrap] Seeded Facility: FAC-OKHLA-01")

        # 12. Default E-Way Bill (EWB-2026-99210) for ORG-DEV-001
        existing_ewb = (await session.execute(
            select(EWayBillRecord).where(EWayBillRecord.eway_bill_no == "EWB-2026-99210").limit(1)
        )).scalar_one_or_none()
        if not existing_ewb:
            session.add(EWayBillRecord(
                eway_bill_no="EWB-2026-99210",
                org_id="ORG-DEV-001",
                facility_id="FAC-OKHLA-01",
                transporter_gstin="07AAAAA0000A1Z5",
                vehicle_number="DL-01-AB-1234",
                source_pincode="110001",
                destination_pincode="110020",
                category_code="cat_i_rigid",
                consignment_weight_tons=250.0,
                status="VERIFIED",
                verification_source="NIC_PORTAL",
            ))
            logger.info("[Bootstrap] Seeded EWayBillRecord: EWB-2026-99210")

        # 13. Default Telemetry Batch (BATCH-20260401-001) for ORG-DEV-001
        existing_batch = (await session.execute(
            select(TelemetryBatch).where(TelemetryBatch.batch_id == "BATCH-20260401-001").limit(1)
        )).scalar_one_or_none()
        if not existing_batch:
            session.add(TelemetryBatch(
                batch_id="BATCH-20260401-001",
                facility_id="FAC-OKHLA-01",
                org_id="ORG-DEV-001",
                category_code="cat_i_rigid",
                total_kwh=95000.0,
                actual_melt_kg=250000.0,
                avg_torque_nm=46.5,
                avg_power_factor=0.842,
                avg_power_kw=94.0,
                measured_sec_kwh_per_ton=380.0,
                is_tampered=False,
            ))
            logger.info("[Bootstrap] Seeded TelemetryBatch: BATCH-20260401-001")

        await session.commit()

    logger.info("[Bootstrap] Platform bootstrap complete")
