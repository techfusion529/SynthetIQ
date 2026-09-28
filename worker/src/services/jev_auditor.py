"""TypeSafe Jev System 1 Reflex — SCADA/VFD torque & electrical signature anti-fraud evaluator.

Defeats IoT spoofing where fraudulent recyclers connect simple resistive space heaters
to mimic power consumption without running high-torque viscous extruder motors.
"""

from __future__ import annotations

import math
from typing import Any


class JevSystem1Auditor:
    """High-speed zero-hallucination primitive evaluator for SCADA physics."""

    def evaluate_signature(
        self,
        torque_nm: float,
        power_factor: float,
        active_power_kw: float,
        vfd_frequency_hz: float,
        melt_rate_kg_h: float,
        reported_volume_tons: float,
    ) -> dict[str, Any]:
        """Mathematically verifies whether physical melting occurred.

        Rules grounded in polymer extrusion physics:
        1. Pure resistive heaters have power factor ~ 1.0 (0.98 - 1.00) and zero mechanical torque.
        2. Real induction motors under viscous polymer load have:
           - Power factor between 0.78 and 0.92
           - Non-zero mechanical torque (typically 20 - 100+ Nm depending on shear rate)
        3. Mechanical energy must correlate with melt rate.
        """
        flags: list[str] = []
        is_spoofed = False
        confidence = 1.0

        # Check 1: Resistive load spoofing check
        # High power + high power factor (>0.97) + low torque (<5 Nm) = fake heating elements
        if active_power_kw > 10.0 and power_factor > 0.96 and torque_nm < 8.0:
            is_spoofed = True
            confidence = 0.15
            flags.append("SPOOF_DETECTED: High resistive load with negligible extruder shaft torque (fake heaters)")

        # Check 2: Viscous torque check
        if torque_nm < 5.0 and active_power_kw > 5.0:
            is_spoofed = True
            confidence = min(confidence, 0.20)
            flags.append("ANOMALY: Extruder motor running without polymer viscosity resistance")

        # Check 3: Power factor sanity check for 3-phase induction motor
        if 0.78 <= power_factor <= 0.92 and torque_nm >= 15.0:
            # Genuine industrial induction motor under mechanical load
            confidence = max(confidence, 0.96)
        elif power_factor > 0.96:
            confidence = min(confidence, 0.40)
            flags.append("SUSPICIOUS: Near-unity power factor indicates absence of inductive motor load")

        # Check 4: Thermodynamic energy balance
        # Approximate polymer melt energy: ~0.3 - 0.5 kWh per kg
        if melt_rate_kg_h > 0 and active_power_kw > 0:
            specific_energy_kwh_per_kg = active_power_kw / melt_rate_kg_h
            if specific_energy_kwh_per_kg < 0.15 or specific_energy_kwh_per_kg > 1.2:
                flags.append(f"ENERGY_MISMATCH: Specific energy {specific_energy_kwh_per_kg:.2f} kWh/kg outside physical limits")
                confidence = min(confidence, 0.60)

        verified = (not is_spoofed) and (confidence >= 0.85)
        calculated_tons = reported_volume_tons if verified else 0.0

        return {
            "physical_melt_verified": verified,
            "confidence_score": round(confidence, 3),
            "is_spoofed": is_spoofed,
            "flags": flags,
            "verified_tons": calculated_tons,
            "verdict": "APPROVED" if verified else ("REJECTED" if is_spoofed else "ESCALATED_FOR_MANUAL_REVIEW"),
        }


jev_auditor = JevSystem1Auditor()
