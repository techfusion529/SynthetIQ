"""Organizations API — multi-tenant organisation and data-source management.

RBAC:
  GET  /organizations/                  → orgs:read      (viewer+)
  POST /organizations/                  → orgs:write     (admin)
  GET  /organizations/{id}              → orgs:read      (viewer+)
  PUT  /organizations/{id}              → orgs:write     (admin)
  GET  /organizations/{id}/data-sources → datasources:read  (compliance_officer+)
  POST /organizations/{id}/data-sources → datasources:write (admin)
  DELETE /organizations/{id}/data-sources/{ds_id} → datasources:delete (admin)
  POST /organizations/{id}/data-sources/{ds_id}/test → datasources:read (compliance_officer+)
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/organizations", tags=["Organizations"])

# ---------------------------------------------------------------------------
# In-memory store — replaced by SQLAlchemy ORM Session in production
# when synthetiq_shared.database is reachable.
# ---------------------------------------------------------------------------

_ORGS: dict[str, dict[str, Any]] = {
    "ORG-DEV-001": {
        "org_id": "ORG-DEV-001",
        "name": "Hindustan Consumer Goods Ltd",
        "industry_sector": "FMCG",
        "gstin": "27AAACH1234F1Z5",
        "country": "IN",
        "annual_plastic_footprint_tons": 18500.0,
        "is_active": True,
        "settings": {},
        "created_at": "2026-01-01T00:00:00Z",
    }
}
_DATA_SOURCES: dict[str, list[dict[str, Any]]] = {
    "ORG-DEV-001": [],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mask_secrets(config: dict[str, Any]) -> dict[str, Any]:
    """Replace credential values with masked placeholders."""
    masked_keys = {"password", "token", "api_key", "secret", "key", "credentials_path"}
    return {
        k: "***" if k.lower() in masked_keys else v
        for k, v in config.items()
    }


# ---------------------------------------------------------------------------
# Organisation CRUD
# ---------------------------------------------------------------------------

@router.get("/")
async def list_organizations(
    user: CurrentUser,
    _: Any = Depends(require_permission("orgs:read")),
) -> list[dict[str, Any]]:
    """List all active organisations. Non-admins see only their own org."""
    if user.get("role") == "admin":
        return [o for o in _ORGS.values() if o.get("is_active")]
    # Restrict to own org
    own = _ORGS.get(user.get("org_id", ""))
    return [own] if own else []


@router.post("/")
async def create_organization(
    payload: dict[str, Any],
    user: CurrentUser,
    _: Any = Depends(require_permission("orgs:write")),
) -> dict[str, Any]:
    """Onboard a new organisation. Requires admin role."""
    org_id = payload.get("org_id") or f"ORG-{uuid.uuid4().hex[:8].upper()}"

    if org_id in _ORGS:
        raise HTTPException(status_code=409, detail=f"Organisation {org_id!r} already exists")

    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    record: dict[str, Any] = {
        "org_id": org_id,
        "name": name,
        "industry_sector": payload.get("industry_sector", "FMCG"),
        "gstin": payload.get("gstin"),
        "country": payload.get("country", "IN"),
        "annual_plastic_footprint_tons": float(payload.get("annual_plastic_footprint_tons", 0)),
        "is_active": True,
        "settings": payload.get("settings", {}),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["email"],
    }
    _ORGS[org_id] = record
    _DATA_SOURCES[org_id] = []
    logger.info(f"Created organisation {org_id} by {user['email']}")
    return record


@router.get("/{org_id}")
async def get_organization(
    org_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("orgs:read")),
) -> dict[str, Any]:
    """Retrieve a single organisation profile."""
    # Non-admins can only view their own org
    if user.get("role") != "admin" and user.get("org_id") != org_id:
        raise HTTPException(status_code=403, detail="Access denied — wrong organisation")

    org = _ORGS.get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail=f"Organisation {org_id!r} not found")
    return org


@router.put("/{org_id}")
async def update_organization(
    org_id: str,
    payload: dict[str, Any],
    user: CurrentUser,
    _: Any = Depends(require_permission("orgs:write")),
) -> dict[str, Any]:
    """Update organisation metadata. Requires admin role."""
    org = _ORGS.get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail=f"Organisation {org_id!r} not found")

    updatable = {"name", "industry_sector", "gstin", "annual_plastic_footprint_tons", "settings"}
    for key, value in payload.items():
        if key in updatable:
            org[key] = value
    org["updated_at"] = datetime.now(timezone.utc).isoformat()
    org["updated_by"] = user["email"]
    return org


# ---------------------------------------------------------------------------
# Data Sources (per-org)
# ---------------------------------------------------------------------------

@router.get("/{org_id}/data-sources")
async def list_data_sources(
    org_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("datasources:read")),
) -> list[dict[str, Any]]:
    """List all data sources registered for an organisation."""
    if not _ORGS.get(org_id):
        raise HTTPException(status_code=404, detail=f"Organisation {org_id!r} not found")
    sources = _DATA_SOURCES.get(org_id, [])
    # Mask credentials before returning
    return [{**s, "connection_config": _mask_secrets(s.get("connection_config", {}))} for s in sources]


@router.post("/{org_id}/data-sources")
async def register_data_source(
    org_id: str,
    payload: dict[str, Any],
    user: CurrentUser,
    _: Any = Depends(require_permission("datasources:write")),
) -> dict[str, Any]:
    """Register a new data source for an organisation.

    Example payload:
    ```json
    {
        "name": "Production BigQuery",
        "source_type": "bigquery",
        "purpose": "erp_sales",
        "connection_config": {
            "project_id": "my-gcp-project",
            "dataset_id": "epr_compliance",
            "credentials_path": "/secrets/sa.json"
        }
    }
    ```
    """
    if not _ORGS.get(org_id):
        raise HTTPException(status_code=404, detail=f"Organisation {org_id!r} not found")

    source_type = payload.get("source_type", "").lower()
    valid_types = {"bigquery", "postgresql", "rest_api", "csv", "pubsub"}
    if source_type not in valid_types:
        raise HTTPException(
            status_code=422,
            detail=f"source_type must be one of {sorted(valid_types)}",
        )

    source_id = f"DS-{uuid.uuid4().hex[:8].upper()}"
    record: dict[str, Any] = {
        "source_id": source_id,
        "org_id": org_id,
        "name": payload.get("name", source_type),
        "source_type": source_type,
        "purpose": payload.get("purpose", "erp_sales"),
        "description": payload.get("description", ""),
        "connection_config": payload.get("connection_config", {}),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["email"],
    }
    _DATA_SOURCES.setdefault(org_id, []).append(record)
    logger.info(f"Registered DataSource {source_id} ({source_type}) for org {org_id}")
    # Return with masked secrets
    return {**record, "connection_config": _mask_secrets(record["connection_config"])}


@router.delete("/{org_id}/data-sources/{source_id}")
async def delete_data_source(
    org_id: str,
    source_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("datasources:delete")),
) -> dict[str, Any]:
    """Remove a data source registration."""
    sources = _DATA_SOURCES.get(org_id, [])
    before = len(sources)
    _DATA_SOURCES[org_id] = [s for s in sources if s["source_id"] != source_id]
    if len(_DATA_SOURCES[org_id]) == before:
        raise HTTPException(status_code=404, detail=f"DataSource {source_id!r} not found")
    return {"source_id": source_id, "status": "deleted", "deleted_by": user["email"]}


@router.post("/{org_id}/data-sources/{source_id}/test")
async def test_data_source(
    org_id: str,
    source_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("datasources:read")),
) -> dict[str, Any]:
    """Run a health-check against a registered data source."""
    sources = _DATA_SOURCES.get(org_id, [])
    source = next((s for s in sources if s["source_id"] == source_id), None)
    if not source:
        raise HTTPException(status_code=404, detail=f"DataSource {source_id!r} not found")

    try:
        from src.services.data_connector_shim import create_connector  # type: ignore[import-not-found]
        connector = create_connector(source["source_type"], org_id, source["connection_config"])
        is_healthy = await connector.health_check()
    except Exception as exc:
        logger.warning(f"DataSource test failed for {source_id}: {exc}")
        is_healthy = False

    return {
        "source_id": source_id,
        "source_type": source["source_type"],
        "healthy": is_healthy,
        "tested_by": user["email"],
        "tested_at": datetime.now(timezone.utc).isoformat(),
    }
