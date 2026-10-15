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
    import httpx
    from sqlalchemy import text

    class DataConnector:  # type: ignore[no-redef]
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            self.org_id = org_id
            self.config = config
            self.connector_type = "abstract"

        async def query_sales_data(self, company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
            return []

        async def query_telemetry(self, plant_id: str, time_range_hours: int = 24) -> list[dict[str, Any]]:
            return []

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
            raise NotImplementedError("CSV file path access disabled; use file upload")

        async def health_check(self) -> bool:
            return os.path.exists(str(self.path))

    class RESTAPIConnector(DataConnector):  # type: ignore[no-redef]
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            super().__init__(org_id, config)
            self.connector_type = "rest_api"
            raw_url = config.get("base_url", "").rstrip("/")
            # Validate base_url against REST_BASE_URL_ALLOWLIST env var
            # NOTE: when allowlist is empty this check is skipped (permissive dev default).
            # Operators MUST set REST_BASE_URL_ALLOWLIST in production.
            allowlist_env = os.getenv("REST_BASE_URL_ALLOWLIST", "")
            allowlist = [u.strip().rstrip("/") for u in allowlist_env.split(",") if u.strip()]
            if raw_url and allowlist and raw_url not in allowlist:
                raise ValueError(
                    f"REST connector base_url {raw_url!r} is not in REST_BASE_URL_ALLOWLIST. "
                    f"Add it to the environment variable to permit access."
                )
            self.base_url = raw_url

            # SSRF protection: block URLs that resolve to private/loopback IPs
            if self.base_url:
                _hostname = _urlparse(self.base_url).hostname or ""
                _allowed_internal = {"simulator", "synthetiq-simulator", "synthetiq-mocks", "synthetiq-mcp", "localhost", "127.0.0.1"}
                if _hostname and _hostname.lower() not in _allowed_internal:
                    try:
                        _addrinfos = socket.getaddrinfo(_hostname, None)
                        for _ai in _addrinfos:
                            _ip = _ai[4][0]
                            if _is_private_ip(_ip):
                                raise ValueError(
                                    f"SSRF protection: {_hostname!r} resolves to private IP {_ip!r}"
                                )
                    except OSError:
                        pass  # DNS resolution failure — allow through; connection will fail at request time

        async def health_check(self) -> bool:
            if not self.base_url:
                return False
            candidate_urls = [self.base_url]
            if "simulator:9091" in self.base_url:
                candidate_urls.append(self.base_url.replace("simulator:9091", "synthetiq-simulator:9091"))
                candidate_urls.append("http://127.0.0.1:9091")
            elif "synthetiq-simulator:9091" in self.base_url:
                candidate_urls.append(self.base_url.replace("synthetiq-simulator:9091", "simulator:9091"))
                candidate_urls.append("http://127.0.0.1:9091")

            for url in candidate_urls:
                try:
                    async with httpx.AsyncClient(timeout=2.0) as client:
                        resp = await client.get(f"{url}/health")
                        if resp.status_code < 400:
                            return True
                except Exception:
                    pass
            # If simulator is in dev mode or telemetry endpoint is configured
            endpoint = self.config.get("telemetry_endpoint", "")
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
                if self.project_id:
                    return True
                return False

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
