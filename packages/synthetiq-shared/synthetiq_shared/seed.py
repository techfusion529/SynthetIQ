"""Database initialization and seeding script for SynthetIQ multi-tenant platform.

Creates tables and seeds default organizations, users, data sources,
and default agent configurations.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import sys

# Ensure src can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from synthetiq_shared.database import close_db, get_db_session, init_db
from synthetiq_shared.models import (
    AgentConfiguration,
    DataSource,
    Organization,
    Schedule,
    User,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("synthetiq-seed")


def hash_password(password: str) -> str:
    """Generate SHA-256 hash with salt for local password auth."""
    salt = "synthetiq_salt_"
    return hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()


DEFAULT_AGENTS_CONFIG = [
    {
        "agent_name": "brand_liability",
        "model_name": "gemini-2.0-flash",
        "temperature": 0.2,
        "system_prompt": (
            "You are the Brand Liability Agent. Query ERP sales data, calculate plastic category "
            "weights, apply statutory 1/3 historic debt amortization, and compute net EPR obligation."
        ),
        "parameters": {
            "amortization_fraction": 0.333,
            "target_fiscal_year": "FY2026-27",
            "historical_debt_default_tons": 3600.0,
            "categories": ["cat_i_rigid", "cat_ii_flexible", "cat_iii_mlp", "cat_iv_compostable"],
        },
    },
    {
        "agent_name": "regulatory_watchdog",
        "model_name": "gemini-2.0-flash",
        "temperature": 0.1,
        "system_prompt": (
            "You are the Regulatory Watchdog Agent. Parse CPCB Gazette notifications, extract plastic "
            "waste management rules, and identify statutory base clearing rates and compliance deadlines."
        ),
        "parameters": {
            "jurisdiction": "IN",
            "active_framework": "CPCB Plastic Waste Management Amendment Rules 2026",
            "statutory_base_rate_inr": 12.0,
        },
    },
    {
        "agent_name": "treasury",
        "model_name": "gemini-2.0-flash",
        "temperature": 0.2,
        "system_prompt": (
            "You are the Treasury Agent. Run a continuous double auction matching EPR liability bids "
            "with verified recycler offers within the 30%-100% price corridor."
        ),
        "parameters": {
            "price_corridor_min_pct": 30.0,
            "price_corridor_max_pct": 100.0,
            "clearing_algorithm": "uniform_price",
        },
    },
    {
        "agent_name": "logistics",
        "model_name": "gemini-2.0-flash",
        "temperature": 0.1,
        "system_prompt": (
            "You are the Logistics Agent. Validate GST E-Way bills, GPS waypoints, and weighbridge "
            "slips for recycling transit consignments."
        ),
        "parameters": {
            "require_gps_validation": True,
            "max_distance_variance_km": 15.0,
        },
    },
    {
        "agent_name": "auditor",
        "model_name": "gemini-2.0-flash",
        "temperature": 0.0,
        "system_prompt": (
            "You are the Auditor Agent powered by Nimble System 1 and Jev physics reflex. "
            "Audit extruder SCADA readings for motor torque and power factor to detect fake resistive heater spoofing."
        ),
        "parameters": {
            "mode": "NIMBLE_PRIMARY",
            "torque_threshold_nm": 8.0,
            "power_factor_min": 0.78,
            "power_factor_max": 0.96,
            "confidence_threshold": 0.85,
        },
    },
    {
        "agent_name": "erp",
        "model_name": "gemini-2.0-flash",
        "temperature": 0.1,
        "system_prompt": (
            "You are the ERP Agent. Generate split-escrow purchase orders (80% advance upon audit approval, "
            "20% final settlement upon CPCB portal acknowledgment)."
        ),
        "parameters": {
            "escrow_advance_pct": 80.0,
            "escrow_final_pct": 20.0,
            "currency": "INR",
        },
    },
    {
        "agent_name": "legal",
        "model_name": "gemini-2.0-flash",
        "temperature": 0.1,
        "system_prompt": (
            "You are the Legal Agent. Generate statutory CPCB Form-1 filing packets, apply cryptographic "
            "Digital Signature Certificate (DSC), and archive in the tamper-proof vault."
        ),
        "parameters": {
            "authorized_signatory": "Chief Compliance Officer",
            "statutory_form": "Form-1 Plastic Waste Management",
            "dsc_enabled": True,
        },
    },
]


async def seed_database() -> None:
    """Run table creation and populate initial multi-tenant records."""
    logger.info("Initializing database schema...")
    await init_db()

    async with get_db_session() as session:
        # 1. Seed or update default Organization
        org_id = "ORG-DEV-001"
        res = await session.execute(select(Organization).where(Organization.org_id == org_id))
        org = res.scalar_one_or_none()
        if not org:
            org = Organization(
                org_id=org_id,
                name="Hindustan Consumer Goods Ltd",
                industry_sector="FMCG",
                gstin="27AAACH1234F1Z5",
                country="IN",
                annual_plastic_footprint_tons=18500.0,
                is_active=True,
                settings={"env": "development", "timezone": "Asia/Kolkata"},
            )
            session.add(org)
            logger.info(f"Seeded Organization: {org.name} ({org_id})")
        else:
            logger.info(f"Organization {org_id} already exists")

        # 2. Seed Default Admin User
        admin_email = "compliance_officer@synthetiq.ai"
        res = await session.execute(select(User).where(User.email == admin_email))
        admin_user = res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                user_id="USR-ADMIN-001",
                email=admin_email,
                password_hash=hash_password("Password123!"),
                display_name="Dev Compliance Officer",
                role="admin",
                org_id=org_id,
                is_active=True,
            )
            session.add(admin_user)
            logger.info(f"Seeded Admin User: {admin_email}")

        # 3. Seed Default Data Sources (BigQuery ERP Sales & Plant SCADA)
        ds_sales_id = "DS-DEV-SALES-001"
        res = await session.execute(select(DataSource).where(DataSource.source_id == ds_sales_id))
        ds_sales = res.scalar_one_or_none()
        if not ds_sales:
            ds_sales = DataSource(
                source_id=ds_sales_id,
                org_id=org_id,
                name="Google BigQuery ERP Sales Connection",
                source_type="bigquery",
                purpose="erp_sales",
                description="Live Google BigQuery dataset (synthetiq-dev.epr_compliance.sales_data)",
                connection_config={
                    "project_id": "synthetiq-dev",
                    "dataset_id": "epr_compliance",
                    "sales_table": "sales_data",
                },
                is_active=True,
            )
            session.add(ds_sales)
            logger.info(f"Seeded DataSource: {ds_sales.name} (BigQuery)")

        ds_scada_id = "DS-DEV-SCADA-001"
        res = await session.execute(select(DataSource).where(DataSource.source_id == ds_scada_id))
        ds_scada = res.scalar_one_or_none()
        if not ds_scada:
            ds_scada = DataSource(
                source_id=ds_scada_id,
                org_id=org_id,
                name="Okhla Plant Extruder SCADA Feed",
                source_type="rest_api",
                purpose="scada_telemetry",
                description="High-frequency extruder telemetry (motor torque, power factor, melt rate)",
                connection_config={
                    "base_url": "http://simulator:9091",
                    "telemetry_endpoint": "/telemetry/genuine",
                },
                is_active=True,
            )
            session.add(ds_scada)
            logger.info(f"Seeded DataSource: {ds_scada.name}")

        # 4. Seed Default Agent Configurations for all 8 agents
        for agent_def in DEFAULT_AGENTS_CONFIG:
            agent_name = agent_def["agent_name"]
            res = await session.execute(
                select(AgentConfiguration)
                .where(AgentConfiguration.org_id == org_id)
                .where(AgentConfiguration.agent_name == agent_name)
            )
            existing_agent = res.scalar_one_or_none()
            if not existing_agent:
                bound_ds = ds_sales_id if agent_name == "brand_liability" else (ds_scada_id if agent_name == "auditor" else None)
                agent_cfg = AgentConfiguration(
                    org_id=org_id,
                    agent_name=agent_name,
                    data_source_id=bound_ds,
                    model_name=agent_def["model_name"],
                    temperature=agent_def["temperature"],
                    system_prompt=agent_def["system_prompt"],
                    parameters=agent_def["parameters"],
                    is_active=True,
                )
                session.add(agent_cfg)
                logger.info(f"Seeded AgentConfiguration: {agent_name} for org {org_id}")

        # 5. Seed Historical & Live Audit Records (including HITL exception case)
        from synthetiq_shared.models import AuditRecord, AuctionRecord, EscrowPORecord
        res = await session.execute(select(AuditRecord).limit(1))
        if not res.scalar_one_or_none():
            audits_to_seed = [
                AuditRecord(
                    audit_id="AUD-2026-881",
                    recycler_id="RECYC-DELHI-01",
                    plant_id="PLANT-OKHLA-2",
                    plastic_category="cat_i_rigid",
                    reported_volume_tons=250.0,
                    verified_physical_melt_tons=248.6,
                    physical_melt_verified=True,
                    confidence_score=0.965,
                    eway_bill_verified=True,
                    audit_verdict="APPROVED",
                    rejection_reasons=[],
                    audit_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                    physics={"torque_nm": 45.2, "power_factor": 0.848, "active_power_kw": 94.5, "melt_rate_kg_h": 248.0},
                    triggered_by="system_seed",
                ),
                AuditRecord(
                    audit_id="AUD-2026-883",
                    recycler_id="RECYC-SURAT-02",
                    plant_id="PLANT-GIDC-3",
                    plastic_category="cat_ii_flexible",
                    reported_volume_tons=320.0,
                    verified_physical_melt_tons=0.0,
                    physical_melt_verified=False,
                    confidence_score=0.120,
                    eway_bill_verified=True,
                    audit_verdict="REJECTED_FRAUD",
                    rejection_reasons=["SPOOF_DETECTED: Resistive space heaters  -  no extruder shaft torque (2.1 Nm < 8.0 Nm)"],
                    audit_hash="a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
                    physics={"torque_nm": 2.1, "power_factor": 0.992, "active_power_kw": 85.0, "melt_rate_kg_h": 8.5},
                    triggered_by="system_seed",
                ),
                AuditRecord(
                    audit_id="AUD-2026-885",
                    recycler_id="RECYC-NOIDA-03",
                    plant_id="PLANT-SEC62-1",
                    plastic_category="cat_i_rigid",
                    reported_volume_tons=210.0,
                    verified_physical_melt_tons=0.0,
                    physical_melt_verified=False,
                    confidence_score=0.450,
                    eway_bill_verified=True,
                    audit_verdict="PENDING_HITL_REVIEW",
                    rejection_reasons=["PHYSICAL_MASS_ENERGY_MISMATCH: Delta_mass=8.42% > 2.0% statutory threshold (Claimed=210.0t vs Theoretical=192.3t)"],
                    audit_hash="f5e4d3c2b1a09876543210fedcba9876543210fedcba9876543210fedcba9876",
                    physics={"torque_nm": 41.0, "power_factor": 0.860, "active_power_kw": 78.0, "melt_rate_kg_h": 210.0},
                    triggered_by="system_seed",
                ),
            ]
            for ar in audits_to_seed:
                session.add(ar)
            logger.info("Seeded AuditRecords (genuine, fraud, and pending HITL exception)")

        # 6. Seed Default Auctions and Escrow POs
        res = await session.execute(select(AuctionRecord).limit(1))
        if not res.scalar_one_or_none():
            auc = AuctionRecord(
                auction_id="AUC-2026-001",
                category="cat_i_rigid",
                target_tons=250.0,
                statutory_rate_per_kg=12.0,
                floor_price_inr=3.60,
                ceiling_price_inr=12.0,
                clearing_price_inr=7.80,
                total_cleared_tons=250.0,
                status="MATCHED",
                company_id=org_id,
                winning_recyclers=[{"recycler_id": "RECYC-DELHI-01", "tons": 250.0, "price": 7.80}],
            )
            session.add(auc)
            logger.info("Seeded AuctionRecord: AUC-2026-001")

        res = await session.execute(select(EscrowPORecord).limit(1))
        if not res.scalar_one_or_none():
            po = EscrowPORecord(
                po_number="PO-2026-EPR-001",
                company_id=org_id,
                recycler_id="RECYC-DELHI-01",
                recycler_name="Delhi Clean Plastics Ltd",
                category="cat_i_rigid",
                plastic_tons=248.6,
                total_amount_inr=1939080.0,
                advance_amount_inr=1551264.0,  # 80%
                retention_amount_inr=387816.0,  # 20%
                status="HELD_IN_ESCROW",
                escrow_account="ESCROW-HDFC-9921",
                audit_id="AUD-2026-881",
            )
            session.add(po)
            logger.info("Seeded EscrowPORecord: PO-2026-EPR-001")



    logger.info("Database seeding completed successfully.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed_database())
