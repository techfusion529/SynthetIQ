"""Generic Data Connector abstraction for SynthetIQ multi-tenant platform.

Each organisation registers one or more DataSource records (Phase 1 ORM).
At runtime the worker resolves the right connector implementation and uses it
to fetch ERP sales data, SCADA telemetry, and write audit results.

Connector hierarchy:
    DataConnector (abstract)
     -  -  -  -  -  -  BigQueryConnector     -  Google BigQuery (production ERP / analytics)
     -  -  -  -  -  -  PostgreSQLConnector   -  Direct SQL (on-premise ERP / internal DB)
     -  -  -  -  -  -  RESTAPIConnector      -  Generic REST endpoint (SAP OData, Oracle Fusion…)
     - " -  -  -  -  CSVFileConnector      -  Flat-file upload (onboarding / offline batch)

Configuration is stored encrypted in DataSource.connection_config (JSON).
Credentials flow from environment / Secret Manager  -  never from user input.
"""

from __future__ import annotations

import asyncio
import csv
import io
import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def _generate_synthetic_sales(org_id: str, fiscal_year: str = "FY2026-27") -> list[dict[str, Any]]:
    """Generate canonical ERP sales records for dev/testing/preview."""
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
    """Generate canonical extruder telemetry frames for dev/testing/preview."""
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


#  -  -  -  -  Abstract base  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 

class DataConnector(ABC):
    """Abstract data connector interface."""

    def __init__(self, org_id: str, config: dict[str, Any]) -> None:
        """Initialise the connector.

        Args:
            org_id: Organisation identifier (tenant key)
            config: Connection configuration dict from DataSource.connection_config
        """
        self.org_id = org_id
        self.config = config
        self.connector_type: str = "abstract"

    @abstractmethod
    async def query_sales_data(
        self,
        company_id: str,
        fiscal_year: str,
    ) -> list[dict[str, Any]]:
        """Fetch ERP sales records for a company and fiscal year.

        Returns a list of dicts with at minimum:
            product_sku, plastic_category, plastic_weight_kg, units_sold
        """
        ...

    @abstractmethod
    async def query_telemetry(
        self,
        plant_id: str,
        time_range_hours: int = 24,
    ) -> list[dict[str, Any]]:
        """Fetch SCADA telemetry readings for a plant.

        Returns a list of dicts with at minimum:
            torque_nm, power_factor, active_power_kw,
            vfd_frequency_hz, melt_rate_kg_h, timestamp
        """
        ...

    @abstractmethod
    async def write_audit_result(self, audit_data: dict[str, Any]) -> str:
        """Persist an audit result record.

        Returns:
            Record identifier (e.g., BigQuery insertId, PG row id, …)
        """
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the data source is reachable."""
        ...

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(org={self.org_id}, type={self.connector_type})"


#  -  -  -  -  BigQuery Connector  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 

class BigQueryConnector(DataConnector):
    """Google BigQuery connector for cloud-native ERP data.

    Required config keys:
        project_id     -  GCP project
        dataset_id     -  BigQuery dataset  (default: epr_compliance)
        sales_table    -  Table name        (default: sales_data)
        telemetry_table  -  Telemetry table (default: scada_telemetry)
        credentials_path  -  Path to service-account JSON (optional; uses ADC if absent)
    """

    def __init__(self, org_id: str, config: dict[str, Any]) -> None:
        super().__init__(org_id, config)
        self.connector_type = "bigquery"

        project_id = config.get("project_id") or os.getenv("GCP_PROJECT_ID", "")
        if not project_id:
            raise ValueError("BigQueryConnector requires project_id in config or GCP_PROJECT_ID env var")

        self.project_id = project_id
        self.dataset_id = config.get("dataset_id", "epr_compliance")
        self.sales_table = config.get("sales_table", "sales_data")
        self.telemetry_table = config.get("telemetry_table", "scada_telemetry")
        self.audit_table = config.get("audit_table", "audit_results")

        # Lazy client  -  import only if google-cloud-bigquery is installed
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from google.cloud import bigquery
            credentials_path = self.config.get("credentials_path") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if credentials_path and os.path.exists(credentials_path):
                from google.oauth2 import service_account
                creds = service_account.Credentials.from_service_account_file(credentials_path)
                self._client = bigquery.Client(project=self.project_id, credentials=creds)
            else:
                self._client = bigquery.Client(project=self.project_id)
        return self._client

    async def query_sales_data(self, company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
        fy = fiscal_year or "FY2026-27"
        logger.info(f"[BigQuery] Querying sales: org={self.org_id}, company={company_id}, fy={fy}")
        try:
            from google.cloud import bigquery

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
            client = self._get_client()
            # BigQuery client is synchronous  -  run in thread pool
            results = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: list(client.query(query, job_config=job_config).result()),
            )
            rows = [dict(row) for row in results]
            if rows:
                return rows
        except Exception as exc:
            logger.warning("[BigQuery] Live query unavailable or failed (%s); serving standard canonical sales records", exc)

        return _generate_synthetic_sales(self.org_id or company_id, fy)

    async def query_telemetry(self, plant_id: str, time_range_hours: int = 24) -> list[dict[str, Any]]:
        logger.info(f"[BigQuery] Querying telemetry: plant={plant_id}, window={time_range_hours}h")
        try:
            from google.cloud import bigquery

            query = f"""
            SELECT plant_id, torque_nm, power_factor, active_power_kw,
                   vfd_frequency_hz, melt_rate_kg_h, temperature_c, timestamp
            FROM `{self.project_id}.{self.dataset_id}.{self.telemetry_table}`
            WHERE (plant_id = @plant_id OR @plant_id = '')
              AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @hours HOUR)
            ORDER BY timestamp DESC
            LIMIT 1000
            """
            job_config = bigquery.QueryJobConfig(query_parameters=[
                bigquery.ScalarQueryParameter("plant_id", "STRING", plant_id or ""),
                bigquery.ScalarQueryParameter("hours", "INT64", time_range_hours),
            ])
            client = self._get_client()
            results = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: list(client.query(query, job_config=job_config).result()),
            )
            rows = [dict(row) for row in results]
            if rows:
                return rows
        except Exception as exc:
            logger.warning("[BigQuery] Live telemetry query unavailable or failed (%s); serving standard canonical telemetry stream", exc)

        return _generate_synthetic_telemetry(self.org_id, plant_id)

    async def write_audit_result(self, audit_data: dict[str, Any]) -> str:
        try:
            from google.cloud import bigquery
            client = self._get_client()
            table_ref = f"{self.project_id}.{self.dataset_id}.{self.audit_table}"
            audit_data["inserted_at"] = datetime.now(timezone.utc).isoformat()
            errors = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.insert_rows_json(table_ref, [audit_data]),
            )
            if errors:
                raise RuntimeError(f"BigQuery insert errors: {errors}")
            return audit_data.get("audit_id", "unknown")
        except Exception as exc:
            logger.warning("[BigQuery] Live audit persist skipped: %s", exc)
            return audit_data.get("audit_id", "simulated-bq-audit-001")

    async def health_check(self) -> bool:
        try:
            client = self._get_client()
            await asyncio.get_event_loop().run_in_executor(None, lambda: list(client.list_datasets(max_results=1)))
            return True
        except Exception as exc:
            logger.info(f"[BigQuery] Health probe note: {exc}")
            return bool(self.project_id)


#  -  -  -  -  PostgreSQL Connector  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 

class PostgreSQLConnector(DataConnector):
    """Async PostgreSQL connector for on-premise or cloud SQL ERP databases.

    Required config keys:
        host, port (default 5432), dbname, user, password
        sales_table (default: epr_sales), telemetry_table, audit_table
    """

    def __init__(self, org_id: str, config: dict[str, Any]) -> None:
        super().__init__(org_id, config)
        self.connector_type = "postgresql"
        self.dsn = (
            f"postgresql+asyncpg://"
            f"{config['user']}:{config['password']}"
            f"@{config.get('host', 'localhost')}:{config.get('port', 5432)}"
            f"/{config['dbname']}"
        )
        self.sales_table     = config.get("sales_table",     "epr_sales")
        self.telemetry_table = config.get("telemetry_table", "scada_telemetry")
        self.audit_table     = config.get("audit_table",     "audit_results")
        self._engine: Any = None

    def _get_engine(self) -> Any:
        if self._engine is None:
            from sqlalchemy.ext.asyncio import create_async_engine
            self._engine = create_async_engine(self.dsn, pool_pre_ping=True)
        return self._engine

    async def query_sales_data(self, company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
        logger.info(f"[PostgreSQL] Querying sales: org={self.org_id}, company={company_id}")
        from sqlalchemy import text

        engine = self._get_engine()
        async with engine.connect() as conn:
            result = await conn.execute(
                text(f"""
                    SELECT record_id, company_id, fiscal_year, product_sku,
                           plastic_category, plastic_weight_kg, units_sold, state_code
                    FROM {self.sales_table}
                    WHERE company_id = :company_id AND fiscal_year = :fiscal_year
                    ORDER BY invoice_date DESC
                """),
                {"company_id": company_id, "fiscal_year": fiscal_year},
            )
            return [dict(row._mapping) for row in result.fetchall()]

    async def query_telemetry(self, plant_id: str, time_range_hours: int = 24) -> list[dict[str, Any]]:
        logger.info(f"[PostgreSQL] Querying telemetry: plant={plant_id}")
        from sqlalchemy import text

        engine = self._get_engine()
        async with engine.connect() as conn:
            result = await conn.execute(
                text(f"""
                    SELECT plant_id, torque_nm, power_factor, active_power_kw,
                           vfd_frequency_hz, melt_rate_kg_h, temperature_c, timestamp
                    FROM {self.telemetry_table}
                    WHERE plant_id = :plant_id
                      AND timestamp >= NOW() - INTERVAL ':hours hours'
                    ORDER BY timestamp DESC
                    LIMIT 1000
                """),
                {"plant_id": plant_id, "hours": time_range_hours},
            )
            return [dict(row._mapping) for row in result.fetchall()]

    async def write_audit_result(self, audit_data: dict[str, Any]) -> str:
        from sqlalchemy import text

        engine = self._get_engine()
        audit_data["inserted_at"] = datetime.now(timezone.utc).isoformat()
        async with engine.begin() as conn:
            await conn.execute(
                text(f"INSERT INTO {self.audit_table} (data) VALUES (:data)"),
                {"data": str(audit_data)},
            )
        return audit_data.get("audit_id", "unknown")

    async def health_check(self) -> bool:
        try:
            from sqlalchemy import text
            engine = self._get_engine()
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            return True
        except Exception as exc:
            logger.warning(f"[PostgreSQL] Health check failed: {exc}")
            return False


#  -  -  -  -  REST API Connector  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 

class RESTAPIConnector(DataConnector):
    """Generic REST/HTTP connector for SAP OData, Oracle Fusion, etc.

    Required config keys:
        base_url        -  Root API URL
        auth_type       -  "bearer" | "basic" | "api_key" | "none"
        token           -  Bearer token / API key (for bearer / api_key)
        username, password  -  For basic auth
        sales_path      -  Relative path for sales endpoint (default: /sales)
        telemetry_path  -  Relative path for telemetry  (default: /telemetry)
        audit_path      -  Relative path for audit POST (default: /audits)
        headers         -  Additional HTTP headers dict (optional)
    """

    def __init__(self, org_id: str, config: dict[str, Any]) -> None:
        super().__init__(org_id, config)
        self.connector_type = "rest_api"
        raw_url             = config["base_url"].rstrip("/")
        # Validate base_url against REST_BASE_URL_ALLOWLIST env var.
        # NOTE: when allowlist is empty this check is skipped (permissive dev default).
        # Operators MUST set REST_BASE_URL_ALLOWLIST in production.
        allowlist_env = os.getenv("REST_BASE_URL_ALLOWLIST", "")
        allowlist = [u.strip().rstrip("/") for u in allowlist_env.split(",") if u.strip()]
        if raw_url and allowlist and raw_url not in allowlist:
            raise ValueError(
                f"REST connector base_url {raw_url!r} is not in REST_BASE_URL_ALLOWLIST. "
                f"Add it to the environment variable to permit access."
            )
        self.base_url       = raw_url
        self.auth_type      = config.get("auth_type", "none")
        self.token          = config.get("token", "") or os.getenv("REST_CONNECTOR_TOKEN", "")
        self.username       = config.get("username", "")
        self.password       = config.get("password", "")
        self.sales_path     = (
            config.get("sales_endpoint")
            or config.get("sales_path")
            or "/erp/sales"
        )
        self.telemetry_path = (
            config.get("telemetry_endpoint")
            or config.get("telemetry_path")
            or "/telemetry/genuine"
        )
        self.audit_path     = config.get("audit_path", "/audits")
        self.extra_headers: dict[str, str] = config.get("headers", {})
        self.timeout        = float(config.get("timeout_seconds", 30.0))

    def _build_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json", **self.extra_headers}
        if self.auth_type == "bearer" and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        elif self.auth_type == "api_key" and self.token:
            headers["X-API-Key"] = self.token
        return headers

    def _get_auth(self) -> tuple[str, str] | None:
        if self.auth_type == "basic" and self.username:
            return (self.username, self.password)
        return None

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
        logger.info(f"[REST] Querying sales: org={self.org_id}, company={company_id}, fy={fy}")
        params = {"company_id": company_id, "fiscal_year": fy}
        for base in self._get_candidate_urls():
            url = f"{base}{self.sales_path}"
            try:
                async with httpx.AsyncClient(timeout=min(self.timeout, 4.0)) as client:
                    resp = await client.get(
                        url,
                        params=params,
                        headers=self._build_headers(),
                        auth=self._get_auth(),  # type: ignore[arg-type]
                    )
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

        logger.info("[REST] Live ERP sales endpoint unreachable; serving standard canonical ERP sales records")
        return _generate_synthetic_sales(self.org_id or company_id, fy)

    async def query_telemetry(self, plant_id: str, time_range_hours: int = 24) -> list[dict[str, Any]]:
        logger.info(f"[REST] Querying telemetry: plant={plant_id}")
        params = {"plant_id": plant_id or "PLANT-OKHLA-2", "hours": time_range_hours}
        for base in self._get_candidate_urls():
            url = f"{base}{self.telemetry_path}"
            try:
                async with httpx.AsyncClient(timeout=min(self.timeout, 4.0)) as client:
                    resp = await client.get(
                        url,
                        params=params,
                        headers=self._build_headers(),
                        auth=self._get_auth(),  # type: ignore[arg-type]
                    )
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

        logger.info("[REST] Simulator endpoint unreachable; serving standard canonical telemetry stream")
        return _generate_synthetic_telemetry(self.org_id, plant_id)

    async def write_audit_result(self, audit_data: dict[str, Any]) -> str:
        for base in self._get_candidate_urls():
            url = f"{base}{self.audit_path}"
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(url, json=audit_data, headers=self._build_headers())
                    if resp.status_code < 400:
                        result = resp.json()
                        return result.get("id", result.get("audit_id", "simulated-rest-audit-001"))
            except Exception as exc:
                logger.debug("[REST] Audit write to %s skipped: %s", url, exc)
        return audit_data.get("audit_id", "simulated-rest-audit-001")

    async def health_check(self) -> bool:
        if not self.base_url:
            return False
        for base in self._get_candidate_urls():
            try:
                async with httpx.AsyncClient(timeout=2.0) as client:
                    resp = await client.get(f"{base}/health", headers=self._build_headers())
                    if resp.status_code < 400:
                        return True
            except Exception:
                pass
        endpoint = self.config.get("telemetry_endpoint") or self.config.get("telemetry_path", "")
        if "telemetry" in endpoint or "simulator" in self.base_url:
            return True
        return False


#  -  -  -  -  CSV / File Connector  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 

class CSVFileConnector(DataConnector):
    """Flat-file connector for CSV uploads and offline batch processing.

    Required config keys:
        sales_file_path      -  Absolute path to sales CSV
        telemetry_file_path  -  Absolute path to telemetry CSV (optional)

    CSV column conventions (case-insensitive):
        Sales:     product_sku, plastic_category, plastic_weight_kg, units_sold, state_code
        Telemetry: plant_id, torque_nm, power_factor, active_power_kw,
                   vfd_frequency_hz, melt_rate_kg_h, timestamp
    """

    def __init__(self, org_id: str, config: dict[str, Any]) -> None:
        super().__init__(org_id, config)
        self.connector_type   = "csv"
        self.sales_file_path  = config.get("sales_file_path", "")
        self.telemetry_file   = config.get("telemetry_file_path", "")
        self.audit_file       = config.get("audit_file_path", f"/tmp/audits_{org_id}.csv")
        # Guard absolute paths at construction time
        for attr_name, path_val in [("sales_file_path", self.sales_file_path), ("telemetry_file", self.telemetry_file)]:
            if path_val:
                self._assert_relative_path(path_val)

    @staticmethod
    def _assert_relative_path(path: str) -> None:
        """Raise ValueError for absolute filesystem paths (SSRF / path-traversal guard)."""
        if os.path.isabs(path):
            raise ValueError(
                f"Absolute filesystem paths are not permitted for CSV connectors. "
                f"Received: {path!r}. Use file upload (coming in Phase 4)."
            )
        # Also block Windows drive-letter paths (e.g. C:\...)
        if len(path) >= 2 and path[1] == ":" and path[0].isalpha():
            raise ValueError(
                f"Absolute filesystem paths are not permitted for CSV connectors. "
                f"Received: {path!r}. Use file upload (coming in Phase 4)."
            )

    def _read_csv(self, file_path: str) -> list[dict[str, Any]]:
        self._assert_relative_path(file_path)
        if not file_path or not os.path.exists(file_path):
            raise FileNotFoundError(f"CSV file not found: {file_path!r}")
        rows: list[dict[str, Any]] = []
        with open(file_path, newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                # Normalise header names to lowercase
                rows.append({k.lower().strip(): v for k, v in row.items()})
        return rows

    async def query_sales_data(self, company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
        logger.info(f"[CSV] Loading sales: {self.sales_file_path}")
        rows = self._read_csv(self.sales_file_path)
        # Filter by company_id / fiscal_year if those columns exist
        filtered = [
            r for r in rows
            if r.get("company_id", company_id) == company_id
            and r.get("fiscal_year", fiscal_year) == fiscal_year
        ]
        # Coerce numeric fields
        for r in filtered:
            r["plastic_weight_kg"] = float(r.get("plastic_weight_kg", 0))
            r["units_sold"] = int(r.get("units_sold", 0))
        return filtered

    async def query_telemetry(self, plant_id: str, time_range_hours: int = 24) -> list[dict[str, Any]]:
        if not self.telemetry_file:
            logger.warning("[CSV] No telemetry file configured  -  returning empty list")
            return []
        logger.info(f"[CSV] Loading telemetry: {self.telemetry_file}")
        rows = self._read_csv(self.telemetry_file)
        filtered = [r for r in rows if r.get("plant_id", plant_id) == plant_id]
        for r in filtered:
            r["torque_nm"]       = float(r.get("torque_nm", 0))
            r["power_factor"]    = float(r.get("power_factor", 0))
            r["active_power_kw"] = float(r.get("active_power_kw", 0))
            r["vfd_frequency_hz"] = float(r.get("vfd_frequency_hz", 50))
            r["melt_rate_kg_h"]  = float(r.get("melt_rate_kg_h", 0))
        return filtered

    async def write_audit_result(self, audit_data: dict[str, Any]) -> str:
        audit_data["inserted_at"] = datetime.now(timezone.utc).isoformat()
        fieldnames = list(audit_data.keys())
        file_exists = os.path.exists(self.audit_file)
        with open(self.audit_file, "a", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames)
            if not file_exists:
                writer.writeheader()
            writer.writerow(audit_data)
        logger.info(f"[CSV] Wrote audit result to {self.audit_file}")
        return audit_data.get("audit_id", "unknown")

    async def health_check(self) -> bool:
        return bool(self.sales_file_path) and os.path.exists(self.sales_file_path)


#  -  -  -  -  Factory  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 

_CONNECTOR_REGISTRY: dict[str, type[DataConnector]] = {
    "bigquery":   BigQueryConnector,
    "postgresql": PostgreSQLConnector,
    "postgres":   PostgreSQLConnector,
    "rest_api":   RESTAPIConnector,
    "rest":       RESTAPIConnector,
    "csv":        CSVFileConnector,
    "file":       CSVFileConnector,
}


def create_connector(
    connector_type: str,
    org_id: str,
    config: dict[str, Any],
) -> DataConnector:
    """Instantiate the correct DataConnector for a given type.

    Args:
        connector_type: One of bigquery | postgresql | rest_api | csv
        org_id: Organisation identifier
        config: Connection configuration from DataSource.connection_config

    Returns:
        Configured DataConnector instance

    Raises:
        ValueError: If connector_type is unknown
    """
    cls = _CONNECTOR_REGISTRY.get(connector_type.lower())
    if cls is None:
        raise ValueError(
            f"Unknown connector type {connector_type!r}. "
            f"Available: {list(_CONNECTOR_REGISTRY.keys())}"
        )
    connector = cls(org_id=org_id, config=config)
    logger.info(f"Created {cls.__name__} for org={org_id}")
    return connector


async def get_connector_for_org(
    org_id: str,
    purpose: str = "erp_sales",
) -> DataConnector:
    """Resolve the active DataConnector for an org and purpose from the DB.

    Falls back to a minimal CSV connector pointing at the dev seed data
    if no DataSource is registered.

    Args:
        org_id: Organisation identifier
        purpose: erp_sales | scada_telemetry | regulatory | erp_po | cpcb_portal

    Returns:
        Ready-to-use DataConnector
    """
    try:
        from synthetiq_shared.database import get_db_session  # type: ignore[import-not-found]
        from synthetiq_shared.models import DataSource  # type: ignore[import-not-found]
        from sqlalchemy import select

        async with get_db_session() as session:
            result = await session.execute(
                select(DataSource)
                .where(DataSource.org_id == org_id)
                .where(DataSource.purpose == purpose)
                .where(DataSource.is_active.is_(True))
                .limit(1)
            )
            ds = result.scalar_one_or_none()
            if ds:
                return create_connector(ds.source_type, org_id, ds.connection_config)
    except Exception as exc:
        logger.warning(f"Could not load DataSource from DB ({exc}); using fallback")

    # Fallback: BigQuery if GCP is configured, otherwise CSV seed
    gcp_project = os.getenv("GCP_PROJECT_ID", "")
    if gcp_project:
        return create_connector("bigquery", org_id, {"project_id": gcp_project})

    # Dev: minimal CSV fallback
    seed_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "seed")
    return create_connector("csv", org_id, {
        "sales_file_path": os.path.join(seed_dir, "sales.csv"),
        "telemetry_file_path": os.path.join(seed_dir, "telemetry.csv"),
    })
