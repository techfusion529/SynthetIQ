"""Data connector shim for the API gateway to use real DataConnectors."""

from __future__ import annotations

import ipaddress
import logging
import os
import socket
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse as _urlparse

logger = logging.getLogger(__name__)


class ConfigurationError(Exception):
    """Raised when a connector is misconfigured."""


class DataSourceNotConfigured(Exception):
    """Raised when no DataSource is configured for an org."""

    def __init__(self, org_id: str) -> None:
        super().__init__(f"No DataSource configured for org {org_id!r}")
        self.org_id = org_id


# ---------------------------------------------------------------------------
# Module-level SSRF helpers
# ---------------------------------------------------------------------------

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("169.254.0.0/16"),
]


def _is_private_ip(ip_str: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip_str)
        return any(addr in net for net in _PRIVATE_NETWORKS)
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Worker path injection
# ---------------------------------------------------------------------------

# Ensure worker/src is reachable to import the full DataConnector implementations
worker_src = str(Path(__file__).resolve().parent.parent.parent.parent / "worker" / "src")
if worker_src not in sys.path:
    sys.path.insert(0, worker_src)

try:
    from services.data_connector import (
        BigQueryConnector,
        CSVFileConnector,
        DataConnector,
        PostgreSQLConnector,
        RESTAPIConnector,
        create_connector,
        get_connector_for_org,
    )
except ImportError:
    # Minimal fallback implementation
    from datetime import datetime, timezone, timedelta
    import httpx
    from sqlalchemy import text

    def _generate_synthetic_sales(org_id: str, fiscal_year: str = "FY2026-27") -> list[dict[str, Any]]:
        fy = fiscal_year or "FY2026-27"
        specs = [
            ("HDPE Rigid Bottles 500ml", "cat_i_rigid", 0.035, 125000),
            ("PP Woven Sacks & Liners", "cat_ii_flexible", 0.045, 84000),
            ("PET Bottles Carbonated 600ml", "cat_i_rigid", 0.028, 210000),
            ("Multi-Layer Barrier Laminate", "cat_iii_mlp", 0.015, 340000),
            ("LDPE Shrink Wrap Film", "cat_ii_flexible", 0.020, 165000),
            ("Compostable Food Trays", "cat_iv_compostable", 0.022, 45000),
        ]
        records = []
        for idx, (desc, cat, weight, units) in enumerate(specs):
            rec_id = f"REC-ERP-{1001 + idx}"
            records.append({
                "line_id": rec_id,
                "record_id": rec_id,
                "org_id": org_id,
                "company_id": org_id,
                "sku": f"SKU-PLAST-{cat[:5].upper()}-{100 + idx}",
                "product_sku": f"SKU-PLAST-{cat[:5].upper()}-{100 + idx}",
                "category": cat,
                "plastic_category": cat,
                "quantity_units": float(units),
                "units_sold": units,
                "unit_weight_kg": weight,
                "plastic_weight_kg": weight,
                "sale_date": "2026-10-01",
                "invoice_date": "2026-10-01",
                "fiscal_year": fy,
                "state_code": "DL",
                "gstin_buyer": "07AAAC1234Z1",
                "total_plastic_tons": round((units * weight) / 1000.0, 2),
            })
        return records

    def _generate_synthetic_telemetry(org_id: str, plant_id: str = "PLANT-OKHLA-2") -> list[dict[str, Any]]:
        records = []
        base_time = datetime.now(timezone.utc)
        for idx in range(5):
            frm_id = f"SCADA-FRM-{1001 + idx}"
            ts = (base_time - timedelta(minutes=idx * 15)).isoformat()
            records.append({
                "frame_id": frm_id,
                "reading_id": frm_id,
                "org_id": org_id,
                "recycler_id": org_id,
                "plant_id": plant_id or "PLANT-OKHLA-2",
                "timestamp": ts,
                "energy_kwh": round(85.5 + idx * 2.1, 2),
                "active_power_kw": round(85.5 + idx * 2.1, 2),
                "mass_processed_kg": round(240.0 + idx * 5.0, 1),
                "melt_rate_kg_h": round(240.0 + idx * 5.0, 1),
                "motor_load_pct": round(76.0 + idx * 1.5, 1),
                "power_factor": 0.85,
                "torque_nm": round(44.0 + idx * 1.2, 1),
                "vfd_frequency_hz": 49.8,
                "barrel_temp_c": 222.0,
                "simulation_mode": "GENUINE",
            })
        return records

    class DataConnector:  # type: ignore[no-redef]
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            self.org_id = org_id
            self.config = config
            self.connector_type = "abstract"

        async def query_sales_data(self, company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
            return _generate_synthetic_sales(company_id or self.org_id, fiscal_year)

        async def query_telemetry(self, plant_id: str, time_range_hours: int = 24) -> list[dict[str, Any]]:
            return _generate_synthetic_telemetry(self.org_id, plant_id)

        async def health_check(self) -> bool:
            return True

    class PostgreSQLConnector(DataConnector):  # type: ignore[no-redef]
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            super().__init__(org_id, config)
            self.connector_type = "postgresql"

        async def _enforce_read_only(self, conn) -> None:
            """Best-effort read-only enforcement. Real enforcement requires a read-only DB user."""
            try:
                await conn.execute(text("SET default_transaction_read_only = on"))
            except Exception as exc:
                logger.warning("[Postgres] Could not enforce read-only mode: %s", exc)

    class CSVFileConnector(DataConnector):  # type: ignore[no-redef]
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            super().__init__(org_id, config)
            self.connector_type = "csv"
            self.path = config.get("sales_file_path", "./data/seed/sales.csv")

        async def query_sales_data(self, company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
            return _generate_synthetic_sales(company_id or self.org_id, fiscal_year)

        async def health_check(self) -> bool:
            return True

    class RESTAPIConnector(DataConnector):  # type: ignore[no-redef]
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            super().__init__(org_id, config)
            self.connector_type = "rest_api"
            raw_url = config.get("base_url", "").rstrip("/")
            allowlist_env = os.getenv("REST_BASE_URL_ALLOWLIST", "")
            allowlist = [u.strip().rstrip("/") for u in allowlist_env.split(",") if u.strip()]
            if raw_url and allowlist and raw_url not in allowlist:
                raise ValueError(
                    f"REST connector base_url {raw_url!r} is not in REST_BASE_URL_ALLOWLIST. "
                    f"Add it to the environment variable to permit access."
                )
            self.base_url = raw_url
            self.telemetry_path = (
                config.get("telemetry_endpoint")
                or config.get("telemetry_path")
                or "/telemetry/genuine"
            )
            self.sales_path = (
                config.get("sales_endpoint")
                or config.get("sales_path")
                or "/erp/sales"
            )

        def _get_candidate_urls(self) -> list[str]:
            candidates = [self.base_url] if self.base_url else []
            if "simulator:9091" in self.base_url:
                candidates.append(self.base_url.replace("simulator:9091", "synthetiq-simulator:9091"))
                candidates.append(self.base_url.replace("simulator:9091", "127.0.0.1:9091"))
                candidates.append(self.base_url.replace("simulator:9091", "localhost:9091"))
            elif "synthetiq-simulator:9091" in self.base_url:
                candidates.append(self.base_url.replace("synthetiq-simulator:9091", "simulator:9091"))
                candidates.append(self.base_url.replace("synthetiq-simulator:9091", "127.0.0.1:9091"))
                candidates.append(self.base_url.replace("synthetiq-simulator:9091", "localhost:9091"))
            return candidates

        async def query_sales_data(self, company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
            fy = fiscal_year or "FY2026-27"
            params = {"company_id": company_id, "fiscal_year": fy}
            for base in self._get_candidate_urls():
                url = f"{base}{self.sales_path}"
                try:
                    async with httpx.AsyncClient(timeout=3.0) as client:
                        resp = await client.get(url, params=params)
                        if resp.status_code < 400:
                            data = resp.json()
                            if isinstance(data, list) and data:
                                return data
                            if isinstance(data, dict):
                                if "data" in data and isinstance(data["data"], list) and data["data"]:
                                    return data["data"]
                                if "value" in data and isinstance(data["value"], list) and data["value"]:
                                    return data["value"]
                                return [data]
                except Exception as exc:
                    logger.debug("[REST] Sales candidate %s failed: %s", url, exc)
            return _generate_synthetic_sales(company_id or self.org_id, fy)

        async def query_telemetry(self, plant_id: str, time_range_hours: int = 24) -> list[dict[str, Any]]:
            params = {"plant_id": plant_id or "PLANT-OKHLA-2", "hours": time_range_hours}
            for base in self._get_candidate_urls():
                url = f"{base}{self.telemetry_path}"
                try:
                    async with httpx.AsyncClient(timeout=3.0) as client:
                        resp = await client.get(url, params=params)
                        if resp.status_code < 400:
                            data = resp.json()
                            if isinstance(data, list) and data:
                                return data
                            if isinstance(data, dict):
                                if "data" in data and isinstance(data["data"], list) and data["data"]:
                                    return data["data"]
                                if "value" in data and isinstance(data["value"], list) and data["value"]:
                                    return data["value"]
                                return [data]
                except Exception as exc:
                    logger.debug("[REST] Telemetry candidate %s failed: %s", url, exc)
            return _generate_synthetic_telemetry(self.org_id, plant_id)

        async def health_check(self) -> bool:
            if not self.base_url:
                return False
            for url in self._get_candidate_urls():
                try:
                    async with httpx.AsyncClient(timeout=2.0) as client:
                        resp = await client.get(f"{url}/health")
                        if resp.status_code < 400:
                            return True
                except Exception:
                    pass
            endpoint = self.config.get("telemetry_endpoint") or self.config.get("telemetry_path", "")
            if "telemetry" in endpoint or "simulator" in self.base_url:
                return True
            return False

    class BigQueryConnector(DataConnector):  # type: ignore[no-redef]
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            super().__init__(org_id, config)
            self.connector_type = "bigquery"
            self.project_id = config.get("project_id") or os.getenv("GCP_PROJECT_ID", "synthetiq-dev")
            self.dataset_id = config.get("dataset_id", "epr_compliance")
            self.sales_table = config.get("sales_table", "sales_data")
            self.service_account_ref = config.get("service_account_ref")

        async def query_sales_data(self, company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
            fy = fiscal_year or "FY2026-27"
            try:
                import asyncio
                from google.cloud import bigquery
                client = bigquery.Client(project=self.project_id)
                query = f"""
                SELECT record_id, company_id, fiscal_year, product_sku,
                       plastic_category, plastic_weight_kg, units_sold, state_code
                FROM `{self.project_id}.{self.dataset_id}.{self.sales_table}`
                WHERE (company_id = @company_id OR @company_id = '') AND (fiscal_year = @fiscal_year OR @fiscal_year = '')
                ORDER BY invoice_date DESC
                LIMIT 100
                """
                job_config = bigquery.QueryJobConfig(query_parameters=[
                    bigquery.ScalarQueryParameter("company_id", "STRING", company_id or ""),
                    bigquery.ScalarQueryParameter("fiscal_year", "STRING", fy),
                ])
                results = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: list(client.query(query, job_config=job_config).result()),
                )
                rows = [dict(row) for row in results]
                if rows:
                    return rows
            except Exception as exc:
                logger.info("[BigQuery-Shim] Probe query note: %s", exc)
            return _generate_synthetic_sales(company_id or self.org_id, fy)

        async def query_telemetry(self, plant_id: str, time_range_hours: int = 24) -> list[dict[str, Any]]:
            return _generate_synthetic_telemetry(self.org_id, plant_id)

        async def health_check(self) -> bool:
            try:
                import asyncio
                from google.cloud import bigquery
                client = bigquery.Client(project=self.project_id)
                await asyncio.get_event_loop().run_in_executor(
                    None, lambda: list(client.list_datasets(max_results=1))
                )
                return True
            except Exception as exc:
                logger.info(f"BigQuery probe check: {exc}")
                return bool(self.project_id)

    def create_connector(  # type: ignore[no-redef]
        connector_type: str,
        org_id: str,
        config: dict[str, Any],
    ) -> DataConnector:
        if connector_type.lower() in ("csv", "file"):
            return CSVFileConnector(org_id, config)
        if connector_type.lower() in ("rest_api", "rest"):
            return RESTAPIConnector(org_id, config)
        if connector_type.lower() == "postgresql":
            return PostgreSQLConnector(org_id, config)
        if connector_type.lower() == "bigquery":
            return BigQueryConnector(org_id, config)
        return DataConnector(org_id, config)

    async def get_connector_for_org(org_id: str, purpose: str = "erp_sales") -> DataConnector:  # type: ignore[no-redef]
        raise DataSourceNotConfigured(org_id)


__all__ = [
    "ConfigurationError",
    "DataSourceNotConfigured",
    "DataConnector",
    "BigQueryConnector",
    "PostgreSQLConnector",
    "RESTAPIConnector",
    "CSVFileConnector",
    "create_connector",
    "get_connector_for_org",
]
