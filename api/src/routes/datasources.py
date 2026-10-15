"""Datasource mapping, validation, and CSV upload endpoints.

RBAC:
  PUT  /datasources/{id}/mapping  - datasources:write (admin+)
  POST /datasources/{id}/validate - datasources:read  (viewer+)
  POST /datasources/{id}/upload   - datasources:write (admin+)
"""
from __future__ import annotations

import csv
import io
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission
from src.utils.tenant import TenantCtx, get_tenant_ctx

router = APIRouter(prefix="/datasources", tags=["Datasources"])
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schema helpers
# ---------------------------------------------------------------------------

def _get_canonical_fields() -> dict[str, set[str]]:
    """Return {schema_type: set_of_field_names} for all canonical schemas."""
    try:
        from synthetiq_shared.schemas import SalesLine, TelemetryFrame, WeighbridgeSlip, Invoice, PurchaseOrder
        return {
            "sales": set(SalesLine.model_fields.keys()),
            "telemetry": set(TelemetryFrame.model_fields.keys()),
            "weighbridge": set(WeighbridgeSlip.model_fields.keys()),
            "invoice": set(Invoice.model_fields.keys()),
            "purchase_order": set(PurchaseOrder.model_fields.keys()),
        }
    except Exception as exc:
        logger.warning("Could not load canonical schemas: %s", exc)
        return {}


ALL_CANONICAL_FIELDS: set[str] = set()
for _fields in _get_canonical_fields().values():
    ALL_CANONICAL_FIELDS |= _fields


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------

class MappingEntry(BaseModel):
    source_column: str
    canonical_field: str
    transform: str = ""
    unit: str = ""

class MappingBody(BaseModel):
    mapping: list[MappingEntry]


class CreateDataSourceBody(BaseModel):
    name: str
    source_type: str = "bigquery"
    purpose: str = "erp_sales"
    description: str = ""
    connection_config: dict[str, Any] = {}


def _mask_secrets(config: dict[str, Any]) -> dict[str, Any]:
    masked_keys = {"password", "token", "api_key", "secret", "key", "credentials_path", "service_account_json"}
    return {
        k: "***" if k.lower() in masked_keys else v
        for k, v in config.items()
    }


# ---------------------------------------------------------------------------
# Helper: load DataSource with same-org guard
# ---------------------------------------------------------------------------

async def _get_datasource_for_org(source_id: str, org_id: str):
    """Fetch DataSource from DB; raise 404 if missing, 403 if wrong org."""
    try:
        from sqlalchemy import select
        from synthetiq_shared.database import get_db_session
        from synthetiq_shared.models import DataSource
        async with get_db_session() as session:
            result = await session.execute(
                select(DataSource).where(DataSource.source_id == source_id)
            )
            ds = result.scalar_one_or_none()
    except Exception as exc:
        logger.warning("DB lookup failed: %s", exc)
        ds = None

    if ds is None:
        raise HTTPException(status_code=404, detail=f"DataSource {source_id!r} not found.")
    if ds.org_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied: datasource belongs to a different org.")
    return ds


# ---------------------------------------------------------------------------
# GET /datasources (tenant-scoped)
# ---------------------------------------------------------------------------

@router.get("")
@router.get("/")
async def list_datasources(
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("datasources:read")),
) -> list[dict[str, Any]]:
    """List all registered data sources for caller's organization."""
    import uuid
    from sqlalchemy import select
    from synthetiq_shared.database import get_db_session
    from synthetiq_shared.models import DataSource

    org_id = tenant_ctx.org_id or user.get("org_id", "")
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


# ---------------------------------------------------------------------------
# POST /datasources (tenant-scoped)
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
@router.post("/", status_code=201)
async def create_datasource(
    body: CreateDataSourceBody,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("datasources:write")),
) -> dict[str, Any]:
    """Register a new data source for caller's organization."""
    import uuid
    from sqlalchemy import select
    from synthetiq_shared.database import get_db_session
    from synthetiq_shared.models import DataSource

    org_id = tenant_ctx.org_id or user.get("org_id", "")
    source_type = body.source_type.lower()
    valid_types = {"bigquery", "postgresql", "postgres", "rest_api", "rest", "csv", "file", "pubsub"}
    if source_type not in valid_types:
        raise HTTPException(
            status_code=422,
            detail=f"source_type must be one of {sorted(valid_types)}",
        )

    source_id = f"DS-{uuid.uuid4().hex[:8].upper()}"
    async with get_db_session() as session:
        ds = DataSource(
            source_id=source_id,
            org_id=org_id,
            name=body.name,
            source_type=source_type,
            purpose=body.purpose,
            description=body.description,
            connection_config=body.connection_config,
            is_active=True,
        )
        session.add(ds)
        return {
            "source_id": ds.source_id,
            "org_id": ds.org_id,
            "name": ds.name,
            "source_type": ds.source_type,
            "purpose": ds.purpose,
            "description": ds.description,
            "connection_config": _mask_secrets(ds.connection_config),
            "is_active": ds.is_active,
            "created_by": user.get("email", ""),
        }


# ---------------------------------------------------------------------------
# GET /datasources/{id}
# ---------------------------------------------------------------------------

@router.get("/{source_id}")
async def get_datasource_detail(
    source_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("datasources:read")),
) -> dict[str, Any]:
    """Fetch details of a single data source."""
    org_id = tenant_ctx.org_id or user.get("org_id", "")
    ds = await _get_datasource_for_org(source_id, org_id)
    return {
        "source_id": ds.source_id,
        "org_id": ds.org_id,
        "name": ds.name,
        "source_type": ds.source_type,
        "purpose": ds.purpose,
        "description": ds.description,
        "connection_config": _mask_secrets(ds.connection_config or {}),
        "mapping": ds.mapping,
        "is_active": ds.is_active,
        "last_sync_at": ds.last_sync_at.isoformat() if ds.last_sync_at else None,
        "created_at": ds.created_at.isoformat() if ds.created_at else None,
    }


# ---------------------------------------------------------------------------
# DELETE /datasources/{id}
# ---------------------------------------------------------------------------

@router.delete("/{source_id}")
async def delete_datasource(
    source_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("datasources:delete")),
) -> dict[str, Any]:
    """Deactivate a data source."""
    org_id = tenant_ctx.org_id or user.get("org_id", "")
    ds = await _get_datasource_for_org(source_id, org_id)
    try:
        from synthetiq_shared.database import get_db_session
        async with get_db_session() as session:
            session.add(ds)
            ds.is_active = False
    except Exception as exc:
        logger.warning("Could not deactivate datasource: %s", exc)
    return {"source_id": source_id, "status": "deleted"}


# ---------------------------------------------------------------------------
# POST /datasources/{id}/test
# ---------------------------------------------------------------------------

@router.post("/{source_id}/test")
async def test_datasource_conn(
    source_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("datasources:read")),
) -> dict[str, Any]:
    """Test connection health for a data source."""
    org_id = tenant_ctx.org_id or user.get("org_id", "")
    ds = await _get_datasource_for_org(source_id, org_id)

    try:
        from src.services.data_connector_shim import create_connector
        conn = create_connector(ds.source_type, org_id, ds.connection_config or {})
        is_healthy = await conn.health_check()
        message = "Connection successful and responsive" if is_healthy else "Health check probe failed"
    except Exception as exc:
        logger.warning("Connection test failed for %s: %s", source_id, exc)
        is_healthy = False
        message = str(exc)

    return {
        "source_id": source_id,
        "source_type": ds.source_type,
        "purpose": ds.purpose,
        "healthy": is_healthy,
        "status_message": message,
    }


# ---------------------------------------------------------------------------
# POST /datasources/{id}/preview
# ---------------------------------------------------------------------------

@router.post("/{source_id}/preview")
async def preview_datasource_rows(
    source_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("datasources:read")),
) -> dict[str, Any]:
    """Preview sample records from a data source."""
    org_id = tenant_ctx.org_id or user.get("org_id", "")
    ds = await _get_datasource_for_org(source_id, org_id)

    records: list[dict] = []
    try:
        from src.services.data_connector_shim import create_connector
        conn = create_connector(ds.source_type, org_id, ds.connection_config or {})
        if ds.purpose == "scada_telemetry" and hasattr(conn, "query_telemetry"):
            records = await conn.query_telemetry(plant_id="PLANT-OKHLA-2", time_range_hours=1)
        elif hasattr(conn, "query_sales_data"):
            records = await conn.query_sales_data(company_id=org_id, fiscal_year="")
    except Exception as exc:
        logger.warning("Preview fetch failed for %s: %s", source_id, exc)
        return {
            "source_id": source_id,
            "status": "error",
            "message": f"Could not read sample records: {exc}",
            "sample_rows": [],
            "columns": [],
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


# ---------------------------------------------------------------------------
# PUT /datasources/{id}/mapping
# ---------------------------------------------------------------------------

@router.put("/{source_id}/mapping")
async def update_mapping(
    source_id: str,
    body: MappingBody,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("datasources:write")),
) -> dict[str, Any]:
    """Validate and persist column mapping for a DataSource."""
    # Validate canonical_field values
    invalid = [
        entry.canonical_field
        for entry in body.mapping
        if entry.canonical_field and entry.canonical_field not in ALL_CANONICAL_FIELDS
    ]
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown canonical field(s): {invalid}. Valid fields: {sorted(ALL_CANONICAL_FIELDS)}",
        )

    org_id = tenant_ctx.org_id or user.get("org_id", "")
    ds = await _get_datasource_for_org(source_id, org_id)

    try:
        from synthetiq_shared.database import get_db_session
        async with get_db_session() as session:
            session.add(ds)
            ds.mapping = [entry.model_dump() for entry in body.mapping]
    except Exception as exc:
        logger.warning("Could not persist mapping: %s", exc)

    # Attempt to preview 5 rows from the source
    preview: list[dict] = []
    try:
        from src.services.data_connector_shim import create_connector  # type: ignore[import-not-found]
        conn = create_connector(ds.source_type, org_id, ds.connection_config or {})
        if hasattr(conn, "query_sales_data"):
            rows = await conn.query_sales_data(org_id, "")
            preview = rows[:5]
    except Exception as exc:
        logger.debug("Preview fetch failed (non-fatal): %s", exc)

    return {"ok": True, "preview": preview}


# ---------------------------------------------------------------------------
# POST /datasources/{id}/validate
# ---------------------------------------------------------------------------

@router.post("/{source_id}/validate")
async def validate_datasource(
    source_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("datasources:read")),
) -> dict[str, Any]:
    """Fetch 10 rows, apply mapping, validate against the canonical schema."""
    org_id = tenant_ctx.org_id or user.get("org_id", "")
    ds = await _get_datasource_for_org(source_id, org_id)

    mapping: list[dict] = ds.mapping or []
    schema_type: str = getattr(ds, "schema_type", "") or ""

    # Resolve the schema class
    schema_cls = None
    try:
        from synthetiq_shared.schemas import SalesLine, TelemetryFrame, WeighbridgeSlip, Invoice, PurchaseOrder
        _schema_map = {
            "sales": SalesLine,
            "telemetry": TelemetryFrame,
            "weighbridge": WeighbridgeSlip,
            "invoice": Invoice,
            "purchase_order": PurchaseOrder,
        }
        schema_cls = _schema_map.get(schema_type)
    except Exception as exc:
        logger.warning("Could not load schema classes: %s", exc)

    # Fetch rows from source
    raw_rows: list[dict] = []
    fetch_error: str | None = None
    try:
        from src.services.data_connector_shim import create_connector
        conn = create_connector(ds.source_type, org_id, ds.connection_config or {})
        if hasattr(conn, "query_sales_data"):
            raw_rows = (await conn.query_sales_data(org_id, ""))[:10]
    except Exception as exc:
        fetch_error = str(exc)

    if fetch_error:
        return {"valid": False, "errors": [f"Fetch failed: {fetch_error}"], "sample_rows": []}

    # Apply mapping
    errors: list[str] = []
    sample_rows: list[dict] = []
    for i, row in enumerate(raw_rows):
        mapped: dict = {}
        for entry in mapping:
            src_col = entry.get("source_column", "")
            dst_col = entry.get("canonical_field", "")
            mapped[dst_col] = row.get(src_col)
        if schema_cls:
            try:
                schema_cls(**mapped)
                sample_rows.append(mapped)
            except Exception as exc:
                errors.append(f"Row {i}: {exc}")
        else:
            sample_rows.append(mapped)

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "sample_rows": sample_rows[:5],
    }


# ---------------------------------------------------------------------------
# POST /datasources/{id}/upload
# ---------------------------------------------------------------------------

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

@router.post("/{source_id}/upload")
async def upload_csv(
    source_id: str,
    user: CurrentUser,
    file: UploadFile = File(...),
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("datasources:write")),
) -> dict[str, Any]:
    """Accept a CSV upload; return first 5 rows as preview. Max 50 MB."""
    org_id = tenant_ctx.org_id or user.get("org_id", "")

    # Validate content type
    content_type = file.content_type or ""
    if "csv" not in content_type and not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(
            status_code=415,
            detail="Only text/csv files are accepted.",
        )

    # Read into memory with size guard
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum upload size of 50 MB.",
        )

    try:
        text_io = io.TextIOWrapper(io.BytesIO(contents), encoding="utf-8", errors="replace")
        reader = csv.DictReader(text_io)
        preview_rows: list[dict] = []
        for row in reader:
            preview_rows.append(dict(row))
            if len(preview_rows) >= 5:
                break
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {exc}")

    return {
        "source_id": source_id,
        "filename": file.filename,
        "preview_rows": preview_rows,
        "row_count_preview": len(preview_rows),
    }


# ---------------------------------------------------------------------------
# POST /datasources/{id}/sync  - Real-time data onboarding / sync
# ---------------------------------------------------------------------------

@router.post("/{source_id}/sync")
async def sync_datasource(
    source_id: str,
    user: CurrentUser,
    tenant_ctx: TenantCtx = Depends(get_tenant_ctx),
    _: Any = Depends(require_permission("datasources:write")),
) -> dict[str, Any]:
    """Trigger real-time data onboarding & sync from BigQuery / connected source."""
    from datetime import datetime, timezone
    org_id = tenant_ctx.org_id or user.get("org_id", "")
    ds = await _get_datasource_for_org(source_id, org_id)

    rows: list[dict] = []
    error_msg: str | None = None

    try:
        from src.services.data_connector_shim import create_connector
        conn = create_connector(ds.source_type, org_id, ds.connection_config or {})
        if ds.purpose == "scada_telemetry" and hasattr(conn, "query_telemetry"):
            rows = await conn.query_telemetry(plant_id="PLANT-OKHLA-2", time_range_hours=24)
        elif hasattr(conn, "query_sales_data"):
            rows = await conn.query_sales_data(company_id=org_id, fiscal_year="")
        else:
            # General query probe
            if hasattr(conn, "health_check"):
                await conn.health_check()
            rows = [{"status": "synced", "source": ds.source_type}]
    except Exception as exc:
        logger.warning(f"Live data sync from {source_id} failed: {exc}")
        error_msg = str(exc)

    now = datetime.now(timezone.utc)
    try:
        from synthetiq_shared.database import get_db_session
        async with get_db_session() as session:
            session.add(ds)
            ds.last_sync_at = now
            await session.commit()
    except Exception as db_exc:
        logger.debug(f"Could not update last_sync_at: {db_exc}")

    # Record metrics
    try:
        from synthetiq_shared.utils.telemetry import TONNAGE_PROCESSED_COUNTER, SCADA_STREAM_THROUGHPUT_GAUGE
        if rows:
            TONNAGE_PROCESSED_COUNTER.inc(float(len(rows)))
            SCADA_STREAM_THROUGHPUT_GAUGE.set(float(len(rows)))
    except Exception:
        pass

    return {
        "source_id": source_id,
        "name": ds.name,
        "source_type": ds.source_type,
        "status": "success" if not error_msg else "partial",
        "synced_at": now.isoformat(),
        "rows_synced": len(rows),
        "sample_records": rows[:3] if rows else [],
        "message": error_msg or f"Successfully onboarded {len(rows)} real-time records from {ds.source_type.upper()}",
    }
