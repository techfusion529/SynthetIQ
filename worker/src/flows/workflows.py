"""SynthetIQ Temporal Workflows  -  durable orchestration of the 8 ADK agents.

Features:
  - Durable, failure-tolerant multi-agent coordination with zero state loss
  - Priority 1: Human-in-the-Loop (HITL) exception resolution signal & queryable state
  - Priority 2: Formal physical fraud equation (Delta_mass > 2% routing)
  - Priority 3: Tamper-evident CPCB Form-1 PDF report generation
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ApplicationError

with workflow.unsafe.imports_passed_through():
    from activities.agent_activities import (
        audit_scada_telemetry_activity,
        calculate_brand_liability_activity,
        create_escrow_split_po_activity,
        execute_double_auction_activity,
        generate_and_dispatch_form1_activity,
        generate_audit_report_pdf_activity,
        parse_regulatory_rules_activity,
        verify_eway_bill_activity,
    )
    from activities.config_activities import fetch_run_config_activity
    from synthetiq_shared.models import RunInput

# Shared retry policy applied to every activity execution
_RETRY = RetryPolicy(maximum_attempts=3)
_TIMEOUT = timedelta(minutes=5)


# ---------------------------------------------------------------------------
# Priority 1: HITL Decision Payload Model
# ---------------------------------------------------------------------------

@dataclass
class HumanApprovalSignal:
    """Input payload sent via Temporal signal by compliance officers in the HITL console."""
    approved: bool
    notes: str = ""
    auditor_id: str = "COMPLIANCE-AUDITOR-01"
    reason_code: str = "MANUAL_PHYSICS_OVERRIDE"
    override_tons: float | None = None
    signature_hash: str | None = None


# Backward-compatible alias — keeps old wire name working until FEAT-002 rewires settlement.py
AuditDecisionInput = HumanApprovalSignal


# ---------------------------------------------------------------------------
# Workflow 1: Upstream Liability & Sourcing Planning
# ---------------------------------------------------------------------------

@workflow.defn
class UpstreamLiabilityWorkflow:
    """W1  -  Runs Brand Liability Agent and Regulatory Watchdog Agent in sequence."""

    @workflow.run
    async def run(self, company_id: str, fiscal_year: str) -> dict[str, Any]:
        rules = await workflow.execute_activity(
            parse_regulatory_rules_activity,
            args=["CPCB PWM Rules 2026"],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )
        liability = await workflow.execute_activity(
            calculate_brand_liability_activity,
            args=[company_id, fiscal_year],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )
        return {"status": "COMPLETED", "regulatory_rules": rules, "liability": liability}


# ---------------------------------------------------------------------------
# Workflow 2: Liquidity & Continuous Double Auction
# ---------------------------------------------------------------------------

@workflow.defn
class AuctionLiquidityWorkflow:
    """W2  -  Runs Treasury Agent for continuous double auction within price corridor."""

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
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )
        return {"status": "AUCTION_MATCHED", "result": auction_result}


# ---------------------------------------------------------------------------
# Workflow 3: Quad-Core Fraud Audit with HITL Signal Handler
# ---------------------------------------------------------------------------

@workflow.defn
class QuadCoreAuditWorkflow:
    """W3  -  Logistics Agent + Auditor Agent with HITL Signal Exception Resolution."""

    def __init__(self) -> None:
        self._approval_received: bool = False
        self.auditor_approved: bool | None = None
        self.auditor_notes: str | None = None
        self.auditor_id: str | None = None
        self.auditor_reason_code: str | None = None
        self.override_tons: float | None = None
        self._signal_input: HumanApprovalSignal | None = None
        self.current_status: str = "RUNNING"
        self.requires_hitl: bool = False
        self.delta_mass: float = 0.0
        self.fraud_risk_score: float = 0.0
        self.audit_verdict: dict[str, Any] = {}

    @workflow.signal(name="human_approval")
    async def resolve_audit_exception(self, decision: HumanApprovalSignal) -> None:
        """Signal handler allowing human compliance officers to approve/reject audit exceptions."""
        self._signal_input = decision
        self.auditor_approved = decision.approved
        self.auditor_notes = decision.notes
        self.auditor_id = decision.auditor_id
        self.auditor_reason_code = decision.reason_code
        self.override_tons = decision.override_tons
        self._approval_received = True

    @workflow.query
    def get_audit_status(self) -> dict[str, Any]:
        """Queryable execution state for the auditor dual-pane console."""
        return {
            "status": self.current_status,
            "requires_hitl": self.requires_hitl,
            "auditor_approved": self.auditor_approved,
            "auditor_notes": self.auditor_notes,
            "auditor_id": self.auditor_id,
            "override_tons": self.override_tons,
            "delta_mass": self.delta_mass,
            "fraud_risk_score": self.fraud_risk_score,
            "audit_verdict": self.audit_verdict,
        }

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
        category: str = "cat_i_rigid",
        eway_bill_ref: str = "",
    ) -> dict[str, Any]:
        self.current_status = "RUNNING_LOGISTICS_AND_TELEMETRY"

        eway = await workflow.execute_activity(
            verify_eway_bill_activity,
            args=[eway_bill_ref or "EWB-UNKNOWN"],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )
        audit = await workflow.execute_activity(
            audit_scada_telemetry_activity,
            args=[
                recycler_id, plant_id, reported_volume_tons,
                torque_nm, power_factor, active_power_kw, vfd_frequency_hz, melt_rate_kg_h,
                category,
            ],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )

        self.audit_verdict = audit
        self.delta_mass = float(audit.get("delta_mass", 0.0))
        self.fraud_risk_score = float(audit.get("fraud_risk_score", 0.0))

        # Check if physical mass-energy mismatch or resistive spoofing requires human review
        needs_hitl = (
            audit.get("requires_hitl", False)
            or audit.get("is_spoofed", False)
            or (self.delta_mass > 0.02)
            or eway.get("status") == "UNVERIFIED"
            or eway.get("requires_hitl", False)
        )
        self.requires_hitl = needs_hitl

        if needs_hitl:
            self.current_status = "PENDING_HITL_REVIEW"
            # Block workflow until human auditor signal arrives
            await workflow.wait_condition(lambda: self._approval_received)

            if self.auditor_approved:
                self.current_status = "AUDIT_APPROVED_BY_HUMAN_AUDITOR"
                effective_tons = (
                    self.override_tons
                    if (self.override_tons is not None and self.override_tons > 0)
                    else reported_volume_tons
                )
                audit["audit_verdict"] = "APPROVED_BY_HUMAN_OVERRIDE"
                audit["physical_melt_verified"] = True
                audit["verified_physical_melt_tons"] = effective_tons
                audit["auditor_notes"] = self.auditor_notes
                audit["auditor_id"] = self.auditor_id
            else:
                self.current_status = "AUDIT_REJECTED_BY_HUMAN_AUDITOR"
                audit["audit_verdict"] = "REJECTED_BY_AUDITOR"
                audit["physical_melt_verified"] = False
                audit["verified_physical_melt_tons"] = 0.0
                audit["auditor_notes"] = self.auditor_notes
                audit["auditor_id"] = self.auditor_id
                return {
                    "status": "HALTED_DUE_TO_AUDITOR_REJECTION",
                    "eway_verification": eway,
                    "audit_verdict": audit,
                    "hitl_resolution": {
                        "approved": False,
                        "notes": self.auditor_notes,
                        "auditor_id": self.auditor_id,
                    },
                }
        else:
            self.current_status = "AUDIT_COMPLETED"

        return {"status": "AUDIT_COMPLETED", "eway_verification": eway, "audit_verdict": audit}


# ---------------------------------------------------------------------------
# Workflow 4: Settlement & Statutory Dispatch
# ---------------------------------------------------------------------------

@workflow.defn
class SettlementDispatchWorkflow:
    """W4  -  ERP Agent (80/20 PO)  - ' Legal Agent (Form-1 DSC dispatch)  - ' PDF Vault."""

    @workflow.run
    async def run(
        self,
        company_id: str,
        recycler_id: str,
        audit_id: str,
        plastic_tons: float,
        unit_price_inr: float = 7.5,
        conversion_factor: float = 1.0,
        org_id: str = "",
    ) -> dict[str, Any]:
        po = await workflow.execute_activity(
            create_escrow_split_po_activity,
            args=[company_id, recycler_id, audit_id, plastic_tons, unit_price_inr, org_id],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )
        form1 = await workflow.execute_activity(
            generate_and_dispatch_form1_activity,
            args=[po["po_number"], audit_id, plastic_tons, conversion_factor, org_id],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )
        pdf_res = await workflow.execute_activity(
            generate_audit_report_pdf_activity,
            args=[{
                "audit_id": audit_id,
                "company_id": company_id,
                "recycler_id": recycler_id,
                "reported_volume_tons": plastic_tons,
                "verified_physical_melt_tons": plastic_tons,
                "unit_price_inr": unit_price_inr,
                "po_number": po["po_number"],
                "audit_verdict": "APPROVED",
            }],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )
        return {
            "status": "SETTLED_AND_DISPATCHED",
            "purchase_order": po,
            "statutory_form1": form1,
            "audit_report_pdf": pdf_res,
        }


# ---------------------------------------------------------------------------
# Master Workflow: All 8 agents  -  full EPR compliance saga with HITL & PDF
# ---------------------------------------------------------------------------

@workflow.defn
class MasterEPRComplianceWorkflow:
    """Master workflow: orchestrates all 8 ADK agents across the full EPR saga.

    Features:
      - Durable execution surviving API failures and reboots
      - Priority 1: Human-in-the-Loop signal handler to inspect & resolve fraud exceptions
      - Priority 2: Deterministic mass-energy Delta_mass equation
      - Priority 3: Official CPCB Form-1 PDF report generation
    """

    def __init__(self) -> None:
        self._approval_received: bool = False
        self.auditor_approved: bool | None = None
        self.auditor_notes: str | None = None
        self.auditor_id: str | None = None
        self.auditor_reason_code: str | None = None
        self.override_tons: float | None = None
        self._signal_input: HumanApprovalSignal | None = None
        self.current_status: str = "INITIALIZED"
        self.requires_hitl: bool = False
        self.stage_reached: int = 0
        self.delta_mass: float = 0.0
        self.fraud_risk_score: float = 0.0

    @workflow.signal(name="human_approval")
    async def resolve_audit_exception(self, decision: HumanApprovalSignal) -> None:
        """Signal handler for real-time human auditor approval or rejection."""
        self._signal_input = decision
        self.auditor_approved = decision.approved
        self.auditor_notes = decision.notes
        self.auditor_id = decision.auditor_id
        self.auditor_reason_code = decision.reason_code
        self.override_tons = decision.override_tons
        self._approval_received = True

    @workflow.query
    def get_audit_status(self) -> dict[str, Any]:
        """Queryable status for the compliance officer console."""
        return {
            "workflow_status": self.current_status,
            "stage_reached": self.stage_reached,
            "requires_hitl": self.requires_hitl,
            "auditor_approved": self.auditor_approved,
            "auditor_notes": self.auditor_notes,
            "auditor_id": self.auditor_id,
            "override_tons": self.override_tons,
            "delta_mass": self.delta_mass,
            "fraud_risk_score": self.fraud_risk_score,
        }

    @workflow.run
    async def run(self, run_input: RunInput) -> dict[str, Any]:
        # Extract fields from the unified input model
        company_id = run_input.company_id
        category = run_input.category
        volume_tons = run_input.volume_tons
        simulate_spoof = run_input.simulate_spoof
        recycler_id = run_input.recycler_id
        plant_id = run_input.plant_id
        eway_bill_ref = run_input.eway_bill_ref

        # ---- Stage 0: Fetch run config (regulatory pack + org policy + calibrations) ----
        self.stage_reached = 0
        self.current_status = "STAGE_0_FETCHING_RUN_CONFIG"
        run_config_dict = await workflow.execute_activity(
            fetch_run_config_activity,
            args=[run_input.org_id, run_input.regulatory_pack_version],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )
        from synthetiq_shared.models.dynamic_config import RunConfig as _RunConfig
        run_config = _RunConfig(**run_config_dict)

        # Derive fiscal_year from input or from Temporal clock + pack config
        if run_input.fiscal_year:
            fiscal_year = run_input.fiscal_year
        else:
            from datetime import date as _date
            today = workflow.now().date()  # deterministic Temporal clock
            fy_start_month = run_config.pack.fiscal_year_start_month
            if today.month >= fy_start_month:
                fiscal_year = f"FY{today.year}-{str(today.year + 1)[2:]}"
            else:
                fiscal_year = f"FY{today.year - 1}-{str(today.year)[2:]}"

        #  -  -  -  -  Stage 1: Liability (Brand Liability Agent)  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        self.stage_reached = 1
        self.current_status = "STAGE_1_LIABILITY_ASSESSMENT"
        liability = await workflow.execute_activity(
            calculate_brand_liability_activity,
            args=[company_id, fiscal_year],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )

        #  -  -  -  -  Stage 2a: Regulatory rules (Regulatory Watchdog Agent)  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        self.stage_reached = 2
        self.current_status = "STAGE_2_REGULATORY_PARSING"
        rules = await workflow.execute_activity(
            parse_regulatory_rules_activity,
            args=["CPCB Plastic Waste Management Amendment Rules 2026"],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )

        #  -  -  -  -  Stage 2b: Auction (Treasury Agent)  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        auction = await workflow.execute_activity(
            execute_double_auction_activity,
            args=[f"RFP-{company_id}", category, volume_tons, run_config.pack.base_rate_inr_per_kg],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )

        #  -  -  -  -  Stage 3a: Logistics (Logistics Agent)  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        self.stage_reached = 3
        self.current_status = "STAGE_3_LOGISTICS_AND_TELEMETRY"
        eway = await workflow.execute_activity(
            verify_eway_bill_activity,
            args=[eway_bill_ref or "EWB-UNKNOWN"],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )
        eway_requires_hitl = eway.get("status") == "UNVERIFIED" or eway.get("requires_hitl", False)

        #  -  -  -  -  Stage 3b: SCADA Audit (Auditor Agent  - ' Nimble / Jev)  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -
        if not run_config.calibrations:
            raise ApplicationError(
                "FAIL_CLOSED: no calibrations found",
                non_retryable=True,
            )

        torque = 1.8 if simulate_spoof else 46.5
        pf     = 0.994 if simulate_spoof else 0.842
        kw     = 82.0 if simulate_spoof else 94.0
        melt   = 0.0 if simulate_spoof else 250.0

        audit = await workflow.execute_activity(
            audit_scada_telemetry_activity,
            args=[
                recycler_id, plant_id, volume_tons,
                torque, pf, kw, 50.0, melt, category,
                run_input.org_id,
                run_config.pack.delta_threshold_default,
                run_config.calibrations[0].sec_baseline_kwh_per_ton,
                run_config.calibrations[0].sec_variance,
            ],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )

        self.delta_mass = float(audit.get("delta_mass", 0.0))
        self.fraud_risk_score = float(audit.get("fraud_risk_score", 0.0))

        # Check if fraud gate or Delta_mass statutory threshold triggers HITL
        is_fraudulent = (
            audit.get("is_spoofed", False)
            or not audit.get("physical_melt_verified", True)
            or self.delta_mass > 0.02
            or audit.get("requires_hitl", False)
            or eway_requires_hitl
        )

        if is_fraudulent:
            self.requires_hitl = True
            self.current_status = "PENDING_HITL_REVIEW"

            #  -  -  -  -  Priority 1: Block until Human Compliance Auditor Signal  -  -  -  - 
            await workflow.wait_condition(lambda: self._approval_received)

            if not self.auditor_approved:
                self.current_status = "HALTED_DUE_TO_AUDITOR_CONFIRMED_FRAUD"
                return {
                    "status": "HALTED_DUE_TO_FRAUD",
                    "message": "Human Compliance Auditor confirmed fraud exception; pipeline halted.",
                    "company_id": company_id, "category": category,
                    "stage_reached": 3,
                    "liability": liability, "rules": rules,
                    "auction": auction, "audit": audit, "eway": eway,
                    "hitl_resolution": {
                        "approved": False,
                        "notes": self.auditor_notes,
                        "auditor_id": self.auditor_id,
                        "reason_code": self.auditor_reason_code,
                    },
                }

            # If auditor approved override, adjust volume and continue
            self.current_status = "RESUMED_AFTER_HITL_APPROVAL"
            volume_tons = (
                self.override_tons
                if (self.override_tons is not None and self.override_tons > 0)
                else volume_tons
            )
            audit["physical_melt_verified"] = True
            audit["verified_physical_melt_tons"] = volume_tons
            audit["auditor_override_notes"] = self.auditor_notes

        #  -  -  -  -  Stage 4: Escrow PO (ERP Agent)  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        self.stage_reached = 4
        self.current_status = "STAGE_4_ESCROW_SETTLEMENT"
        clearing_price = auction.get("clearing_price_inr", 7.8)
        po = await workflow.execute_activity(
            create_escrow_split_po_activity,
            args=[
                company_id, recycler_id, audit["audit_id"], volume_tons, clearing_price,
                run_input.org_id, None, None,
                run_config.pack.escrow_split_primary,
                run_config.pack.escrow_split_holdback,
            ],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )

        #  -  -  -  -  Stage 5: Form-1 (Legal Agent)  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        self.stage_reached = 5
        self.current_status = "STAGE_5_STATUTORY_FORM1_DISPATCH"
        cf = run_config.pack.conversion_factors.get(category, 1.0)
        form1 = await workflow.execute_activity(
            generate_and_dispatch_form1_activity,
            args=[po["po_number"], audit["audit_id"], volume_tons, cf, run_input.org_id],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )

        #  -  -  -  -  Stage 6: Priority 3 PDF Generation  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        self.stage_reached = 6
        self.current_status = "STAGE_6_PDF_VAULT_GENERATION"
        pdf_res = await workflow.execute_activity(
            generate_audit_report_pdf_activity,
            args=[{
                "audit_id": audit["audit_id"],
                "company_id": company_id,
                "recycler_id": recycler_id,
                "plant_id": plant_id,
                "plastic_category": category,
                "reported_volume_tons": volume_tons,
                "verified_physical_melt_tons": volume_tons,
                "delta_mass": self.delta_mass,
                "theoretical_volume_tons": audit.get("theoretical_volume_tons", volume_tons),
                "sec_kwh_per_kg": audit.get("sec_kwh_per_kg", 0.45),
                "energy_total_kwh": audit.get("energy_total_kwh", 112000.0),
                "audit_hash": audit.get("cryptographic_hash", ""),
                "po_number": po["po_number"],
                "unit_price_inr": clearing_price,
                "audit_verdict": "APPROVED",
                "workflow_run_id": workflow.info().workflow_id,
            }],
            retry_policy=_RETRY,
            start_to_close_timeout=_TIMEOUT,
        )

        self.current_status = "COMPLETED"
        return {
            "status": "SUCCESS_FULLY_COMPLIANT",
            "message": "Master EPR Multi-Agent Saga completed  -  Form-1 accepted by CPCB and PDF vaulted.",
            "company_id": company_id, "category": category, "volume_tons": volume_tons,
            "liability": liability, "rules": rules, "auction": auction,
            "eway": eway, "audit": audit,
            "purchase_order": po, "statutory_form1": form1,
            "audit_report_pdf": pdf_res,
        }
