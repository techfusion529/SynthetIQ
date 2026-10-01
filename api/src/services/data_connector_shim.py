"""Thin shim so the API can use DataConnectors without importing the full worker.

Tries to import from the worker package first; falls back to a local
re-export that only depends on packages available in the API container.
"""

from __future__ import annotations

from typing import Any

try:
    # When API and worker share PYTHONPATH (single-process dev / Docker)
    from services.data_connector import (  # type: ignore[import-not-found]
        DataConnector,
        BigQueryConnector,
        PostgreSQLConnector,
        RESTAPIConnector,
        CSVFileConnector,
        create_connector,
        get_connector_for_org,
    )
except ImportError:
    # Minimal re-implementation of create_connector for the API container
    import logging
    import os
    import httpx

    logger = logging.getLogger(__name__)

    class DataConnector:  # type: ignore[no-redef]
        """Minimal base for API-side health-checks."""
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            self.org_id = org_id
            self.config = config
        async def health_check(self) -> bool:
            return False

    class RESTAPIConnector(DataConnector):  # type: ignore[no-redef]
        def __init__(self, org_id: str, config: dict[str, Any]) -> None:
            super().__init__(org_id, config)
            self.base_url = config.get("base_url", "").rstrip("/")

        async def health_check(self) -> bool:
            if not self.base_url:
                return False
            try:
                async with httpx.AsyncClient(timeout=5.0) as c:
                    resp = await c.get(f"{self.base_url}/health")
                    return resp.status_code < 400
            except Exception:
                return False

    class CSVFileConnector(DataConnector):  # type: ignore[no-redef]
        async def health_check(self) -> bool:
            path = self.config.get("sales_file_path", "")
            return bool(path) and os.path.exists(path)

    def create_connector(  # type: ignore[no-redef]
        connector_type: str,
        org_id: str,
        config: dict[str, Any],
    ) -> DataConnector:
        mapping = {
            "rest_api": RESTAPIConnector,
            "rest": RESTAPIConnector,
            "csv": CSVFileConnector,
            "file": CSVFileConnector,
        }
        cls = mapping.get(connector_type.lower(), DataConnector)
        return cls(org_id=org_id, config=config)

    async def get_connector_for_org(org_id: str, purpose: str = "erp_sales") -> DataConnector:  # type: ignore[no-redef]
        return DataConnector(org_id=org_id, config={})

__all__ = [
    "DataConnector",
    "create_connector",
    "get_connector_for_org",
]
