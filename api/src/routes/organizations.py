"""Organizations & Data Sources Router — Persistent Multi-Tenant Administration.

RBAC:
  GET    /organizations/                  → orgs:read          (viewer+)
  POST   /organizations/                  → orgs:write         (admin)
  GET    /organizations/{id}              → orgs:read          (viewer+)
  PUT    /organizations/{id}              → orgs:write         (admin)
  GET    /organizations/{id}/data-sources → datasources:read   (compliance_officer+)
  POST   /organizations/{id}/data-sources → datasources:write  (admin)
  DELETE /organizations/{id}/data-sources/{ds_id} → datasources:delete (admin)
  POST   /organizations/{id}/data-sources/{ds_id}/test    → datasources:read   (compliance_officer+)
  POST   /organizations/{id}/data-sources/{ds_id}/preview → datasources:read   (compliance_officer+)
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.services.data_connector_shim import create_connector
from synthetiq_shared.database import get_db_session
from synthetiq_shared.models import DataSource, Organization

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/organizations", tags=["Organizations & Data Sources"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mask_secrets(config: dict[str, Any]) -> dict[str, Any]:
    """Replace credential values with masked placeholders."""
    masked_keys = {"password", "token", "api_key", "secret", "key", "credentials_path", "service_account_json"}
    return {
        k: "***" if k.lower() in masked_keys else v
        for k, v in config.items()
    }


def _verify_org_access(user: dict[str, Any], org_id: str) -> None:
    if user.get("role") != "admin" and user.get("org_id") != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — wrong organisation",
        )


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateOrgRequest(BaseModel):
    name: str
    industry_sector: str = "FMCG"
    gstin: str | None = None
    country: str = "IN"
    annual_plastic_footprint_tons: float = 0.0
    settings: dict[str, Any] = {}


class UpdateOrgRequest(BaseModel):
    name: str | None = None
    industry_sector: str | None = None
    gstin: str | None = None
    annual_plastic_footprint_tons: float | None = None
    settings: dict[str, Any] | None = None


class RegisterDataSourceRequest(BaseModel):
    name: str
    source_type: str  # bigquery, postgresql, rest_api, csv
    purpose: str = "erp_sales"  # erp_sales, scada_telemetry, regulatory, erp_po, cpcb_portal
    description: str = ""
    connection_config: dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Organisation CRUD
# ---------------------------------------------------------------------------

@router.get("/")
async def list_organizations(
    user: CurrentUser,
    _: Any = Depends(require_permission("orgs:read")),
) -> list[dict[str, Any]]:
    """List all active organisations. Non-admins see only their own org."""
    async with get_db_session() as session:
        query = select(Organization).where(Organization.is_active.is_(True))
        if user.get("role") != "admin":
            query = query.where(Organization.org_id == user.get("org_id", ""))

        result = await session.execute(query)
        orgs = result.scalars().all()

        return [
            {
                "org_id": o.org_id,
                "name": o.name,
                "industry_sector": o.industry_sector,
                "gstin": o.gstin,
                "country": o.country,
                "annual_plastic_footprint_tons": o.annual_plastic_footprint_tons,
                "is_active": o.is_active,
                "settings": o.settings or {},
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orgs
        ]


@router.post("/")
async def create_organization(
    payload: CreateOrgRequest,
    user: CurrentUser,
    _: Any = Depends(require_permission("orgs:write")),
) -> dict[str, Any]:
    """Onboard a new organisation. Requires admin role."""
    org_id = f"ORG-{uuid.uuid4().hex[:8].upper()}"

    async with get_db_session() as session:
        record = Organization(
            org_id=org_id,
            name=payload.name,
            industry_sector=payload.industry_sector,
            gstin=payload.gstin,
            country=payload.country,
            annual_plastic_footprint_tons=payload.annual_plastic_footprint_tons,
            settings=payload.settings,
            is_active=True,
        )
        session.add(record)
        logger.info(f"Created organisation {org_id} ({payload.name}) by {user['email']}")

        return {
            "org_id": record.org_id,
            "name": record.name,
            "industry_sector": record.industry_sector,
            "gstin": record.gstin,
            "country": record.country,
            "annual_plastic_footprint_tons": record.annual_plastic_footprint_tons,
            "is_active": record.is_active,
            "created_by": user["email"],
        }


@router.get("/{org_id}")
async def get_organization(
    org_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("orgs:read")),
) -> dict[str, Any]:
    """Retrieve a single organisation profile."""
    _verify_org_access(user, org_id)

    async with get_db_session() as session:
        res = await session.execute(select(Organization).where(Organization.org_id == org_id))
        org = res.scalar_one_or_none()
        if not org:
            raise HTTPException(status_code=404, detail=f"Organisation {org_id!r} not found")

        return {
            "org_id": org.org_id,
            "name": org.name,
            "industry_sector": org.industry_sector,
            "gstin": org.gstin,
            "country": org.country,
            "annual_plastic_footprint_tons": org.annual_plastic_footprint_tons,
            "is_active": org.is_active,
            "settings": org.settings or {},
            "created_at": org.created_at.isoformat() if org.created_at else None,
            "updated_at": org.updated_at.isoformat() if org.updated_at else None,
        }


@router.put("/{org_id}")
async def update_organization(
    org_id: str,
    payload: UpdateOrgRequest,
    user: CurrentUser,
    _: Any = Depends(require_permission("orgs:write")),
) -> dict[str, Any]:
    """Update organisation metadata. Requires admin role."""
    _verify_org_access(user, org_id)

    async with get_db_session() as session:
        res = await session.execute(select(Organization).where(Organization.org_id == org_id))
        org = res.scalar_one_or_none()
        if not org:
            raise HTTPException(status_code=404, detail=f"Organisation {org_id!r} not found")

        if payload.name is not None:
            org.name = payload.name
        if payload.industry_sector is not None:
            org.industry_sector = payload.industry_sector
        if payload.gstin is not None:
            org.gstin = payload.gstin
        if payload.annual_plastic_footprint_tons is not None:
            org.annual_plastic_footprint_tons = payload.annual_plastic_footprint_tons
        if payload.settings is not None:
            org.settings = payload.settings

        logger.info(f"Updated organisation {org_id} by {user['email']}")
        return {
            "org_id": org.org_id,
            "name": org.name,
            "industry_sector": org.industry_sector,
            "gstin": org.gstin,
            "annual_plastic_footprint_tons": org.annual_plastic_footprint_tons,
            "settings": org.settings,
            "updated_by": user["email"],
        }


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
    _verify_org_access(user, org_id)

    async with get_db_session() as session:
        res = await session.execute(
            select(DataSource)
            .where(DataSource.org_id == org_id)
            .where(DataSource.is_active.is_(True))
            .order_by(DataSource.created_at.desc())
        )
        sources = res.scalars().all()

        return [
            {
                "source_id": s.source_id,
                "name": s.name,
                "source_type": s.source_type,
                "purpose": s.purpose,
                "description": s.description,
                "connection_config": _mask_secrets(s.connection_config or {}),
                "is_active": s.is_active,
                "last_sync_at": s.last_sync_at.isoformat() if s.last_sync_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sources
        ]


@router.post("/{org_id}/data-sources")
async def register_data_source(
    org_id: str,
    payload: RegisterDataSourceRequest,
    user: CurrentUser,
    _: Any = Depends(require_permission("datasources:write")),
) -> dict[str, Any]:
    """Register a new dynamic data source for an organisation."""
    _verify_org_access(user, org_id)

    source_type = payload.source_type.lower()
    valid_types = {"bigquery", "postgresql", "postgres", "rest_api", "rest", "csv", "file", "pubsub"}
    if source_type not in valid_types:
        raise HTTPException(
            status_code=422,
            detail=f"source_type must be one of {sorted(valid_types)}",
        )

    source_id = f"DS-{uuid.uuid4().hex[:8].upper()}"

    async with get_db_session() as session:
        # Check org exists
        res = await session.execute(select(Organization).where(Organization.org_id == org_id))
        if not res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Organisation {org_id!r} not found")

        ds = DataSource(
            source_id=source_id,
            org_id=org_id,
            name=payload.name,
            source_type=source_type,
            purpose=payload.purpose,
            description=payload.description,
            connection_config=payload.connection_config,
            is_active=True,
        )
        session.add(ds)
        logger.info(f"Registered DataSource {source_id} ({source_type}) for org {org_id}")

        return {
            "source_id": ds.source_id,
            "org_id": ds.org_id,
            "name": ds.name,
            "source_type": ds.source_type,
            "purpose": ds.purpose,
            "description": ds.description,
            "connection_config": _mask_secrets(ds.connection_config),
            "is_active": ds.is_active,
            "created_by": user["email"],
        }


@router.delete("/{org_id}/data-sources/{source_id}")
async def delete_data_source(
    org_id: str,
    source_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("datasources:delete")),
) -> dict[str, Any]:
    """Remove or deactivate a data source registration."""
    _verify_org_access(user, org_id)

    async with get_db_session() as session:
        res = await session.execute(
            select(DataSource).where(DataSource.source_id == source_id).where(DataSource.org_id == org_id)
        )
        ds = res.scalar_one_or_none()
        if not ds:
            raise HTTPException(status_code=404, detail=f"DataSource {source_id!r} not found")

        ds.is_active = False
        logger.info(f"Deactivated DataSource {source_id} for org {org_id}")
        return {"source_id": source_id, "status": "deleted", "deleted_by": user["email"]}


@router.post("/{org_id}/data-sources/{source_id}/test")
async def test_data_source(
    org_id: str,
    source_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("datasources:read")),
) -> dict[str, Any]:
    """Run a live ping / connection health-check against a registered data source."""
    _verify_org_access(user, org_id)

    async with get_db_session() as session:
        res = await session.execute(
            select(DataSource).where(DataSource.source_id == source_id).where(DataSource.org_id == org_id)
        )
        ds = res.scalar_one_or_none()
        if not ds:
            raise HTTPException(status_code=404, detail=f"DataSource {source_id!r} not found")

        try:
            connector = create_connector(ds.source_type, org_id, ds.connection_config)
            is_healthy = await connector.health_check()
            message = "Connection successful and responsive" if is_healthy else "Connection failed health check probe"
        except Exception as exc:
            logger.warning(f"DataSource test failed for {source_id}: {exc}")
            is_healthy = False
            message = str(exc)

        return {
            "source_id": source_id,
            "source_type": ds.source_type,
            "purpose": ds.purpose,
            "healthy": is_healthy,
            "status_message": message,
            "tested_by": user["email"],
        }


@router.post("/{org_id}/data-sources/{source_id}/preview")
async def preview_data_source(
    org_id: str,
    source_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("datasources:read")),
) -> dict[str, Any]:
    """Retrieve sample data records from the connected data source for schema preview."""
    _verify_org_access(user, org_id)

    async with get_db_session() as session:
        res = await session.execute(
            select(DataSource).where(DataSource.source_id == source_id).where(DataSource.org_id == org_id)
        )
        ds = res.scalar_one_or_none()
        if not ds:
            raise HTTPException(status_code=404, detail=f"DataSource {source_id!r} not found")

        connector = create_connector(ds.source_type, org_id, ds.connection_config)

        records = []
        try:
            if ds.purpose == "scada_telemetry":
                records = await connector.query_telemetry(plant_id="PLANT-OKHLA-2", time_range_hours=1)
            else:
                records = await connector.query_sales_data(company_id=org_id, fiscal_year="FY2026-27")
        except Exception as e:
            logger.warning(f"Failed to fetch preview from {source_id}: {e}")
            return {
                "source_id": source_id,
                "status": "error",
                "message": f"Could not read sample records: {e}",
                "records": [],
            }

        return {
            "source_id": source_id,
            "source_type": ds.source_type,
            "purpose": ds.purpose,
            "total_sample_records": len(records),
            "sample_rows": records[:5],
            "columns": list(records[0].keys()) if records else [],
            "status": "success",
        }
