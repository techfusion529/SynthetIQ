"""Nimble System 1 service — fast typed fraud detection via Ollama SystemOne endpoint.

Nimble is a 9B decision model purpose-built for fast (<100 ms) typed classification.
It returns structured "choice" and "bool" answers without any free-form hallucination.

Endpoint used:  POST http://ollama:11434/v1/systemone
NOT:            POST http://ollama:11434/api/generate   (that's for Gemma/Llama)

When Ollama / Nimble is unavailable, callers should fall back to the
Jev IsolationForest + physics-rules ensemble (see jev_auditor.py).
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

# ── Nimble SCADA fraud-detection prompts ────────────────────────────────────
#
# The "state" field is a rich textual description of the sensor reading.
# The "questions" dict defines strictly typed outputs — Nimble returns a
# probability-weighted choice or boolean for each key.

_FRAUD_QUESTIONS: dict[str, dict[str, Any]] = {
    "fraud_verdict": {
        "type": "choice",
        "instructions": (
            "Based solely on the SCADA electrical signature described, "
            "classify the recycling process."
        ),
        "criteria": {
            "APPROVED": (
                "Genuine induction motor under viscous polymer load: "
                "torque ≥ 15 Nm, power factor 0.78–0.92, "
                "specific energy 0.15–1.2 kWh/kg"
            ),
            "REJECTED_FRAUD": (
                "Resistive space-heater spoofing detected: "
                "near-unity power factor (>0.96), negligible torque (<8 Nm), "
                "zero or near-zero melt rate despite high power draw"
            ),
            "ESCALATED_FOR_MANUAL_REVIEW": (
                "Ambiguous signature — some indicators are inconsistent; "
                "manual inspection of the plant is required"
            ),
        },
    },
    "is_genuine_motor": {
        "type": "bool",
        "instructions": (
            "Does the combination of power factor and torque indicate "
            "a real 3-phase induction motor running under viscous polymer load? "
            "Answer true only when both PF is in 0.78–0.92 AND torque is ≥ 15 Nm."
        ),
    },
    "energy_balance_ok": {
        "type": "bool",
        "instructions": (
            "Is the specific energy consumption (active_power_kw / melt_rate_kg_h) "
            "within the physically plausible range of 0.15 to 1.2 kWh/kg for polymer extrusion?"
        ),
    },
}


class NimbleService:
    """Ollama SystemOne client for Nimble-based SCADA fraud detection."""

    def __init__(
        self,
        ollama_host: str = "http://localhost:11434",
        model: str = "nimble",
        timeout: float = 10.0,
    ) -> None:
        """Initialise the Nimble service.

        Args:
            ollama_host: Ollama server base URL
            model: Model name registered in Ollama (default: nimble)
            timeout: HTTP request timeout in seconds
        """
        self.ollama_host = ollama_host.rstrip("/")
        self.model = model
        self.timeout = timeout
        self._available: bool | None = None  # None = not yet checked
        logger.info(f"NimbleService configured: host={ollama_host}, model={model}")

    # ── Availability probe ────────────────────────────────────────────────────

    async def _check_availability(self) -> bool:
        """Return True if the Ollama server is reachable and Nimble model is loaded."""
        if self._available is not None:
            return self._available
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.ollama_host}/api/tags")
                if resp.status_code != 200:
                    self._available = False
                    return False
                tags = resp.json()
                models = [m.get("name", "") for m in tags.get("models", [])]
                self._available = any(self.model in m for m in models)
                if not self._available:
                    logger.warning(
                        f"Nimble model '{self.model}' not found in Ollama. "
                        f"Available: {models}. Will use Jev fallback."
                    )
        except Exception as exc:
            logger.warning(f"Ollama health check failed: {exc}. Nimble unavailable.")
            self._available = False
        return self._available

    def reset_availability_cache(self) -> None:
        """Force re-check of availability on next call."""
        self._available = None

    # ── Core SystemOne call ───────────────────────────────────────────────────

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=3),
        retry=retry_if_exception_type(httpx.HTTPError),
        reraise=True,
    )
    async def _call_systemone(self, state: str) -> dict[str, Any]:
        """POST to /v1/systemone and return the raw Nimble response.

        Args:
            state: Rich textual state description sent to Nimble

        Returns:
            Parsed JSON response from Nimble

        Raises:
            httpx.HTTPError: On network/HTTP failure (triggers retry)
            ValueError: If response is malformed
        """
        payload = {
            "model": self.model,
            "state": state,
            "questions": _FRAUD_QUESTIONS,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.ollama_host}/v1/systemone",
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    # ── Public evaluation API ─────────────────────────────────────────────────

    async def evaluate_scada_signature(
        self,
        torque_nm: float,
        power_factor: float,
        active_power_kw: float,
        vfd_frequency_hz: float,
        melt_rate_kg_h: float,
        reported_volume_tons: float,
    ) -> dict[str, Any]:
        """Evaluate a SCADA electrical signature for polymer-extrusion fraud.

        This is the primary public method called by the Auditor ADK agent.
        Uses Nimble when available; raises RuntimeError to signal fallback needed.

        Args:
            torque_nm: Motor shaft torque in Newton-metres
            power_factor: Electrical power factor (0.0 – 1.0)
            active_power_kw: Active (real) power in kW
            vfd_frequency_hz: VFD drive output frequency in Hz
            melt_rate_kg_h: Reported polymer melt throughput in kg/h
            reported_volume_tons: Claimed total recycled volume in metric tons

        Returns:
            Audit verdict dict compatible with jev_auditor output schema

        Raises:
            RuntimeError: If Nimble is unavailable (caller should use Jev fallback)
        """
        if not await self._check_availability():
            raise RuntimeError("Nimble not available — use Jev fallback")

        # Build rich state description for Nimble
        specific_energy = (
            round(active_power_kw / melt_rate_kg_h, 3) if melt_rate_kg_h > 0 else 0.0
        )
        state = (
            f"SCADA Reading from polymer recycling extruder:\n"
            f"  Motor shaft torque:    {torque_nm:.1f} Nm\n"
            f"  Power factor (cos φ):  {power_factor:.3f}\n"
            f"  Active power:          {active_power_kw:.1f} kW\n"
            f"  VFD frequency:         {vfd_frequency_hz:.1f} Hz\n"
            f"  Polymer melt rate:     {melt_rate_kg_h:.1f} kg/h\n"
            f"  Specific energy:       {specific_energy:.3f} kWh/kg\n"
            f"  Reported volume:       {reported_volume_tons:.2f} metric tons\n\n"
            f"Physics baseline for genuine polymer extrusion:\n"
            f"  Induction motor torque: 15 – 120 Nm under full viscous load\n"
            f"  Power factor range:     0.78 – 0.92 (inductive, lagging)\n"
            f"  Specific energy range:  0.15 – 1.2 kWh/kg of polymer melt\n\n"
            f"Resistive space-heater signature (spoofing indicator):\n"
            f"  Torque near zero (<8 Nm), power factor near unity (>0.96),\n"
            f"  high power draw but zero or minimal melt output."
        )

        try:
            raw = await self._call_systemone(state)
        except Exception as exc:
            logger.error(f"Nimble SystemOne call failed: {exc}")
            raise RuntimeError(f"Nimble call failed: {exc}") from exc

        return self._parse_response(
            raw=raw,
            torque_nm=torque_nm,
            power_factor=power_factor,
            active_power_kw=active_power_kw,
            melt_rate_kg_h=melt_rate_kg_h,
            reported_volume_tons=reported_volume_tons,
            specific_energy=specific_energy,
        )

    def _parse_response(
        self,
        raw: dict[str, Any],
        torque_nm: float,
        power_factor: float,
        active_power_kw: float,
        melt_rate_kg_h: float,
        reported_volume_tons: float,
        specific_energy: float,
    ) -> dict[str, Any]:
        """Convert Nimble's typed response into the standard audit verdict schema.

        Nimble returns something like:
        {
            "answers": {
                "fraud_verdict": {
                    "value": "APPROVED",
                    "probabilities": {"APPROVED": 0.94, "REJECTED_FRAUD": 0.04, ...}
                },
                "is_genuine_motor": {"value": true, "probability": 0.96},
                "energy_balance_ok": {"value": true, "probability": 0.91}
            }
        }

        Args:
            raw: Raw JSON from Nimble
            *: Telemetry inputs for deriving flags

        Returns:
            Audit verdict dict
        """
        answers = raw.get("answers", {})

        # ── fraud_verdict ────────────────────────────────────────────────────
        verdict_answer = answers.get("fraud_verdict", {})
        verdict = verdict_answer.get("value", "ESCALATED_FOR_MANUAL_REVIEW")
        probs = verdict_answer.get("probabilities", {})
        # Confidence = probability of the chosen verdict
        confidence = float(probs.get(verdict, 0.5))

        # ── boolean checks ────────────────────────────────────────────────────
        is_genuine = answers.get("is_genuine_motor", {}).get("value", False)
        energy_ok = answers.get("energy_balance_ok", {}).get("value", True)

        is_spoofed = verdict == "REJECTED_FRAUD"
        physical_melt_verified = verdict == "APPROVED" and is_genuine

        # Build flags list for auditability
        flags: list[str] = []
        if is_spoofed:
            flags.append(
                f"NIMBLE_FRAUD: verdict=REJECTED_FRAUD, "
                f"confidence={confidence:.2f}, torque={torque_nm:.1f}Nm, PF={power_factor:.3f}"
            )
        if not is_genuine:
            flags.append("NIMBLE: Not consistent with genuine induction motor under load")
        if not energy_ok:
            flags.append(
                f"NIMBLE_ENERGY: Specific energy {specific_energy:.3f} kWh/kg outside 0.15–1.2 range"
            )
        if power_factor > 0.96:
            flags.append(f"PHYSICS: Near-unity PF {power_factor:.3f} — no inductive motor load")
        if torque_nm < 8.0 and active_power_kw > 10.0:
            flags.append(f"PHYSICS: Low torque {torque_nm:.1f} Nm with high power draw")

        verified_tons = reported_volume_tons if physical_melt_verified else 0.0

        return {
            "physical_melt_verified": physical_melt_verified,
            "confidence_score": round(confidence, 3),
            "is_spoofed": is_spoofed,
            "flags": flags,
            "verified_tons": verified_tons,
            "verdict": verdict,
            "detection_mode": "NIMBLE_SYSTEM1",
            "nimble_probabilities": probs,
            "nimble_is_genuine_motor": is_genuine,
            "nimble_energy_balance_ok": energy_ok,
            "thresholds": {
                "torque_min_nm": 8.0,
                "pf_range": [0.78, 0.96],
                "energy_range_kwh_per_kg": [0.15, 1.2],
            },
        }


# ── Global singleton ──────────────────────────────────────────────────────────

_nimble_service: NimbleService | None = None


def initialize_nimble_service(
    ollama_host: str = "http://localhost:11434",
    model: str = "nimble",
    timeout: float = 10.0,
) -> NimbleService:
    """Initialise the global Nimble service.

    Args:
        ollama_host: Ollama base URL
        model: Nimble model name
        timeout: HTTP timeout in seconds

    Returns:
        Initialized NimbleService
    """
    global _nimble_service
    _nimble_service = NimbleService(
        ollama_host=ollama_host,
        model=model,
        timeout=timeout,
    )
    logger.info(f"✓ NimbleService initialized: {ollama_host}/{model}")
    return _nimble_service


def get_nimble_service() -> NimbleService:
    """Return the global NimbleService instance.

    Raises:
        RuntimeError: If not yet initialized
    """
    if _nimble_service is None:
        raise RuntimeError("NimbleService not initialized. Call initialize_nimble_service first.")
    return _nimble_service
