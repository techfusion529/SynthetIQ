"""Kaggle-grounded SCADA/VFD industrial telemetry stream generator."""

from __future__ import annotations

import random
import time
from typing import Any, Literal


class SCADATelemetryGenerator:
    """Simulates industrial plastics extrusion lines with physics-grounded electrical signals."""

    def generate_reading(
        self,
        recycler_id: str = "RECYC-DELHI-01",
        plant_id: str = "PLANT-OKHLA-2",
        mode: Literal["GENUINE", "RESISTIVE_SPOOF", "IDLE_UNLOADED"] = "GENUINE",
    ) -> dict[str, Any]:
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        reading_id = f"SCADA-{recycler_id}-{int(time.time() * 1000)}"

        if mode == "GENUINE":
            # Genuine induction motor extruding viscous high-density polymer
            frequency = round(random.uniform(48.5, 50.2), 2)
            current = round(random.uniform(130.0, 160.0), 1)
            power_factor = round(random.uniform(0.82, 0.89), 3)  # Classic 3-phase induction motor
            active_power = round(random.uniform(85.0, 110.0), 1)  # kW
            torque = round(random.uniform(35.0, 75.0), 1)  # Viscous shear resistance (Nm)
            melt_rate = round(random.uniform(220.0, 280.0), 1)  # kg/h
            temp_barrel = round(random.uniform(210.0, 235.0), 1)
            melt_pressure = round(random.uniform(120.0, 180.0), 1)

        elif mode == "RESISTIVE_SPOOF":
            # Fraudulent recycler: resistive space heaters plugged into factory circuit
            # Draws electrical energy with zero mechanical work and unity power factor
            frequency = 0.0  # Extruder motor not even turning
            current = round(random.uniform(115.0, 125.0), 1)
            power_factor = round(random.uniform(0.985, 0.999), 3)  # Pure resistive unity PF
            active_power = round(random.uniform(75.0, 85.0), 1)
            torque = round(random.uniform(0.5, 2.0), 1)  # Near-zero mechanical torque!
            melt_rate = 0.0  # Zero physical plastic melting
            temp_barrel = round(random.uniform(30.0, 45.0), 1)
            melt_pressure = 0.0

        else:  # IDLE_UNLOADED
            frequency = 50.0
            current = round(random.uniform(25.0, 35.0), 1)
            power_factor = round(random.uniform(0.40, 0.55), 3)
            active_power = round(random.uniform(12.0, 18.0), 1)
            torque = round(random.uniform(6.0, 9.0), 1)
            melt_rate = 0.0
            temp_barrel = 150.0
            melt_pressure = 5.0

        return {
            "reading_id": reading_id,
            "recycler_id": recycler_id,
            "plant_id": plant_id,
            "timestamp": timestamp,
            "simulation_mode": mode,
            "vfd_frequency_hz": frequency,
            "motor_current_amps": current,
            "active_power_kw": active_power,
            "power_factor": power_factor,
            "torque_nm": torque,
            "melt_rate_kg_h": melt_rate,
            "barrel_temp_c": temp_barrel,
            "melt_pressure_bar": melt_pressure,
        }


scada_generator = SCADATelemetryGenerator()
