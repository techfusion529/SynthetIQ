"""TypeSafe Jev System 1 Reflex  -  SCADA/VFD fraud detection with ML models.

Detection hierarchy (highest to lowest priority):
1. NIMBLE_PRIMARY: Nimble 9B via Ollama /v1/systemone  (<100 ms, typed output)
2. ML_MODEL:       Trained IsolationForest scikit-learn model
3. HYBRID_ENSEMBLE: ML + physics rules combined (default fallback)
4. REFLEX_PHYSICS_ONLY: Pure rule-based detection

When Nimble is available the `evaluate_signature()` method delegates to it.
On any Nimble failure the call falls through to the configured ML/physics mode.

Defeats IoT spoofing where fraudulent recyclers connect resistive space heaters
to mimic power consumption without running high-torque viscous extruder motors.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Literal

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

try:
    from services.crypto_chain import get_telemetry_hash_chain
except ImportError:
    from src.services.crypto_chain import get_telemetry_hash_chain

logger = logging.getLogger(__name__)

# Specific Energy Consumption (kWh/kg) statutory constants for polymer categories
SEC_MATERIAL_CONSTANTS: dict[str, float] = {
    "cat_i_rigid": 0.45,        # PET / HDPE rigid containers
    "cat_ii_flexible": 0.38,    # LDPE / LLDPE films and bags
    "cat_iii_mlp": 0.52,        # Multi-layer plastic laminates
    "cat_iv_compostable": 0.35, # Certified compostable biopolymers
}
DEFAULT_MOTOR_EFFICIENCY = 0.92  # eta_motor (IE3 industrial 3-phase induction motor)


class JevSystem1Auditor:
    """Production ML-powered SCADA fraud detection system."""

    def __init__(
        self,
        mode: Literal["NIMBLE_PRIMARY", "ML_MODEL", "HYBRID_ENSEMBLE", "REFLEX_PHYSICS_ONLY"] = "NIMBLE_PRIMARY",
        model_path: str | None = None,
        torque_threshold_nm: float = 8.0,
        power_factor_min: float = 0.78,
        power_factor_max: float = 0.96,
        confidence_threshold: float = 0.85,
    ) -> None:
        """Initialize Jev auditor with specified detection mode.

        Args:
            mode: Detection mode  -  NIMBLE_PRIMARY delegates to Nimble with Jev as fallback
            model_path: Path to trained ML model (.pkl file)
            torque_threshold_nm: Minimum torque for genuine extrusion
            power_factor_min: Minimum PF for induction motors
            power_factor_max: Maximum PF for induction motors (above = resistive)
            confidence_threshold: Minimum confidence to approve
        """
        self.mode = mode
        self.torque_threshold_nm = torque_threshold_nm
        self.power_factor_min = power_factor_min
        self.power_factor_max = power_factor_max
        self.confidence_threshold = confidence_threshold
        self.model = None

        # Load ML model for ML_MODEL / HYBRID_ENSEMBLE / NIMBLE_PRIMARY fallback
        if mode in ["NIMBLE_PRIMARY", "ML_MODEL", "HYBRID_ENSEMBLE"]:
            if model_path and Path(model_path).exists():
                try:
                    self.model = joblib.load(model_path)
                    logger.info(f"Loaded ML model from {model_path}")
                except Exception as e:
                    logger.warning(f"Failed to load ML model: {e}. Will use physics-only fallback.")
                    if mode != "NIMBLE_PRIMARY":
                        self.mode = "REFLEX_PHYSICS_ONLY"
            else:
                logger.warning(
                    f"ML model not found at {model_path!r}. Creating default IsolationForest."
                )
                self._create_default_model()

        logger.info(f"Initialized JevSystem1Auditor in {self.mode} mode")

    def _create_default_model(self) -> None:
        """Create a default Isolation Forest model with pre-configured parameters."""
        # This is a simple anomaly detector; in production, train on real SCADA data
        self.model = IsolationForest(
            contamination=0.1,  # Expect ~10% fraud attempts
            random_state=42,
            n_estimators=100,
        )
        # Pre-fit with synthetic genuine and spoofed patterns
        genuine_samples = np.array([
            [45.0, 0.85, 95.0, 50.0, 250.0],  # High torque, low PF, high power
            [38.0, 0.82, 88.0, 50.0, 220.0],
            [52.0, 0.88, 102.0, 50.0, 280.0],
            [41.0, 0.79, 91.0, 49.5, 240.0],
        ])
        spoofed_samples = np.array([
            [2.0, 0.99, 85.0, 50.0, 10.0],  # Low torque, high PF (resistive heater)
            [1.5, 0.98, 78.0, 50.0, 5.0],
            [3.0, 0.97, 92.0, 50.0, 15.0],
        ])
        training_data = np.vstack([genuine_samples, spoofed_samples])
        self.model.fit(training_data)
        logger.info("Created default IsolationForest model with synthetic training data")

    def _extract_features(
        self,
        torque_nm: float,
        power_factor: float,
        active_power_kw: float,
        vfd_frequency_hz: float,
        melt_rate_kg_h: float,
    ) -> np.ndarray:
        """Extract feature vector for ML model.

        Args:
            torque_nm: Motor shaft torque
            power_factor: Electrical power factor
            active_power_kw: Active power consumption
            vfd_frequency_hz: VFD frequency
            melt_rate_kg_h: Reported melt rate

        Returns:
            Feature array for model input
        """
        return np.array([[
            torque_nm,
            power_factor,
            active_power_kw,
            vfd_frequency_hz,
            melt_rate_kg_h,
        ]])

    def _physics_based_evaluation(
        self,
        torque_nm: float,
        power_factor: float,
        active_power_kw: float,
        melt_rate_kg_h: float,
    ) -> tuple[bool, float, list[str]]:
        """Rule-based physics evaluation.

        Returns:
            Tuple of (is_spoofed, confidence, flags)
        """
        flags: list[str] = []
        is_spoofed = False
        confidence = 1.0

        # Check 1: Resistive load spoofing (high PF + low torque)
        if active_power_kw > 10.0 and power_factor > self.power_factor_max and torque_nm < self.torque_threshold_nm:
            is_spoofed = True
            confidence = 0.15
            flags.append("SPOOF_DETECTED: High resistive load with negligible extruder torque (fake heaters)")

        # Check 2: No mechanical load despite power consumption
        if torque_nm < 5.0 and active_power_kw > 5.0:
            is_spoofed = True
            confidence = min(confidence, 0.20)
            flags.append("ANOMALY: Motor running without polymer viscosity resistance")

        # Check 3: Genuine induction motor signature
        if self.power_factor_min <= power_factor <= self.power_factor_max and torque_nm >= 15.0:
            confidence = max(confidence, 0.96)
        elif power_factor > self.power_factor_max:
            confidence = min(confidence, 0.40)
            flags.append("SUSPICIOUS: Near-unity PF indicates absence of inductive motor load")

        # Check 4: Thermodynamic energy balance
        if melt_rate_kg_h > 0 and active_power_kw > 0:
            specific_energy = active_power_kw / melt_rate_kg_h
            if specific_energy < 0.15 or specific_energy > 1.2:
                flags.append(f"ENERGY_MISMATCH: {specific_energy:.2f} kWh/kg outside physical limits (0.15-1.2)")
                confidence = min(confidence, 0.60)

        return is_spoofed, confidence, flags

    def _ml_based_evaluation(
        self,
        torque_nm: float,
        power_factor: float,
        active_power_kw: float,
        vfd_frequency_hz: float,
        melt_rate_kg_h: float,
    ) -> tuple[bool, float, list[str]]:
        """ML model-based evaluation.

        Returns:
            Tuple of (is_spoofed, confidence, flags)
        """
        if self.model is None:
            logger.warning("ML model not available, falling back to physics-only")
            return self._physics_based_evaluation(
                torque_nm, power_factor, active_power_kw, melt_rate_kg_h
            )

        features = self._extract_features(
            torque_nm, power_factor, active_power_kw, vfd_frequency_hz, melt_rate_kg_h
        )

        try:
            # Predict: -1 = anomaly (fraud), 1 = normal
            prediction = self.model.predict(features)[0]
            # Get anomaly score (more negative = more anomalous)
            score = self.model.score_samples(features)[0]

            # Convert score to confidence (invert and normalize)
            # Typical scores range from -0.5 to 0.5
            confidence = min(1.0, max(0.0, (score + 0.5) / 1.0))

            is_spoofed = prediction == -1
            flags = []

            if is_spoofed:
                flags.append(f"ML_ANOMALY_DETECTED: Anomaly score={score:.3f}")
                confidence = 1.0 - confidence  # Invert for fraud cases

            return is_spoofed, confidence, flags

        except Exception as e:
            logger.error(f"ML evaluation failed: {e}")
            # Fallback to physics
            return self._physics_based_evaluation(
                torque_nm, power_factor, active_power_kw, melt_rate_kg_h
            )

    def evaluate_signature(
        self,
        torque_nm: float,
        power_factor: float,
        active_power_kw: float,
        vfd_frequency_hz: float,
        melt_rate_kg_h: float,
        reported_volume_tons: float,
        category: str = "cat_i_rigid",
        energy_total_kwh: float | None = None,
    ) -> dict[str, Any]:
        """Evaluate SCADA signature for fraud detection with formal physical fraud equation.

        Detection hierarchy:
          NIMBLE_PRIMARY  - ' try Nimble; on failure fall back to HYBRID_ENSEMBLE
          ML_MODEL        - ' IsolationForest only
          HYBRID_ENSEMBLE  - ' ML + physics rules (min confidence)
          REFLEX_PHYSICS_ONLY  - ' physics rules only

        Deterministic Physics Equation (AC 1.2 & Priority 2):
          Delta_mass = |M_claimed - (E_total * eta_motor / SEC_material)| / M_claimed
          If Delta_mass > 0.02 (>2%), sets fraud_risk_score = 0.95 and halts for HITL review.

        Args:
            torque_nm: Motor shaft torque (Newton-metres)
            power_factor: Electrical power factor (0 - 1)
            active_power_kw: Active power consumption (kW)
            vfd_frequency_hz: VFD frequency (Hz)
            melt_rate_kg_h: Reported polymer melt rate (kg/h)
            reported_volume_tons: Claimed recycled volume (metric tons)
            category: Polymer category (cat_i_rigid, cat_ii_flexible, etc.)
            energy_total_kwh: Optional total electrical energy (kWh)

        Returns:
            Audit verdict dict with delta_mass, fraud_risk_score, and cryptographic hash chain
        """
        logger.info(f"Evaluating SCADA signature  -  mode={self.mode}, category={category}")

        #  -  -  -  -  NIMBLE_PRIMARY: try Nimble, fall back to HYBRID_ENSEMBLE  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        if self.mode == "NIMBLE_PRIMARY":
            try:
                import asyncio
                from services.nimble_service import get_nimble_service
                nimble = get_nimble_service()
                loop = asyncio.get_event_loop()
                result = loop.run_until_complete(
                    nimble.evaluate_scada_signature(
                        torque_nm=torque_nm,
                        power_factor=power_factor,
                        active_power_kw=active_power_kw,
                        vfd_frequency_hz=vfd_frequency_hz,
                        melt_rate_kg_h=melt_rate_kg_h,
                        reported_volume_tons=reported_volume_tons,
                    )
                )
                logger.info(
                    f"Nimble verdict: {result.get('verdict')}, "
                    f"confidence={result.get('confidence_score')}"
                )
                # Ensure deterministic physics check is attached
                if "delta_mass" not in result:
                    sec = SEC_MATERIAL_CONSTANTS.get(category.lower(), 0.45)
                    eta = DEFAULT_MOTOR_EFFICIENCY
                    m_claimed_kg = max(0.0, reported_volume_tons * 1000.0)
                    e_tot = energy_total_kwh or (active_power_kw * (m_claimed_kg / max(1.0, melt_rate_kg_h)))
                    m_theo_kg = (e_tot * eta) / sec if sec > 0 else m_claimed_kg
                    d_mass = abs(m_claimed_kg - m_theo_kg) / max(1.0, m_claimed_kg)
                    result["delta_mass"] = round(float(d_mass), 4)
                    result["theoretical_volume_tons"] = round(m_theo_kg / 1000.0, 3)
                    result["sec_kwh_per_kg"] = sec
                    result["energy_total_kwh"] = round(e_tot, 2)
                    result["requires_hitl"] = result["delta_mass"] > 0.02 or result.get("is_spoofed", False)
                return result
            except Exception as exc:
                logger.warning(f"Nimble unavailable ({exc}); falling back to HYBRID_ENSEMBLE")
                # Fall through to hybrid below

        #  -  -  -  -  ML_MODEL  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        if self.mode == "ML_MODEL":
            is_spoofed, confidence, flags = self._ml_based_evaluation(
                torque_nm, power_factor, active_power_kw, vfd_frequency_hz, melt_rate_kg_h
            )

        #  -  -  -  -  HYBRID_ENSEMBLE (also used as Nimble fallback)  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        elif self.mode in ("HYBRID_ENSEMBLE", "NIMBLE_PRIMARY"):
            ml_spoofed, ml_conf, ml_flags = self._ml_based_evaluation(
                torque_nm, power_factor, active_power_kw, vfd_frequency_hz, melt_rate_kg_h
            )
            phys_spoofed, phys_conf, phys_flags = self._physics_based_evaluation(
                torque_nm, power_factor, active_power_kw, melt_rate_kg_h
            )
            is_spoofed = ml_spoofed or phys_spoofed
            confidence = min(ml_conf, phys_conf)
            flags = ml_flags + phys_flags

        else:  # REFLEX_PHYSICS_ONLY
            is_spoofed, confidence, flags = self._physics_based_evaluation(
                torque_nm, power_factor, active_power_kw, melt_rate_kg_h
            )

        #  -  -  -  -  Deterministic Physics: Formal mass-energy correlation (Feature 1 & 3)  -  -  -  - 
        sec_constant = SEC_MATERIAL_CONSTANTS.get(category.lower(), 0.45)
        eta_motor = DEFAULT_MOTOR_EFFICIENCY
        m_claimed_kg = max(0.0, reported_volume_tons * 1000.0)

        # Compute total active electrical energy
        if energy_total_kwh is not None and energy_total_kwh > 0:
            e_total = energy_total_kwh
        elif melt_rate_kg_h > 0 and active_power_kw > 0 and m_claimed_kg > 0:
            operating_hours = m_claimed_kg / melt_rate_kg_h
            e_total = active_power_kw * operating_hours
        else:
            e_total = active_power_kw * (m_claimed_kg / 250.0 if m_claimed_kg > 0 else 1.0)

        # Theoretical mass M_theoretical = (E_total * eta_motor) / SEC_material
        if sec_constant > 0:
            m_theoretical_kg = (e_total * eta_motor) / sec_constant
        else:
            m_theoretical_kg = m_claimed_kg

        m_theoretical_tons = round(m_theoretical_kg / 1000.0, 3)

        # Discrepancy Delta_mass = |M_claimed - M_theoretical| / M_claimed
        if m_claimed_kg > 0:
            delta_mass = abs(m_claimed_kg - m_theoretical_kg) / m_claimed_kg
        else:
            delta_mass = 0.0

        delta_mass = round(float(delta_mass), 4)
        fraud_risk_score = 0.05
        requires_hitl = False

        # Priority 2 rule: If Delta_mass > 0.02 (>2%), automatically set fraud_risk_score = 0.95 and halt for HITL review
        if delta_mass > 0.02:
            fraud_risk_score = 0.95
            requires_hitl = True
            flags.append(
                f"PHYSICAL_MASS_ENERGY_MISMATCH: Delta_mass={delta_mass:.2%} exceeds 2.0% statutory threshold "
                f"(Claimed={reported_volume_tons:.2f}t vs Thermodynamic={m_theoretical_tons:.2f}t, SEC={sec_constant} kWh/kg)"
            )
            confidence = min(confidence, 0.45)

        if is_spoofed:
            fraud_risk_score = max(fraud_risk_score, 0.99)
            requires_hitl = True

        verified = (not is_spoofed) and (not requires_hitl) and (confidence >= self.confidence_threshold)
        calculated_tons = reported_volume_tons if verified else (m_theoretical_tons if not is_spoofed else 0.0)

        if verified:
            verdict = "APPROVED"
        elif is_spoofed:
            verdict = "REJECTED_FRAUD"
        else:
            verdict = "ESCALATED_FOR_MANUAL_REVIEW"

        #  -  -  -  -  Feature 1 AC 1.3: Cryptographic Nanosecond Hash Chaining  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
        chain = get_telemetry_hash_chain()
        chain_payload = {
            "claimed_tons": reported_volume_tons,
            "torque_nm": torque_nm,
            "power_factor": power_factor,
            "active_power_kw": active_power_kw,
            "melt_rate_kg_h": melt_rate_kg_h,
            "category": category,
            "delta_mass": delta_mass,
            "fraud_risk_score": fraud_risk_score,
            "verdict": verdict,
        }
        chained_frame = chain.append_frame(chain_payload)

        result = {
            "physical_melt_verified": verified,
            "confidence_score": round(confidence, 3),
            "is_spoofed": is_spoofed,
            "flags": flags,
            "verified_tons": calculated_tons,
            "verdict": verdict,
            "detection_mode": self.mode,
            "delta_mass": delta_mass,
            "fraud_risk_score": fraud_risk_score,
            "requires_hitl": requires_hitl,
            "theoretical_volume_tons": m_theoretical_tons,
            "sec_kwh_per_kg": sec_constant,
            "motor_efficiency": eta_motor,
            "energy_total_kwh": round(e_total, 2),
            "cryptographic_hash": chained_frame.frame_hash,
            "previous_hash": chained_frame.previous_hash,
            "nanosecond_timestamp": chained_frame.nanosecond_timestamp,
            "chain_index": chained_frame.index,
            "thresholds": {
                "torque_min_nm": self.torque_threshold_nm,
                "pf_range": [self.power_factor_min, self.power_factor_max],
                "confidence_threshold": self.confidence_threshold,
                "delta_mass_max_pct": 2.0,
            },
        }

        logger.info(
            f"Audit result: {verdict}, confidence={confidence:.3f}, "
            f"delta_mass={delta_mass:.2%}, fraud_risk={fraud_risk_score:.2f}, hash={chained_frame.frame_hash[:12]}..."
        )
        return result


# Global auditor instance (initialized by worker)
jev_auditor: JevSystem1Auditor | None = None


def initialize_jev_auditor(
    mode: Literal["NIMBLE_PRIMARY", "ML_MODEL", "HYBRID_ENSEMBLE", "REFLEX_PHYSICS_ONLY"] = "NIMBLE_PRIMARY",
    model_path: str | None = None,
    torque_threshold_nm: float = 8.0,
    power_factor_min: float = 0.78,
    power_factor_max: float = 0.96,
    confidence_threshold: float = 0.85,
) -> JevSystem1Auditor:
    """Initialize the global Jev auditor.

    Args:
        mode: Detection mode
        model_path: Path to trained model
        torque_threshold_nm: Torque threshold
        power_factor_min: Min power factor
        power_factor_max: Max power factor
        confidence_threshold: Min confidence for approval

    Returns:
        Initialized auditor
    """
    global jev_auditor
    jev_auditor = JevSystem1Auditor(
        mode=mode,
        model_path=model_path,
        torque_threshold_nm=torque_threshold_nm,
        power_factor_min=power_factor_min,
        power_factor_max=power_factor_max,
        confidence_threshold=confidence_threshold,
    )
    return jev_auditor


def get_jev_auditor() -> JevSystem1Auditor:
    """Get the global Jev auditor instance.

    Raises:
        RuntimeError: If auditor not initialized
    """
    if jev_auditor is None:
        raise RuntimeError("JevSystem1Auditor not initialized. Call initialize_jev_auditor first.")
    return jev_auditor
