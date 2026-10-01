"""SynthetIQ Temporal Workflows — durable orchestration of the 8 ADK agents.

Timeout is set per-activity to accommodate real LLM round-trips:
  - Short (60 s): fast, tool-only activities (ERP PO, Form-1 dispatch)
  - Medium (120 s): single-agent LLM calls (liability, regulatory, auction, logistics)
  - Long (180 s): SCADA audit with Nimble + Jev ensemble
"""

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

# ── Timeout constants ────────────────────────────────────────────────────────
_SHORT   = timedelta(seconds=60)
_MEDIUM  = timedelta(seconds=120)
_LONG    = timedelta(seconds=180)


# ---------------------------------------------------------------------------
# Workflow 1: Upstream Liability & Sourcing Planning
# ---------------------------------------------------------------------------

@workflow.defn
class UpstreamLiabilityWorkflow:
    """W1 — Runs Brand Liability Agent and Regulatory Watchdog Agent in sequence."""

    @workflow.run
    async def run(self, company_id: str, fiscal_year: str) -> dict[str, Any]:
        rules = await workflow.execute_activity(
            parse_regulatory_rules_activity,
            args=["CPCB PWM Rules 2026"],
            start_to_close_timeout=_MEDIUM,
        )
        liability = await workflow.execute_activity(
            calculate_brand_liability_activity,
            args=[company_id, fiscal_year],
            start_to_close_timeout=_MEDIUM,
        )
        return {"status": "COMPLETED", "regulatory_rules": rules, "liability": liability}


# ---------------------------------------------------------------------------
# Workflow 2: Liquidity & Continuous Double Auction
# ---------------------------------------------------------------------------

@workflow.defn
class AuctionLiquidityWorkflow:
    """W2 — Runs Treasury Agent for continuous double auction within price corridor."""

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
            start_to_close_timeout=_MEDIUM,
        )
        return {"status": "AUCTION_MATCHED", "result": auction_result}


# ---------------------------------------------------------------------------
# Workflow 3: Quad-Core Fraud Audit
# ---------------------------------------------------------------------------

@workflow.defn
class QuadCoreAuditWorkflow:
    """W3 — Logistics Agent + Auditor Agent (Nimble / Jev) in parallel via Temporal."""

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
            start_to_close_timeout=_MEDIUM,
        )
        audit = await workflow.execute_activity(
            audit_scada_telemetry_activity,
            args=[recycler_id, plant_id, reported_volume_tons,
                  torque_nm, power_factor, active_power_kw, vfd_frequency_hz, melt_rate_kg_h],
            start_to_close_timeout=_LONG,
        )
        return {"status": "AUDIT_COMPLETED", "eway_verification": eway, "audit_verdict": audit}


# ---------------------------------------------------------------------------
# Workflow 4: Settlement & Statutory Dispatch
# ---------------------------------------------------------------------------

@workflow.defn
class SettlementDispatchWorkflow:
    """W4 — ERP Agent (80/20 PO) → Legal Agent (Form-1 DSC dispatch)."""

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
            start_to_close_timeout=_SHORT,
        )
        form1 = await workflow.execute_activity(
            generate_and_dispatch_form1_activity,
            args=[po["po_number"], audit_id, plastic_tons, conversion_factor],
            start_to_close_timeout=_SHORT,
        )
        return {"status": "SETTLED_AND_DISPATCHED", "purchase_order": po, "statutory_form1": form1}


# ---------------------------------------------------------------------------
# Master Workflow: All 8 agents — full EPR compliance saga
# ---------------------------------------------------------------------------

@workflow.defn
class MasterEPRComplianceWorkflow:
    """Master workflow: orchestrates all 8 ADK agents across the full EPR saga.

    Uses Temporal's durable execution to survive API failures and node preemptions.
    Pipeline halts immediately if Jev/Nimble fraud detection triggers.
    """

    @workflow.run
    async def run(
        self,
        company_id: str,
        fiscal_year: str,
        category: str,
        volume_tons: float,
        simulate_spoof: bool = False,
    ) -> dict[str, Any]:

        # ── Stage 1: Liability (Brand Liability Agent) ───────────────────
        liability = await workflow.execute_activity(
            calculate_brand_liability_activity,
            args=[company_id, fiscal_year],
            start_to_close_timeout=_MEDIUM,
        )

        # ── Stage 2a: Regulatory rules (Regulatory Watchdog Agent) ───────
        rules = await workflow.execute_activity(
            parse_regulatory_rules_activity,
            args=["CPCB Plastic Waste Management Amendment Rules 2026"],
            start_to_close_timeout=_MEDIUM,
        )

        # ── Stage 2b: Auction (Treasury Agent) ───────────────────────────
        auction = await workflow.execute_activity(
            execute_double_auction_activity,
            args=[f"RFP-{company_id}", category, volume_tons, 12.0],
            start_to_close_timeout=_MEDIUM,
        )

        # ── Stage 3a: Logistics (Logistics Agent) ────────────────────────
        eway = await workflow.execute_activity(
            verify_eway_bill_activity,
            args=["EWB-2026-99210"],
            start_to_close_timeout=_MEDIUM,
        )

        # ── Stage 3b: SCADA Audit (Auditor Agent → Nimble / Jev) ─────────
        torque = 1.8 if simulate_spoof else 46.5
        pf     = 0.994 if simulate_spoof else 0.842
        kw     = 82.0 if simulate_spoof else 94.0
        melt   = 0.0 if simulate_spoof else 250.0

        audit = await workflow.execute_activity(
            audit_scada_telemetry_activity,
            args=["RECYC-DELHI-01", "PLANT-OKHLA-2", volume_tons,
                  torque, pf, kw, 50.0, melt],
            start_to_close_timeout=_LONG,
        )

        # ── Fraud gate — HALT pipeline if Jev/Nimble detects spoofing ────
        if audit.get("is_spoofed") or not audit.get("physical_melt_verified"):
            return {
                "status": "HALTED_DUE_TO_FRAUD",
                "message": "Nimble/Jev System 1 halted pipeline: fake resistive heaters detected.",
                "company_id": company_id, "category": category,
                "stage_reached": 3,
                "liability": liability, "rules": rules,
                "auction": auction, "audit": audit, "eway": eway,
            }

        # ── Stage 4: Escrow PO (ERP Agent) ───────────────────────────────
        clearing_price = auction.get("clearing_price_inr", 7.8)
        po = await workflow.execute_activity(
            create_escrow_split_po_activity,
            args=[company_id, "RECYC-DELHI-01", audit["audit_id"], volume_tons, clearing_price],
            start_to_close_timeout=_SHORT,
        )

        # ── Stage 5: Form-1 (Legal Agent) ────────────────────────────────
        form1 = await workflow.execute_activity(
            generate_and_dispatch_form1_activity,
            args=[po["po_number"], audit["audit_id"], volume_tons, 1.0],
            start_to_close_timeout=_SHORT,
        )

        return {
            "status": "SUCCESS_FULLY_COMPLIANT",
            "message": "Master EPR Multi-Agent Saga completed — Form-1 accepted by CPCB.",
            "company_id": company_id, "category": category, "volume_tons": volume_tons,
            "liability": liability, "rules": rules, "auction": auction,
            "eway": eway, "audit": audit,
            "purchase_order": po, "statutory_form1": form1,
        }
