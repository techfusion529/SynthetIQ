"""Auditor Agent  -  bridges Google ADK to the Nimble / Jev fraud-detection service.

This agent wraps the SCADA telemetry evaluation. The underlying call goes to
Nimble (Phase 4) when Ollama is available, with IsolationForest + physics rules
as the ensemble fallback.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from .base_adk import create_llm_agent, run_agent
from .privacy import scrub

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Functions
# ---------------------------------------------------------------------------

def fetch_scada_telemetry(recycler_id: str, plant_id: str) -> dict[str, Any]:
    """Fetch the latest SCADA/VFD telemetry reading from Google BigQuery."""
    import os
    from datetime import datetime, timezone

    try:
        from google.cloud import bigquery
        client = bigquery.Client(project=os.getenv("GCP_PROJECT_ID", "synthetiq-dev"))
        dataset_id = os.getenv("BIGQUERY_DATASET_ID", "epr_compliance")
        table_id = os.getenv("BIGQUERY_TELEMETRY_TABLE", "scada_telemetry")
        query = f"""
            SELECT plant_id, recycler_id, torque_nm, power_factor, active_power_kw,
                   vfd_frequency_hz, melt_rate_kg_h, temperature_c, simulation_mode, timestamp
            FROM `{client.project}.{dataset_id}.{table_id}`
            WHERE (plant_id = @plant_id OR @plant_id = '')
            ORDER BY timestamp DESC
            LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("plant_id", "STRING", plant_id or ""),
        ])
        rows = list(client.query(query, job_config=job_config).result())
        if rows:
            r = dict(rows[0])
            r["source"] = "BIGQUERY_SCADA_STREAM"
            if hasattr(r.get("timestamp"), "isoformat"):
                r["timestamp"] = r["timestamp"].isoformat()
            return r
    except Exception as exc:
        logger.warning(f"Could not query live BigQuery SCADA telemetry ({exc}); querying simulator HTTP")

    try:
        import httpx
        sim_url = os.getenv("SIMULATOR_URL", "http://localhost:9091")
        resp = httpx.get(f"{sim_url}/telemetry/genuine", timeout=2.0)
        if resp.status_code == 200:
            data = resp.json()
            data["source"] = "SIMULATOR_LIVE_HTTP"
            return data
    except Exception:
        pass

    return {
        "recycler_id": recycler_id,
        "plant_id": plant_id,
        "torque_nm": 45.0,
        "power_factor": 0.85,
        "active_power_kw": 95.0,
        "vfd_frequency_hz": 50.0,
        "melt_rate_kg_h": 250.0,
        "temperature_c": 220.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "CANONICAL_BASELINE",
    }


def evaluate_scada_signature(
    torque_nm: float,
    power_factor: float,
    active_power_kw: float,
    vfd_frequency_hz: float,
    melt_rate_kg_h: float,
    reported_volume_tons: float,
    category: str = "cat_i_rigid",
    energy_total_kwh: float | None = None,
) -> dict[str, Any]:
    """Evaluate the SCADA electrical signature for fraud detection.

    Delegates to Nimble when available; falls back to the
    Jev IsolationForest + physics-rules ensemble (with formal Delta_mass calculation).
    """
    try:
        import asyncio
        import concurrent.futures
        from services.nimble_service import get_nimble_service
        from services.jev_auditor import _to_py
        nimble = get_nimble_service()
        try:
            running_loop = asyncio.get_running_loop()
        except RuntimeError:
            running_loop = None

        if running_loop and running_loop.is_running():
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                res = pool.submit(
                    lambda: asyncio.run(nimble.evaluate_scada_signature(
                        torque_nm=torque_nm,
                        power_factor=power_factor,
                        active_power_kw=active_power_kw,
                        vfd_frequency_hz=vfd_frequency_hz,
                        melt_rate_kg_h=melt_rate_kg_h,
                        reported_volume_tons=reported_volume_tons,
                    ))
                ).result(timeout=5.0)
        else:
            res = asyncio.run(nimble.evaluate_scada_signature(
                torque_nm=torque_nm,
                power_factor=power_factor,
                active_power_kw=active_power_kw,
                vfd_frequency_hz=vfd_frequency_hz,
                melt_rate_kg_h=melt_rate_kg_h,
                reported_volume_tons=reported_volume_tons,
            ))
        return _to_py(res)
    except Exception:
        pass  # Fall through to Jev ensemble

    # Jev ensemble fallback
    from services.jev_auditor import get_jev_auditor, _to_py
    jev = get_jev_auditor()
    res = jev.evaluate_signature(
        torque_nm=torque_nm,
        power_factor=power_factor,
        active_power_kw=active_power_kw,
        vfd_frequency_hz=vfd_frequency_hz,
        melt_rate_kg_h=melt_rate_kg_h,
        reported_volume_tons=reported_volume_tons,
        category=category,
        energy_total_kwh=energy_total_kwh,
    )
    return _to_py(res)


# ---------------------------------------------------------------------------
# ADK Agent Construction
# ---------------------------------------------------------------------------

AUDITOR_INSTRUCTION = """You are the Auditor Agent (System 1 Reflex) for SynthetIQ's Quad-Core Fraud Audit.

Your job:
1. Fetch live SCADA/VFD telemetry with `fetch_scada_telemetry`.
2. Evaluate the electrical signature with `evaluate_scada_signature`  -  this calls the
   Nimble 9B decision model (or Jev IsolationForest ensemble as fallback).
3. Interpret the verdict and confidence score.
4. Output a single JSON audit result.

Physics to look for (genuine extrusion):
  - Torque ≥ 15 Nm (viscous polymer load on extruder shaft)
  - Power factor 0.78  -  0.92 (3-phase induction motor under load)
  - Specific energy 0.15  -  1.2 kWh/kg of melt
  - VFD frequency stable around 50 Hz

Red flags (resistive-heater spoofing):
  - Torque < 8 Nm with high power draw (simple heating elements, no motor)
  - Power factor > 0.96 (near-unity = no inductive motor load)
  - Melt rate near zero despite high power consumption

Mandatory JSON output keys:
  recycler_id, plant_id, reported_volume_tons, physical_melt_verified,
  confidence_score, is_spoofed, verdict, flags, verified_tons, detection_mode
"""


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def run_auditor_agent(
    recycler_id: str,
    plant_id: str,
    reported_volume_tons: float,
    torque_nm: float = 45.0,
    power_factor: float = 0.85,
    active_power_kw: float = 95.0,
    vfd_frequency_hz: float = 50.0,
    melt_rate_kg_h: float = 250.0,
    category: str = "cat_i_rigid",
    threshold: float = 2.0,
    session_id: str | None = None,
    org_id: str = "",
) -> dict[str, Any]:
    """Run the Auditor Agent for a recycling plant.

    Args:
        recycler_id: Recycler identifier
        plant_id: Plant identifier
        reported_volume_tons: Volume the recycler claims to have processed
        torque_nm: Motor shaft torque
        power_factor: Electrical power factor
        active_power_kw: Active power consumption
        vfd_frequency_hz: VFD drive frequency
        melt_rate_kg_h: Reported melt rate
        category: Polymer category
        threshold: Delta-mass fraud threshold (%)
        session_id: Optional ADK session ID

    Returns:
        Audit verdict dict
    """
    agent = create_llm_agent(
        name="auditor_agent",
        instruction=AUDITOR_INSTRUCTION,
        tools=[fetch_scada_telemetry, evaluate_scada_signature],
        description="SCADA telemetry fraud detection via Nimble System 1 / Jev ensemble",
        output_key="audit_result",
    )

    logger.info(
        f"Running auditor_agent for {recycler_id}/{plant_id}  -  {reported_volume_tons}t, "
        f"torque={torque_nm}Nm, pf={power_factor}, kw={active_power_kw}, category={category}"
    )

    prompt = scrub(
        f"Audit recycler '{recycler_id}', plant '{plant_id}', "
        f"reported volume: {reported_volume_tons} tons, category: '{category}'. "
        f"Telemetry: torque={torque_nm} Nm, power_factor={power_factor}, active_power={active_power_kw} kW, "
        f"vfd_frequency={vfd_frequency_hz} Hz, melt_rate={melt_rate_kg_h} kg/h. "
        "Evaluate the SCADA electrical signature and thermodynamic Delta_mass equation, and return a single JSON object.",
        org_id,
    )

    try:
        result = await run_agent(
            agent=agent,
            user_message=prompt,
            session_id=session_id,
            user_id=recycler_id,
        )

        text = result.get("response", "")
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        data = json.loads(text.strip())
        if isinstance(data, dict) and "verdict" in data:
            return data
    except Exception as exc:
        logger.warning(f"Auditor agent LLM execution failed ({exc}); evaluating physics deterministically")

    # High-reliability fallback: deterministic evaluation
    fallback = evaluate_scada_signature(
        torque_nm=torque_nm,
        power_factor=power_factor,
        active_power_kw=active_power_kw,
        vfd_frequency_hz=vfd_frequency_hz,
        melt_rate_kg_h=melt_rate_kg_h,
        reported_volume_tons=reported_volume_tons,
        category=category,
    )
    fallback.setdefault("threshold", threshold)
    return fallback
