"""SynthetIQ Native Temporal Workflows orchestration."""

from __future__ import annotations

from datetime import timedelta
from typing import Any
from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from src.activities.agent_activities import (
        audit_scada_telemetry_activity,
        calculate_brand_liability_activity,
        create_escrow_split_po_activity,
        execute_double_auction_activity,
        generate_and_dispatch_form1_activity,
        parse_regulatory_rules_activity,
        verify_eway_bill_activity,
    )


@workflow.defn
class UpstreamLiabilityWorkflow:
    """Workflow 1: Upstream Liability & Sourcing Planning."""

    @workflow.run
    async def run(self, company_id: str, fiscal_year: str) -> dict[str, Any]:
        rules = await workflow.execute_activity(
            parse_regulatory_rules_activity,
            args=["CPCB PWM Rules 2026"],
            start_to_close_timeout=timedelta(seconds=30),
        )
        liability = await workflow.execute_activity(
            calculate_brand_liability_activity,
            args=[company_id, fiscal_year],
            start_to_close_timeout=timedelta(seconds=30),
        )
        return {
            "status": "COMPLETED",
            "regulatory_rules": rules,
            "liability": liability,
        }


@workflow.defn
class AuctionLiquidityWorkflow:
    """Workflow 2: Liquidity & Continuous Double Auction."""

    @workflow.run
    async def run(
        self,
        company_id: str,
        category: str,
        target_tons: float,
        statutory_base_rate: float = 12.0,
    ) -> dict[str, Any]:
        auction_result = await workflow.execute_activity(
            execute_double_auction_activity,
            args=[f"RFP-{company_id}", category, target_tons, statutory_base_rate],
            start_to_close_timeout=timedelta(seconds=30),
        )
        return {
            "status": "AUCTION_MATCHED",
            "result": auction_result,
        }


@workflow.defn
class QuadCoreAuditWorkflow:
    """Workflow 3: Quad-Core Fraud Audit (The Core Reflex)."""

    @workflow.run
    async def run(
        self,
        recycler_id: str,
        plant_id: str,
        reported_volume_tons: float,
        torque_nm: float = 45.0,
        power_factor: float = 0.85,
        active_power_kw: float = 95.0,
        vfd_frequency_hz: float = 50.0,
        melt_rate_kg_h: float = 250.0,
    ) -> dict[str, Any]:
        eway = await workflow.execute_activity(
            verify_eway_bill_activity,
            args=["EWB-2026-99210"],
            start_to_close_timeout=timedelta(seconds=30),
        )
        audit = await workflow.execute_activity(
            audit_scada_telemetry_activity,
            args=[
                recycler_id,
                plant_id,
                reported_volume_tons,
                torque_nm,
                power_factor,
                active_power_kw,
                vfd_frequency_hz,
                melt_rate_kg_h,
            ],
            start_to_close_timeout=timedelta(seconds=30),
        )
        return {
            "status": "AUDIT_COMPLETED",
            "eway_verification": eway,
            "audit_verdict": audit,
        }


@workflow.defn
class SettlementDispatchWorkflow:
    """Workflow 4: Settlement & Statutory Dispatch."""

    @workflow.run
    async def run(
        self,
        company_id: str,
        recycler_id: str,
        audit_id: str,
        plastic_tons: float,
        unit_price_inr: float = 7.5,
        conversion_factor: float = 1.0,
    ) -> dict[str, Any]:
        po = await workflow.execute_activity(
            create_escrow_split_po_activity,
            args=[company_id, recycler_id, audit_id, plastic_tons, unit_price_inr],
            start_to_close_timeout=timedelta(seconds=30),
        )
        form1 = await workflow.execute_activity(
            generate_and_dispatch_form1_activity,
            args=[po["po_number"], audit_id, plastic_tons, conversion_factor],
            start_to_close_timeout=timedelta(seconds=30),
        )
        return {
            "status": "SETTLED_AND_DISPATCHED",
            "purchase_order": po,
            "statutory_form1": form1,
        }


@workflow.defn
class MasterEPRComplianceWorkflow:
    """Master Multi-Agent Workflow: Orchestrates end-to-end EPR compliance across all 8 agents."""

    @workflow.run
    async def run(
        self,
        company_id: str,
        fiscal_year: str,
        category: str,
        volume_tons: float,
        simulate_spoof: bool = False,
    ) -> dict[str, Any]:
        # Stage 1: Upstream Liability Agent
        liability = await workflow.execute_activity(
            calculate_brand_liability_activity,
            args=[company_id, fiscal_year],
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Stage 2: Regulatory & Continuous Double Auction
        rules = await workflow.execute_activity(
            parse_regulatory_rules_activity,
            args=["CPCB Plastic Waste Management Amendment Rules 2026"],
            start_to_close_timeout=timedelta(seconds=30),
        )
        auction = await workflow.execute_activity(
            execute_double_auction_activity,
            args=[f"RFP-{company_id}", category, volume_tons, 12.0],
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Stage 3: Quad-Core Fraud Audit (SCADA VFD + GST E-Way)
        eway = await workflow.execute_activity(
            verify_eway_bill_activity,
            args=["EWB-2026-99210"],
            start_to_close_timeout=timedelta(seconds=30),
        )

        torque = 1.8 if simulate_spoof else 46.5
        pf = 0.994 if simulate_spoof else 0.842
        kw = 82.0 if simulate_spoof else 94.0

        audit = await workflow.execute_activity(
            audit_scada_telemetry_activity,
            args=[
                "RECYC-DELHI-01",
                "PLANT-OKHLA-2",
                volume_tons,
                torque,
                pf,
                kw,
                50.0,
                0.0 if simulate_spoof else 250.0,
            ],
            start_to_close_timeout=timedelta(seconds=30),
        )

        # If fraud detected by Jev Reflex, HALT pipeline
        if audit.get("is_spoofed") or not audit.get("physical_melt_verified"):
            return {
                "status": "HALTED_DUE_TO_FRAUD",
                "message": "TypeSafe Jev System 1 Reflex halted pipeline: Fake resistive heaters detected.",
                "company_id": company_id,
                "category": category,
                "stage_reached": 3,
                "liability": liability,
                "auction": auction,
                "audit": audit,
                "eway": eway,
            }

        # Stage 4: 80/20 Escrow Purchase Order
        clearing_price = auction.get("clearing_price_inr", 7.8)
        po = await workflow.execute_activity(
            create_escrow_split_po_activity,
            args=[company_id, "RECYC-DELHI-01", audit["audit_id"], volume_tons, clearing_price],
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Stage 5: CPCB Form-1 Signing & Dispatch
        form1 = await workflow.execute_activity(
            generate_and_dispatch_form1_activity,
            args=[po["po_number"], audit["audit_id"], volume_tons, 1.0],
            start_to_close_timeout=timedelta(seconds=30),
        )

        return {
            "status": "SUCCESS_FULLY_COMPLIANT",
            "message": "Master EPR Multi-Agent Saga completed with verified Form-1 acceptance.",
            "company_id": company_id,
            "category": category,
            "volume_tons": volume_tons,
            "liability": liability,
            "auction": auction,
            "eway": eway,
            "audit": audit,
            "purchase_order": po,
            "statutory_form1": form1,
        }
