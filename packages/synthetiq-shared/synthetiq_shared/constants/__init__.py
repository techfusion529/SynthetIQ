"""EPR constants — plastic categories, conversion factors, and regulatory boundaries."""

from __future__ import annotations
from enum import Enum


class PlasticCategory(str, Enum):
    """CPCB plastic waste categories for EPR compliance."""
    CAT_I = "cat_i_rigid"
    CAT_II = "cat_ii_flexible"
    CAT_III = "cat_iii_mlp"
    CAT_IV = "cat_iv_compostable"


class RecyclingChemistry(str, Enum):
    """Recycling chemistry routes recognized by CPCB."""
    MECHANICAL = "mechanical"
    CO_PROCESSING = "co_processing"


# --- Statutory Boundaries ---
COMPENSATION_CORRIDOR_MIN_PCT: float = 0.30
COMPENSATION_CORRIDOR_MAX_PCT: float = 1.00
ESCROW_ADVANCE_PCT: float = 0.80
ESCROW_RETENTION_PCT: float = 0.20
DEBT_AMORTIZATION_FRACTION: float = 1 / 3

# --- Conversion Factors (C_f) by category × chemistry ---
DEFAULT_CONVERSION_FACTORS: dict[str, dict[str, float]] = {
    PlasticCategory.CAT_I: {RecyclingChemistry.MECHANICAL: 1.0, RecyclingChemistry.CO_PROCESSING: 0.7},
    PlasticCategory.CAT_II: {RecyclingChemistry.MECHANICAL: 0.8, RecyclingChemistry.CO_PROCESSING: 0.6},
    PlasticCategory.CAT_III: {RecyclingChemistry.MECHANICAL: 0.5, RecyclingChemistry.CO_PROCESSING: 0.9},
    PlasticCategory.CAT_IV: {RecyclingChemistry.MECHANICAL: 1.0, RecyclingChemistry.CO_PROCESSING: 0.8},
}

# --- Specific Heat Capacity (kJ/kg·°C) for thermodynamic verification ---
SPECIFIC_HEAT_CAPACITY: dict[str, float] = {
    PlasticCategory.CAT_I: 1.67,
    PlasticCategory.CAT_II: 1.90,
    PlasticCategory.CAT_III: 1.50,
    PlasticCategory.CAT_IV: 1.80,
}

# --- SCADA Fraud Detection Thresholds ---
TORQUE_GENUINE_MIN_NM: float = 15.0
TORQUE_GENUINE_MAX_NM: float = 120.0
TORQUE_SPOOFED_MAX_NM: float = 5.0
POWER_FACTOR_RESISTIVE_MIN: float = 0.95
POWER_FACTOR_INDUCTIVE_RANGE: tuple[float, float] = (0.78, 0.92)

# --- Temporal ---
TEMPORAL_TASK_QUEUE: str = "synthetiq-main"
TEMPORAL_NAMESPACE: str = "default"
