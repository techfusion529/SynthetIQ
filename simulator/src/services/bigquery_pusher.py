"""BigQuery Real-Time Streaming Pusher for SynthetIQ Simulator.

Periodically streams realistic SCADA industrial extruder telemetry and ERP sales records
into Google BigQuery tables:
- `synthetiq-dev.epr_compliance.scada_telemetry`
- `synthetiq-dev.epr_compliance.sales_data`
"""

from __future__ import annotations

import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("synthetiq-simulator.bigquery-pusher")


class BigQueryPusher:
    """Streams simulator events into Google BigQuery."""

    def __init__(
        self,
        project_id: str | None = None,
        dataset_id: str | None = None,
        telemetry_table: str = "scada_telemetry",
        sales_table: str = "sales_data",
        interval_seconds: float = 6.0,
    ) -> None:
        self.project_id = project_id or os.getenv("GCP_PROJECT_ID", "synthetiq-dev")
        self.dataset_id = dataset_id or os.getenv("BIGQUERY_DATASET_ID", "epr_compliance")
        self.telemetry_table = telemetry_table
        self.sales_table = sales_table
        self.interval_seconds = interval_seconds
        self._running = False
        self._thread: threading.Thread | None = None
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from google.cloud import bigquery
            self._client = bigquery.Client(project=self.project_id)
            logger.info(f"BigQuery client initialized for project {self.project_id}")
        return self._client

    def push_telemetry(self, reading: dict[str, Any]) -> bool:
        """Insert a single SCADA telemetry frame into BigQuery."""
        try:
            client = self._get_client()
            table_id = f"{self.project_id}.{self.dataset_id}.{self.telemetry_table}"

            row = {
                "reading_id": reading.get("reading_id", f"SCADA-{int(time.time() * 1000)}"),
                "plant_id": reading.get("plant_id", "PLANT-OKHLA-2"),
                "recycler_id": reading.get("recycler_id", "RECYC-DELHI-01"),
                "torque_nm": float(reading.get("torque_nm", 45.0)),
                "power_factor": float(reading.get("power_factor", 0.85)),
                "active_power_kw": float(reading.get("active_power_kw", 95.0)),
                "vfd_frequency_hz": float(reading.get("vfd_frequency_hz", 50.0)),
                "melt_rate_kg_h": float(reading.get("melt_rate_kg_h", 250.0)),
                "temperature_c": float(reading.get("barrel_temp_c", reading.get("temperature_c", 220.0))),
                "simulation_mode": reading.get("simulation_mode", "GENUINE"),
                "timestamp": reading.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            }

            errors = client.insert_rows_json(table_id, [row])
            if errors:
                logger.warning(f"Failed to stream telemetry row to BigQuery: {errors}")
                return False
            logger.debug(f"Streamed telemetry reading {row['reading_id']} to {table_id}")
            return True
        except Exception as exc:
            logger.warning(f"BigQuery telemetry push error: {exc}")
            return False

    def push_sales_batch(self, sales_records: list[dict[str, Any]]) -> bool:
        """Insert a batch of ERP sales invoices into BigQuery."""
        if not sales_records:
            return True
        try:
            client = self._get_client()
            table_id = f"{self.project_id}.{self.dataset_id}.{self.sales_table}"

            rows = []
            for r in sales_records:
                rows.append({
                    "record_id": r.get("record_id"),
                    "company_id": r.get("company_id"),
                    "fiscal_year": r.get("fiscal_year", "FY2026-27"),
                    "product_sku": r.get("product_sku"),
                    "plastic_category": r.get("plastic_category"),
                    "plastic_weight_kg": float(r.get("plastic_weight_kg", 0.0)),
                    "units_sold": int(r.get("units_sold", 0)),
                    "state_code": r.get("state_code", "DL"),
                    "invoice_date": r.get("invoice_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
                })

            errors = client.insert_rows_json(table_id, rows)
            if errors:
                logger.warning(f"Failed to insert sales batch to BigQuery: {errors}")
                return False
            logger.info(f"Streamed {len(rows)} sales records to {table_id}")
            return True
        except Exception as exc:
            logger.warning(f"BigQuery sales push error: {exc}")
            return False

    def _loop(self) -> None:
        """Background daemon loop pushing periodic readings."""
        from src.generators import erp_generator, scada_generator

        logger.info(f"BigQuery Pusher daemon started (interval: {self.interval_seconds}s)")
        step = 0
        plants = ["PLANT-OKHLA-2", "PLANT-GIDC-3", "PLANT-SEC62-1"]
        recyclers = ["RECYC-DELHI-01", "RECYC-SURAT-02", "RECYC-NOIDA-03"]

        while self._running:
            try:
                # 1. Generate and push real-time SCADA telemetry for each plant
                for plant_id, recycler_id in zip(plants, recyclers):
                    # 90% genuine, 10% resistive spoof on plant 2 every 10 steps to test fraud detection
                    mode = "RESISTIVE_SPOOF" if (step % 12 == 11 and plant_id == "PLANT-OKHLA-2") else "GENUINE"
                    reading = scada_generator.generate_reading(
                        recycler_id=recycler_id,
                        plant_id=plant_id,
                        mode=mode,
                    )
                    self.push_telemetry(reading)

                # 2. Every 20 iterations, append fresh ERP sales batch for registered tenants
                if step % 20 == 0:
                    for comp_id in ["COMP-001", "ORG-DEV-001", "COMP-002"]:
                        batch = erp_generator.generate_sales_batch(company_id=comp_id, count=3)
                        self.push_sales_batch(batch)

                step += 1
            except Exception as loop_err:
                logger.error(f"Error in BigQuery pusher loop: {loop_err}")

            time.sleep(self.interval_seconds)

    def start(self) -> None:
        """Start streaming in background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="BigQueryPusherThread")
        self._thread.start()

    def stop(self) -> None:
        """Stop background worker."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)


# Global singleton instance
bigquery_pusher = BigQueryPusher()
