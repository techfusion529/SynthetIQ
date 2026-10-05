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

        # 3. Seed Default Data Sources (ERP Sales & Plant SCADA)
        ds_sales_id = "DS-DEV-SALES-001"
        res = await session.execute(select(DataSource).where(DataSource.source_id == ds_sales_id))
        ds_sales = res.scalar_one_or_none()
        if not ds_sales:
            ds_sales = DataSource(
                source_id=ds_sales_id,
                org_id=org_id,
                name="Default ERP Sales Connection",
                source_type="csv",
                purpose="erp_sales",
                description="Local CSV / seed data stream for ERP sales and plastic category packaging records",
                connection_config={
                    "sales_file_path": "./data/seed/sales.csv",
                    "delimiter": ",",
                },
                is_active=True,
            )
            session.add(ds_sales)
            logger.info(f"Seeded DataSource: {ds_sales.name}")

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
                    "base_url": "http://simulator:8001",
                    "telemetry_endpoint": "/scada/telemetry",
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
                # Bind appropriate data source
                bound_ds = None
                if agent_name == "brand_liability":
                    bound_ds = ds_sales_id
                elif agent_name == "auditor":
                    bound_ds = ds_scada_id

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

    logger.info("Database seeding completed successfully.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed_database())
