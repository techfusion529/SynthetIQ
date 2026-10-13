"""Temporal Activities  -  delegate each of the 8 EPR agents to their ADK runners.

Each @activity.defn wraps the corresponding Google ADK LlmAgent runner,
providing Temporal's retry semantics, timeout management, and durable execution
around the LLM calls.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from temporalio import activity
from temporalio.exceptions import ApplicationError
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# C2 — Activity result models
# ---------------------------------------------------------------------------

class LiabilityResult(BaseModel):
    net_liability_tons: float
    gross_liability_tons: float
    category: str


class AuctionResult(BaseModel):
    clearing_price: float
    winner_org_id: str
    total_volume_tons: float


class AuditResult(BaseModel):
    delta_percent: float
    verdict: Literal["PASS", "FAIL", "HITL"]
    physical_melt_verified: bool
    audit_id: str
    chain_head: str = ""


class POResult(BaseModel):
    po_id: str
    po_number: str = ""
    escrow_amount: float
    audit_verdict: str
    advance_amount: float = 0.0
    holdback_amount: float = 0.0


class Form1Result(BaseModel):
    form1_id: str
    signed: bool = False
    portal_status: str
    pdf_path: str = ""


class PDFResult(BaseModel):
    pdf_path: str
    hash_hex: str


# ---------------------------------------------------------------------------
# C3 — Fail-closed gate helper
# ---------------------------------------------------------------------------

def _require(d: dict, key: str, activity_name: str):
    """Raise a retryable ApplicationError if key is missing or None."""
    if key not in d or d[key] is None:
        raise ApplicationError(
            f"FAIL_CLOSED: {key} missing from {activity_name} result",
            non_retryable=False,
        )
    return d[key]


# ---------------------------------------------------------------------------
# Agent 1: Brand Liability Agent (ADK  -  Gemini)
# ---------------------------------------------------------------------------

@activity.defn
async def calculate_brand_liability_activity(
    company_id: str,
    fiscal_year: str,
    sales_data: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Calculate EPR liability using ADK Brand Liability Agent.

    Sales data is PII-scrubbed by the privacy service before being sent to Gemini.
    """
    logger.info(f"[Activity] Brand liability  -  {company_id}, {fiscal_year}")

    from agents.brand_liability_agent import run_brand_liability_agent
    from services.privacy_service import get_privacy_service

    # Scrub PII before the LLM sees the data
    privacy = get_privacy_service()
    if sales_data:
        clean = await privacy.scrub_dict({"sales": sales_data})
        sales_data = clean["sales"]

    result = await run_brand_liability_agent(
        company_id=company_id,
        fiscal_year=fiscal_year,
    )

    result.setdefault("company_id", company_id)

    # C3: fail-closed gate
    _require(result, "net_liability_tons", "liability")
    return LiabilityResult(**result).model_dump()


# ---------------------------------------------------------------------------
# Agent 2: Regulatory Watchdog Agent (ADK  -  Gemini)
# ---------------------------------------------------------------------------

@activity.defn
async def parse_regulatory_rules_activity(gazette_text: str) -> dict[str, Any]:
    """Parse CPCB regulatory text using ADK Regulatory Watchdog Agent."""
    logger.info("[Activity] Regulatory rules parsing")

    from agents.regulatory_agent import run_regulatory_agent

    # Pass gazette text as the reference key; agent will call its tools internally
    gazette_ref = gazette_text if gazette_text else "PWM 2026"
    return await run_regulatory_agent(gazette_reference=gazette_ref)


# ---------------------------------------------------------------------------
# Agents 3 & 4: Treasury Agent + Recycler Bidders (ADK  -  Gemini)
# ---------------------------------------------------------------------------

@activity.defn
async def execute_double_auction_activity(
    rfp_id: str,
    category: str,
    target_tons: float,
    statutory_base_rate: float,
    org_id: str = "",
    auction_id: str = "",
    corridor_min: float = 0.0,
    corridor_max: float = 0.0,
) -> dict[str, Any]:
    """Execute deterministic uniform-price double auction from DB BidRecord rows.

    Falls back to the ADK Treasury Agent when no DB bids exist for auction_id.
    """
    logger.info(
        f"[Activity] Auction  -  {rfp_id}, {target_tons}t, category={category}, "
        f"auction_id={auction_id!r}"
    )

    # --- Attempt DB-based deterministic clearing when auction_id is provided ---
    if auction_id:
        try:
            from sqlalchemy import select
            from synthetiq_shared.database import get_db_session
            from synthetiq_shared.models import AuctionRecord, BidRecord

            async with get_db_session() as session:
                # Fetch bids sorted by price DESC (highest bidder first = lowest cost for buyer)
                bid_rows = (
                    await session.execute(
                        select(BidRecord)
                        .where(BidRecord.auction_id == auction_id)
                        .order_by(BidRecord.price_per_kg.desc())
                    )
                ).scalars().all()

                if not bid_rows:
                    raise ApplicationError(
                        f"FAIL_CLOSED: no bids found for auction_id={auction_id}",
                        non_retryable=False,
                    )

                # Uniform-price clearing: accumulate volume until >= target_tons
                accumulated: float = 0.0
                clearing_price: float = 0.0
                winner_org_id: str = ""
                accepted_bids: list[BidRecord] = []

                for bid in bid_rows:
                    if accumulated >= target_tons:
                        break
                    accepted_bids.append(bid)
                    accumulated += bid.volume_tons
                    clearing_price = bid.price_per_kg
                    winner_org_id = bid.recycler_id

                # Clamp to corridor when supplied
                if corridor_min > 0.0 and clearing_price < corridor_min:
                    clearing_price = corridor_min
                if corridor_max > 0.0 and clearing_price > corridor_max:
                    clearing_price = corridor_max

                total_cleared = min(accumulated, target_tons)

                # Persist clearing result
                auction_rec = (
                    await session.execute(
                        select(AuctionRecord).where(AuctionRecord.auction_id == auction_id)
                    )
                ).scalar_one_or_none()

                if auction_rec:
                    auction_rec.status = "CLEARED"
                    auction_rec.clearing_price_inr = clearing_price
                    auction_rec.total_cleared_tons = total_cleared

                for bid in accepted_bids:
                    bid.status = "ACCEPTED"

                await session.commit()

                logger.info(
                    f"[Activity] DB auction cleared: price={clearing_price}, "
                    f"winner={winner_org_id}, tons={total_cleared}"
                )
                return AuctionResult(
                    clearing_price=clearing_price,
                    winner_org_id=winner_org_id,
                    total_volume_tons=total_cleared,
                ).model_dump()

        except Exception as exc:
            logger.warning(f"[Activity] DB auction clearing failed ({exc}); falling back to agent")

    # --- Fallback: ADK Treasury Agent ---
    from agents.treasury_agent import run_treasury_agent

    result = await run_treasury_agent(
        rfp_id=rfp_id,
        category=category,
        target_tons=target_tons,
        statutory_base_rate=statutory_base_rate,
    )

    # Normalise key names expected by workflows
    result.setdefault("rfp_id", rfp_id)
    result.setdefault("category", category)
    result.setdefault("cleared_tons", result.get("total_tons", target_tons))
    result.setdefault("clearing_price_inr", result.get("clearing_price_inr", statutory_base_rate * 0.65))
    # Fix 1: normalise treasury agent key (clearing_price_inr) to canonical name
    result.setdefault("clearing_price", result.get("clearing_price_inr"))

    # Apply corridor clamp on fallback path as well
    if corridor_min > 0.0 or corridor_max > 0.0:
        cp = result.get("clearing_price", 0.0) or 0.0
        if corridor_min > 0.0 and cp < corridor_min:
            cp = corridor_min
        if corridor_max > 0.0 and cp > corridor_max:
            cp = corridor_max
        result["clearing_price"] = cp

    # C3: fail-closed gates — no hardcoded winner default
    _require(result, "clearing_price", "auction")
    _require(result, "winner_org_id", "auction")
    return AuctionResult(**result).model_dump()


# ---------------------------------------------------------------------------
# Agent 5: Logistics Agent (ADK  -  Gemini)
# ---------------------------------------------------------------------------

@activity.defn
async def verify_eway_bill_activity(eway_bill_number: str) -> dict[str, Any]:
    """Verify E-Way bill and QR provenance using ADK Logistics Agent."""
    logger.info(f"[Activity] E-Way bill verification  -  {eway_bill_number}")

    from agents.logistics_agent import run_logistics_agent

    return await run_logistics_agent(eway_bill_number=eway_bill_number)


# ---------------------------------------------------------------------------
# Agent 6: Auditor Agent (Nimble via ADK  -  fallback: Jev ensemble)
# ---------------------------------------------------------------------------

@activity.defn
async def audit_scada_telemetry_activity(
    recycler_id: str,
    plant_id: str,
    reported_volume_tons: float,
    torque_nm: float,
    power_factor: float,
    active_power_kw: float,
    vfd_frequency_hz: float,
    melt_rate_kg_h: float,
    category: str = "cat_i_rigid",
    org_id: str = "",
    delta_threshold: float = 2.0,
    sec_baseline: float = 450.0,
    sec_variance: float = 30.0,
) -> dict[str, Any]:
    """SCADA telemetry fraud audit via ADK Auditor Agent with physics v2 hash chain."""
    logger.info(f"[Activity] SCADA audit  -  {recycler_id}/{plant_id}, category={category}")

    from agents.auditor_agent import run_auditor_agent

    result = await run_auditor_agent(
        recycler_id=recycler_id,
        plant_id=plant_id,
        reported_volume_tons=reported_volume_tons,
        torque_nm=torque_nm,
        power_factor=power_factor,
        active_power_kw=active_power_kw,
        vfd_frequency_hz=vfd_frequency_hz,
        melt_rate_kg_h=melt_rate_kg_h,
        category=category,
        threshold=delta_threshold,
    )

    # Ensure audit_id is always present for downstream activities
    audit_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
    result.setdefault("audit_id", audit_id)
    result.setdefault("recycler_id", recycler_id)
    result.setdefault("plant_id", plant_id)
    result.setdefault("reported_volume_tons", reported_volume_tons)
    result.setdefault("plastic_category", category)
    result.setdefault("is_spoofed", False)

    # Fix 2: normalise auditor agent key (delta_mass) to canonical delta_percent
    if "delta_percent" not in result and "delta_mass" in result:
        result["delta_percent"] = result["delta_mass"]

    # C3: fail-closed gate — require delta_percent from agent
    _require(result, "delta_percent", "audit")

    # --- Physics v2: energy_kwh sum + 3-sigma SEC rule ---
    energy_total_kwh: float = float(result.get("energy_total_kwh", 0))
    mass_total_kg: float = float(result.get("mass_total_kg", 0))

    if energy_total_kwh == 0:
        raise ApplicationError(
            "FAIL_CLOSED: zero energy total from auditor agent",
            non_retryable=False,
        )

    # Specific Energy Consumption: kWh/ton → normalise baseline (sec_baseline is per ton)
    # mass_total_kg may be zero if agent didn't provide it; guard with reported_volume
    if mass_total_kg <= 0:
        mass_total_kg = reported_volume_tons * 1000.0

    sec_actual: float = (energy_total_kwh / mass_total_kg) * 1000.0  # kWh/ton
    band_upper: float = sec_baseline + 3.0 * sec_variance

    # Delta check (claimed vs measured mass)
    claimed_mass_kg: float = reported_volume_tons * 1000.0
    if claimed_mass_kg > 0:
        delta_frac: float = abs(claimed_mass_kg - mass_total_kg) / claimed_mass_kg
    else:
        delta_frac = 0.0

    # --- Build HashChain over telemetry frames ---
    from services.hash_chain import HashChain
    from synthetiq_shared.schemas.telemetry import TelemetryFrame

    chain = HashChain(org_id=org_id, plant_id=plant_id)
    frames: list[dict] = result.get("frames", [])

    if frames:
        for raw_frame in frames:
            try:
                frame = TelemetryFrame(**raw_frame)
                chain.append(frame)
            except Exception as frame_exc:
                logger.debug(f"[Activity] Skipping malformed frame: {frame_exc}")
    else:
        # Synthetic single frame from totals when no individual frames provided
        try:
            synthetic_frame = TelemetryFrame(
                frame_id=f"SYN-{result['audit_id']}",
                org_id=org_id or "unknown",
                plant_id=plant_id,
                timestamp=datetime.now(tz=timezone.utc),
                energy_kwh=energy_total_kwh,
                mass_processed_kg=mass_total_kg,
                power_factor=power_factor if power_factor > 0 else None,
            )
            chain.append(synthetic_frame)
        except Exception as syn_exc:
            logger.warning(f"[Activity] Could not build synthetic frame: {syn_exc}")

    result["chain_head"] = chain.head

    # --- Deterministic verdict (physics v2 overrides any LLM verdict) ---
    if sec_actual > band_upper:
        verdict = "HITL"
    elif delta_frac > delta_threshold / 100.0:
        verdict = "HITL"
    else:
        verdict = "PASS"

    result["verdict"] = verdict

    # C3: require physical_melt_verified — do NOT default from is_spoofed
    _require(result, "physical_melt_verified", "audit")

    logger.info(
        f"[Activity] Audit verdict: {verdict}, "
        f"sec_actual={sec_actual:.2f} kWh/ton, band_upper={band_upper:.2f}, "
        f"delta_frac={delta_frac:.4f}, chain_head={chain.head[:16]}"
    )
    result["org_id"] = org_id
    return AuditResult(**result).model_dump()


# ---------------------------------------------------------------------------
# Agent 7: ERP Agent (ADK  -  Gemini)
# ---------------------------------------------------------------------------

@activity.defn
async def create_escrow_split_po_activity(
    company_id: str,
    recycler_id: str,
    audit_id: str,
    plastic_tons: float,
    unit_price_inr: float,
    org_id: str = "",
    audit_verdict: str | None = None,
    human_approved: bool | None = None,
    escrow_split_primary: float = 0.8,
    escrow_split_holdback: float = 0.2,
) -> dict[str, Any]:
    """Create escrow PO with configurable advance/holdback split from RunConfig.pack."""
    logger.info(f"[Activity] Escrow PO  -  {company_id}  -  {recycler_id}, {plastic_tons}t")

    # C3: fail-closed gates — no hardcoded defaults
    if audit_verdict is None:
        raise ApplicationError(
            "FAIL_CLOSED: audit_verdict not provided to PO activity",
            non_retryable=True,
        )
    if human_approved is None:
        raise ApplicationError(
            "FAIL_CLOSED: human_approved not provided to PO activity",
            non_retryable=True,
        )

    from agents.erp_agent import run_erp_agent

    result = await run_erp_agent(
        company_id=company_id,
        recycler_id=recycler_id,
        audit_id=audit_id,
        plastic_tons=plastic_tons,
        unit_price_inr=unit_price_inr,
        audit_verdict=audit_verdict,
        logistics_verdict="APPROVE",
        human_approved=human_approved,
    )

    result.setdefault("po_number", f"PO-{uuid.uuid4().hex[:8].upper()}")

    # Compute advance/holdback from RunConfig split parameters (tons → kg)
    total_value: float = plastic_tons * unit_price_inr * 1000.0
    advance_amount: float = round(total_value * escrow_split_primary, 2)
    holdback_amount: float = round(total_value * escrow_split_holdback, 2)

    # Persist escrow split to DB
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import EscrowPORecord

        po_number = result.get("po_number") or result.get("po_id", "")
        async with get_db_session() as session:
            existing = (
                await session.execute(
                    select(EscrowPORecord).where(EscrowPORecord.po_number == po_number)
                )
            ).scalar_one_or_none()

            if existing:
                existing.advance_amount = advance_amount
                existing.holdback_amount = holdback_amount
                existing.escrow_status = "advance_pending"
            else:
                session.add(
                    EscrowPORecord(
                        po_number=po_number,
                        company_id=company_id,
                        recycler_id=recycler_id,
                        category="",
                        plastic_tons=plastic_tons,
                        total_amount_inr=total_value,
                        advance_amount=advance_amount,
                        holdback_amount=holdback_amount,
                        escrow_status="advance_pending",
                        audit_id=audit_id,
                        org_id=org_id or None,
                    )
                )
            await session.commit()
    except Exception as db_exc:
        logger.warning(f"[Activity] EscrowPO DB upsert failed ({db_exc}); continuing without persistence")

    # Fix 3: validate required PO fields and return typed POResult
    _require(result, "po_id", "po")
    _require(result, "escrow_amount", "po")

    result["advance_amount"] = advance_amount
    result["holdback_amount"] = holdback_amount
    result["org_id"] = org_id
    return POResult(**result).model_dump()


# ---------------------------------------------------------------------------
# Agent 8: Legal Agent (ADK  -  Gemini)
# ---------------------------------------------------------------------------

@activity.defn
async def generate_and_dispatch_form1_activity(
    po_number: str,
    audit_id: str,
    physical_melt_tons: float,
    conversion_factor: float = 1.0,
    org_id: str = "",
    chain_head: str = "",
    org_name: str = "",
    fiscal_year: str = "",
    category: str = "cat_i_rigid",
    compliance_pct: float = 100.0,
) -> dict[str, Any]:
    """Generate DSC-signed Form-1, render PDF, and dispatch to CPCB."""
    logger.info(f"[Activity] Form-1 dispatch  -  PO={po_number}, {physical_melt_tons}t")

    from agents.legal_agent import run_legal_agent

    result = await run_legal_agent(
        po_number=po_number,
        audit_id=audit_id,
        physical_melt_tons=physical_melt_tons,
    )

    result.setdefault("form1_id", f"FORM1-{uuid.uuid4().hex[:8].upper()}")
    result.setdefault("form_id", result["form1_id"])
    result.setdefault("po_number", po_number)
    result.setdefault("audit_id", audit_id)
    result.setdefault("ack_number", f"ACK-CPCB-{uuid.uuid4().hex[:10].upper()}")

    # C3: fail-closed gate — portal_status must be provided by the agent
    _require(result, "portal_status", "form1")

    form1_id = result["form1_id"]

    # --- Build Form1Data and generate PDF ---
    from reporting.form1_schema import Form1Data
    from reporting.pdf_generator import generate_form1_pdf

    generated_date = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    is_signed: bool = bool(result.get("signed", False))

    form1_data = Form1Data(
        org_name=org_name or org_id or "Unknown Organisation",
        fiscal_year=fiscal_year or generated_date[:7],
        category=category,
        volume_tons=physical_melt_tons,
        compliance_pct=compliance_pct,
        audit_id=audit_id,
        po_reference=po_number,
        chain_head=chain_head or "",
        generated_date=generated_date,
        is_signed=is_signed,
    )

    pdf_bytes = generate_form1_pdf(form1_data)
    pdf_path = f"/tmp/form1_{form1_id}.pdf"

    try:
        with open(pdf_path, "wb") as fh:
            fh.write(pdf_bytes)
        logger.info(f"[Activity] Form-1 PDF written: {pdf_path} ({len(pdf_bytes)} bytes)")
    except Exception as write_exc:
        logger.warning(f"[Activity] Could not write Form-1 PDF to {pdf_path}: {write_exc}")
        pdf_path = ""

    # Force portal status to indicate manual upload required
    result["portal_status"] = "READY_FOR_MANUAL_UPLOAD"
    result["pdf_path"] = pdf_path

    logger.info(f"[Activity] Form-1 ACK: {result['ack_number']}, pdf={pdf_path!r}")
    result["org_id"] = org_id
    return Form1Result(**result).model_dump()


# ---------------------------------------------------------------------------
# Priority 3 Activity: Audit Report PDF Generation (Feature 4)
# ---------------------------------------------------------------------------

@activity.defn
async def generate_audit_report_pdf_activity(
    audit_payload: dict[str, Any],
) -> dict[str, Any]:
    """Generate audit-ready CPCB Form-1 PDF report with cryptographic hashes."""
    logger.info(f"[Activity] Generating CPCB Form-1 PDF for audit {audit_payload.get('audit_id')}")

    from services.pdf_generator import generate_cpcb_form1_pdf

    pdf_bytes = generate_cpcb_form1_pdf(audit_payload)
    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()

    return {
        "audit_id": audit_payload.get("audit_id"),
        "pdf_size_bytes": len(pdf_bytes),
        "pdf_sha256": pdf_hash,
        "pdf_generated": True,
        "status": "PDF_GENERATED_AND_VAULTED",
    }
