"""Auditor Agent — bridges Google ADK to the Nimble / Jev fraud-detection service.

This agent wraps the SCADA telemetry evaluation. The underlying call goes to
Nimble (Phase 4) when Ollama is available, with IsolationForest + physics rules
as the ensemble fallback.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from .base_adk import create_llm_agent, run_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Functions
# ---------------------------------------------------------------------------

def fetch_scada_telemetry(recycler_id: str, plant_id: str) -> dict[str, Any]:
    """Fetch the latest SCADA/VFD telemetry batch for a recycling plant.

    Args:
        recycler_id: Recycler identifier
        plant_id: Plant identifier

    Returns:
        Latest telemetry reading
    """
    # In production: calls Pub/Sub data connector (Phase 6)
    return {
        "recycler_id": recycler_id,
        "plant_id": plant_id,
        "torque_nm": 44.6,
        "power_factor": 0.847,
        "active_power_kw": 93.2,
        "vfd_frequency_hz": 50.0,
        "melt_rate_kg_h": 248.0,
        "temperature_c": 215.0,
        "timestamp": "2026-10-01T08:30:00Z",
        "source": "PUBSUB_SCADA_STREAM",
    }


def evaluate_scada_signature(
    torque_nm: float,
    power_factor: float,
    active_power_kw: float,
    vfd_frequency_hz: float,
    melt_rate_kg_h: float,
    reported_volume_tons: float,
) -> dict[str, Any]:
    """Evaluate the SCADA electrical signature for fraud detection.

    Delegates to Nimble (Phase 4 service) when available; falls back to the
    Jev IsolationForest + physics-rules ensemble.

    Args:
        torque_nm: Motor shaft torque
        power_factor: Electrical power factor
        active_power_kw: Active power consumption
        vfd_frequency_hz: VFD drive frequency
        melt_rate_kg_h: Reported polymer melt rate
        reported_volume_tons: Claimed recycled volume

    Returns:
        Audit verdict with confidence score and flags
    """
    # Try Nimble first (will be wired in Phase 4 via nimble_service)
    try:
        import asyncio
        from services.nimble_service import get_nimble_service  # type: ignore[import-not-found]
        nimble = get_nimble_service()
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(
            nimble.evaluate_scada_signature(
                torque_nm=torque_nm,
                power_factor=power_factor,
                active_power_kw=active_power_kw,
                vfd_frequency_hz=vfd_frequency_hz,
                melt_rate_kg_h=melt_rate_kg_h,
                reported_volume_tons=reported_volume_tons,
            )
        )
    except Exception:
        pass  # Fall through to Jev ensemble

    # Jev ensemble fallback
    from services.jev_auditor import get_jev_auditor  # type: ignore[import-not-found]
    jev = get_jev_auditor()
    return jev.evaluate_signature(
        torque_nm=torque_nm,
        power_factor=power_factor,
        active_power_kw=active_power_kw,
        vfd_frequency_hz=vfd_frequency_hz,
        melt_rate_kg_h=melt_rate_kg_h,
        reported_volume_tons=reported_volume_tons,
    )


# ---------------------------------------------------------------------------
# ADK Agent Construction
# ---------------------------------------------------------------------------

AUDITOR_INSTRUCTION = """You are the Auditor Agent (System 1 Reflex) for SynthetIQ's Quad-Core Fraud Audit.

Your job:
1. Fetch live SCADA/VFD telemetry with `fetch_scada_telemetry`.
2. Evaluate the electrical signature with `evaluate_scada_signature` — this calls the
   Nimble 9B decision model (or Jev IsolationForest ensemble as fallback).
3. Interpret the verdict and confidence score.
4. Output a single JSON audit result.

Physics to look for (genuine extrusion):
  - Torque ≥ 15 Nm (viscous polymer load on extruder shaft)
  - Power factor 0.78 – 0.92 (3-phase induction motor under load)
  - Specific energy 0.15 – 1.2 kWh/kg of melt
  - VFD frequency stable around 50 Hz

Red flags (resistive-heater spoofing):
  - Torque < 8 Nm with high power draw (simple heating elements, no motor)
  - Power factor > 0.96 (near-unity = no inductive motor load)
  - Melt rate near zero despite high power consumption

Mandatory JSON output keys:
  recycler_id, plant_id, reported_volume_tons, physical_melt_verified,
  confidence_score, is_spoofed, verdict, flags, verified_tons, detection_mode
"""

auditor_agent = create_llm_agent(
    name="auditor_agent",
    instruction=AUDITOR_INSTRUCTION,
    tools=[fetch_scada_telemetry, evaluate_scada_signature],
    description="SCADA telemetry fraud detection via Nimble System 1 / Jev ensemble",
    output_key="audit_result",
)


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_auditor_agent(
    recycler_id: str,
    plant_id: str,
    reported_volume_tons: float,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Run the Auditor Agent for a recycling plant.

    Args:
        recycler_id: Recycler identifier
        plant_id: Plant identifier
        reported_volume_tons: Volume the recycler claims to have processed
        session_id: Optional ADK session ID

    Returns:
        Audit verdict dict
    """
    logger.info(f"Running auditor_agent for {recycler_id}/{plant_id} — {reported_volume_tons}t")

    result = await run_agent(
        agent=auditor_agent,
        user_message=(
            f"Audit recycler '{recycler_id}', plant '{plant_id}', "
            f"reported volume: {reported_volume_tons} tons. "
            "Fetch telemetry, evaluate the SCADA signature, and return a single JSON object."
        ),
        session_id=session_id,
        user_id=recycler_id,
    )

    text = result.get("response", "")
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except (json.JSONDecodeError, IndexError):
        logger.warning("Could not parse JSON from auditor agent; returning raw")
        return {"raw_response": result.get("response", ""), "tool_calls": result.get("tool_calls", [])}
