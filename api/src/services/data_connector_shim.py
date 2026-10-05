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
            if not os.path.exists(self.path):
                return []
            records = []
            with open(self.path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append(dict(row))
            return records

        async def health_check(self) -> bool:
            return os.path.exists(self.path)

    class RESTAPIConnector(DataConnector):  # type: ignore[no-redef]
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            super().__init__(org_id, config)
            self.connector_type = "rest_api"
            self.base_url = config.get("base_url", "").rstrip("/")

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
