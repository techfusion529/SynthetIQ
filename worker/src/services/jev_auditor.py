"""TypeSafe Jev System 1 Reflex — SCADA/VFD fraud detection with ML models.

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

logger = logging.getLogger(__name__)


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
            mode: Detection mode — NIMBLE_PRIMARY delegates to Nimble with Jev as fallback
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
    ) -> dict[str, Any]:
        """Evaluate SCADA signature for fraud detection.

        Detection hierarchy:
          NIMBLE_PRIMARY → try Nimble; on failure fall back to HYBRID_ENSEMBLE
          ML_MODEL       → IsolationForest only
          HYBRID_ENSEMBLE → ML + physics rules (min confidence)
          REFLEX_PHYSICS_ONLY → physics rules only

        Args:
            torque_nm: Motor shaft torque (Newton-metres)
            power_factor: Electrical power factor (0–1)
            active_power_kw: Active power consumption (kW)
            vfd_frequency_hz: VFD frequency (Hz)
            melt_rate_kg_h: Reported polymer melt rate (kg/h)
            reported_volume_tons: Claimed recycled volume (metric tons)

        Returns:
            Audit verdict dict
        """
        logger.info(f"Evaluating SCADA signature — mode={self.mode}")

        # ── NIMBLE_PRIMARY: try Nimble, fall back to HYBRID_ENSEMBLE ─────────
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
                return result
            except Exception as exc:
                logger.warning(f"Nimble unavailable ({exc}); falling back to HYBRID_ENSEMBLE")
                # Fall through to hybrid below

        # ── ML_MODEL ──────────────────────────────────────────────────────────
        if self.mode == "ML_MODEL":
            is_spoofed, confidence, flags = self._ml_based_evaluation(
                torque_nm, power_factor, active_power_kw, vfd_frequency_hz, melt_rate_kg_h
            )

        # ── HYBRID_ENSEMBLE (also used as Nimble fallback) ────────────────────
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

        verified = (not is_spoofed) and (confidence >= self.confidence_threshold)
        calculated_tons = reported_volume_tons if verified else 0.0

        if verified:
            verdict = "APPROVED"
        elif is_spoofed:
            verdict = "REJECTED_FRAUD"
        else:
            verdict = "ESCALATED_FOR_MANUAL_REVIEW"

        result = {
            "physical_melt_verified": verified,
            "confidence_score": round(confidence, 3),
            "is_spoofed": is_spoofed,
            "flags": flags,
            "verified_tons": calculated_tons,
            "verdict": verdict,
            "detection_mode": self.mode,
            "thresholds": {
                "torque_min_nm": self.torque_threshold_nm,
                "pf_range": [self.power_factor_min, self.power_factor_max],
                "confidence_threshold": self.confidence_threshold,
            },
        }

        logger.info(f"Audit result: {verdict}, confidence={confidence:.3f}")
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
