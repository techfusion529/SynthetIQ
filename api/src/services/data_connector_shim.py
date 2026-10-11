"""Data connector shim for the API gateway to use real DataConnectors."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

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
    import csv
    import httpx

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

    class CSVFileConnector(DataConnector):  # type: ignore[no-redef]
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            super().__init__(org_id, config)
            self.connector_type = "csv"
            self.path = config.get("sales_file_path", "./data/seed/sales.csv")

        async def query_sales_data(self, company_id: str, fiscal_year: str) -> list[dict[str, Any]]:
            path = str(self.path)
            # Block absolute filesystem paths — only relative/upload paths are permitted
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
            if not os.path.exists(path):
                return []
            records = []
            with open(path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append(dict(row))
            return records

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

        async def health_check(self) -> bool:
            if not self.base_url:
                return False
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(f"{self.base_url}/health")
                    return resp.status_code < 400
            except Exception:
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
        return DataConnector(org_id, config)

    async def get_connector_for_org(org_id: str, purpose: str = "erp_sales") -> DataConnector:  # type: ignore[no-redef]
        return CSVFileConnector(org_id, {"sales_file_path": "./data/seed/sales.csv"})


__all__ = [
    "DataConnector",
    "BigQueryConnector",
    "PostgreSQLConnector",
    "RESTAPIConnector",
    "CSVFileConnector",
    "create_connector",
    "get_connector_for_org",
]
