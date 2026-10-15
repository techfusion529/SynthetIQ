"""Org Configuration Router — per-org policy, plant calibration, and obligation ledger endpoints.

RBAC:
  GET  /organizations/{org_id}/policy                -> same-org or platform_admin (config:read)
  PUT  /organizations/{org_id}/policy                -> same-org admin or platform_admin (config:write)
  POST /organizations/{org_id}/calibrations          -> same-org admin or platform_admin (config:write)
  GET  /organizations/{org_id}/calibrations          -> same-org or platform_admin (config:read)
  POST /organizations/{org_id}/obligations           -> same-org admin or platform_admin (config:write)
  GET  /organizations/{org_id}/obligations           -> same-org or platform_admin (config:read)
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.middleware.auth import CurrentUser
from src.middleware.rbac import assert_same_org, require_permission
from synthetiq_shared.constants import PlasticCategory, RegulatoryPackStatus
from synthetiq_shared.database import get_db_session
from synthetiq_shared.models import OrgPolicy, PlantCalibration, ObligationLedger, RegulatoryPack

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["Org Configuration"])


# ---------------------------------------------------------------------------
# RBAC helper
# ---------------------------------------------------------------------------

def _require_same_org_or_platform_admin(user: dict[str, Any], org_id: str) -> None:
    """Allow platform_admin through; enforce same-org check for all others."""
    if user.get("role") != "platform_admin":
        assert_same_org(user["org_id"], org_id)


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class UpsertOrgPolicyRequest(BaseModel):
    approval_threshold_tons: float = 0.0
    categories_in_scope: list[str] = []
    signatory_name: str | None = None
    signatory_designation: str | None = None
    timezone: str = "Asia/Kolkata"


class CreateCalibrationRequest(BaseModel):
    plant_id: str
    material_grade: str
    sec_baseline_kwh_per_ton: float
    sec_variance: float
    motor_efficiency: float = 0.92
    valid_from: date
    valid_to: date | None = None


class CreateObligationRequest(BaseModel):
    fiscal_year: str
    category: str
    obligation_tons: float
    source: str


class CreateFacilityRequest(BaseModel):
    name: str
    facility_type: str = "recycler_pwp"
    state_code: str = "DL"
    pincode: str | None = None
    cpcb_pwp_reg_no: str | None = None
    cto_number: str | None = None
    cto_valid_until: date | None = None
    licensed_capacity_tons_year: float = 5000.0
    is_active: bool = True


class CreateEWayBillRequest(BaseModel):
    eway_bill_no: str
    facility_id: str | None = None
    transporter_gstin: str | None = None
    vehicle_number: str | None = None
    source_pincode: str | None = None
    destination_pincode: str | None = None
    category_code: str | None = "cat_i_rigid"
    consignment_weight_tons: float = 0.0
    status: str = "VERIFIED"
    verification_source: str = "NIC_PORTAL"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{org_id}/policy")
async def get_org_policy(
    org_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:read")),
) -> dict[str, Any]:
    """Get the current org policy. Returns 404 if not yet configured."""
    _require_same_org_or_platform_admin(user, org_id)

    async with get_db_session() as session:
        res = await session.execute(
            select(OrgPolicy).where(OrgPolicy.org_id == org_id)
        )
        policy = res.scalar_one_or_none()
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No policy configured yet",
            )
        return {
            "id": policy.id,
            "org_id": policy.org_id,
            "approval_threshold_tons": policy.approval_threshold_tons,
            "categories_in_scope": policy.categories_in_scope,
            "signatory_name": policy.signatory_name,
            "signatory_designation": policy.signatory_designation,
            "timezone": policy.timezone,
            "created_at": policy.created_at.isoformat() if policy.created_at else None,
            "updated_at": policy.updated_at.isoformat() if policy.updated_at else None,
        }


@router.put("/{org_id}/policy")
async def upsert_org_policy(
    org_id: str,
    body: UpsertOrgPolicyRequest,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:write")),
) -> dict[str, Any]:
    """Create or update the org policy. Validates against active regulatory pack thresholds."""
    _require_same_org_or_platform_admin(user, org_id)

    if body.approval_threshold_tons < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="approval_threshold_tons must be >= 0",
        )

    # Validate categories_in_scope values
    valid_category_values = {c.value for c in PlasticCategory}
    invalid = [c for c in body.categories_in_scope if c not in valid_category_values]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid categories_in_scope values: {invalid}. Must be one of {sorted(valid_category_values)}",
        )

    async with get_db_session() as session:
        # Check active pack constraint
        pack_res = await session.execute(
            select(RegulatoryPack).where(
                RegulatoryPack.status == RegulatoryPackStatus.active.value
            )
        )
        active_pack = pack_res.scalars().first()
        if active_pack and active_pack.payload:
            delta_threshold = active_pack.payload.get("delta_threshold_default")
            if delta_threshold is not None and body.approval_threshold_tons > delta_threshold:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"approval_threshold_tons ({body.approval_threshold_tons}) must not exceed "
                        f"the active pack's delta_threshold_default ({delta_threshold})"
                    ),
                )

        res = await session.execute(
            select(OrgPolicy).where(OrgPolicy.org_id == org_id)
        )
        policy = res.scalar_one_or_none()

        if not policy:
            policy = OrgPolicy(
                org_id=org_id,
                approval_threshold_tons=body.approval_threshold_tons,
                categories_in_scope=body.categories_in_scope,
                signatory_name=body.signatory_name,
                signatory_designation=body.signatory_designation,
                timezone=body.timezone,
            )
            session.add(policy)
        else:
            policy.approval_threshold_tons = body.approval_threshold_tons
            policy.categories_in_scope = body.categories_in_scope
            policy.signatory_name = body.signatory_name
            policy.signatory_designation = body.signatory_designation
            policy.timezone = body.timezone

        await session.flush()
        logger.info(f"Upserted org policy for {org_id} by {user['email']}")
        return {
            "id": policy.id,
            "org_id": policy.org_id,
            "approval_threshold_tons": policy.approval_threshold_tons,
            "categories_in_scope": policy.categories_in_scope,
            "signatory_name": policy.signatory_name,
            "signatory_designation": policy.signatory_designation,
            "timezone": policy.timezone,
            "created_at": policy.created_at.isoformat() if policy.created_at else None,
            "updated_at": policy.updated_at.isoformat() if policy.updated_at else None,
        }


@router.post("/{org_id}/calibrations", status_code=status.HTTP_201_CREATED)
async def create_plant_calibration(
    org_id: str,
    body: CreateCalibrationRequest,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:write")),
) -> dict[str, Any]:
    """Create a plant calibration record. Returns 409 on unique-constraint violation."""
    _require_same_org_or_platform_admin(user, org_id)

    async with get_db_session() as session:
        cal = PlantCalibration(
            org_id=org_id,
            plant_id=body.plant_id,
            material_grade=body.material_grade,
            sec_baseline_kwh_per_ton=body.sec_baseline_kwh_per_ton,
            sec_variance=body.sec_variance,
            motor_efficiency=body.motor_efficiency,
            valid_from=body.valid_from,
            valid_to=body.valid_to,
        )
        session.add(cal)
        try:
            await session.flush()
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A calibration row for this (org, plant, grade, valid_from) already exists",
            )
        logger.info(f"Created plant calibration for {org_id}/{body.plant_id} by {user['email']}")
        return {
            "id": cal.id,
            "org_id": cal.org_id,
            "plant_id": cal.plant_id,
            "material_grade": cal.material_grade,
            "sec_baseline_kwh_per_ton": cal.sec_baseline_kwh_per_ton,
            "sec_variance": cal.sec_variance,
            "motor_efficiency": cal.motor_efficiency,
            "valid_from": cal.valid_from.isoformat() if cal.valid_from else None,
            "valid_to": cal.valid_to.isoformat() if cal.valid_to else None,
            "created_at": cal.created_at.isoformat() if cal.created_at else None,
        }


@router.get("/{org_id}/calibrations")
async def list_plant_calibrations(
    org_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:read")),
) -> list[dict[str, Any]]:
    """List all plant calibrations for an org, ordered by valid_from desc."""
    _require_same_org_or_platform_admin(user, org_id)

    async with get_db_session() as session:
        res = await session.execute(
            select(PlantCalibration)
            .where(PlantCalibration.org_id == org_id)
            .order_by(PlantCalibration.valid_from.desc())
        )
        cals = res.scalars().all()
        return [
            {
                "id": c.id,
                "org_id": c.org_id,
                "plant_id": c.plant_id,
                "material_grade": c.material_grade,
                "sec_baseline_kwh_per_ton": c.sec_baseline_kwh_per_ton,
                "sec_variance": c.sec_variance,
                "motor_efficiency": c.motor_efficiency,
                "valid_from": c.valid_from.isoformat() if c.valid_from else None,
                "valid_to": c.valid_to.isoformat() if c.valid_to else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in cals
        ]


@router.post("/{org_id}/obligations", status_code=status.HTTP_201_CREATED)
async def create_obligation(
    org_id: str,
    body: CreateObligationRequest,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:write")),
) -> dict[str, Any]:
    """Create an obligation ledger entry. Returns 409 on unique-constraint violation."""
    _require_same_org_or_platform_admin(user, org_id)

    async with get_db_session() as session:
        entry = ObligationLedger(
            org_id=org_id,
            fiscal_year=body.fiscal_year,
            category=body.category,
            obligation_tons=body.obligation_tons,
            source=body.source,
        )
        session.add(entry)
        try:
            await session.flush()
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An obligation entry for this (org, fiscal_year, category) already exists",
            )
        logger.info(f"Created obligation for {org_id}/{body.fiscal_year}/{body.category} by {user['email']}")
        return {
            "id": entry.id,
            "org_id": entry.org_id,
            "fiscal_year": entry.fiscal_year,
            "category": entry.category,
            "obligation_tons": entry.obligation_tons,
            "source": entry.source,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        }


@router.get("/{org_id}/obligations")
async def list_obligations(
    org_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:read")),
) -> list[dict[str, Any]]:
    """List all obligation ledger entries for an org."""
    _require_same_org_or_platform_admin(user, org_id)

    async with get_db_session() as session:
        res = await session.execute(
            select(ObligationLedger).where(ObligationLedger.org_id == org_id)
        )
        entries = res.scalars().all()
        return [
            {
                "id": e.id,
                "org_id": e.org_id,
                "fiscal_year": e.fiscal_year,
                "category": e.category,
                "obligation_tons": e.obligation_tons,
                "source": e.source,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ]


@router.get("/{org_id}/facilities")
async def list_facilities(
    org_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:read")),
) -> list[dict[str, Any]]:
    """List all registered processing plants and facilities for an org."""
    _require_same_org_or_platform_admin(user, org_id)

    async with get_db_session() as session:
        from synthetiq_shared.models.facilities import Facility
        res = await session.execute(
            select(Facility).where(Facility.org_id == org_id)
        )
        return [f.to_dict() for f in res.scalars().all()]


@router.post("/{org_id}/facilities", status_code=status.HTTP_201_CREATED)
async def create_facility(
    org_id: str,
    body: CreateFacilityRequest,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:write")),
) -> dict[str, Any]:
    """Register a new processing plant or facility for an org."""
    _require_same_org_or_platform_admin(user, org_id)

    async with get_db_session() as session:
        from synthetiq_shared.models.facilities import Facility
        fac = Facility(
            org_id=org_id,
            name=body.name,
            facility_type=body.facility_type,
            state_code=body.state_code,
            pincode=body.pincode,
            cpcb_pwp_reg_no=body.cpcb_pwp_reg_no,
            cto_number=body.cto_number,
            cto_valid_until=body.cto_valid_until,
            licensed_capacity_tons_year=body.licensed_capacity_tons_year,
            is_active=body.is_active,
        )
        session.add(fac)
        await session.commit()
        return fac.to_dict()


@router.get("/{org_id}/eway-bills")
async def list_eway_bills(
    org_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:read")),
) -> list[dict[str, Any]]:
    """List all E-Way bills and transit consignments for an org."""
    _require_same_org_or_platform_admin(user, org_id)

    async with get_db_session() as session:
        from synthetiq_shared.models.facilities import EWayBillRecord
        res = await session.execute(
            select(EWayBillRecord).where(EWayBillRecord.org_id == org_id)
        )
        return [ewb.to_dict() for ewb in res.scalars().all()]


@router.post("/{org_id}/eway-bills", status_code=status.HTTP_201_CREATED)
async def create_eway_bill(
    org_id: str,
    body: CreateEWayBillRequest,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:write")),
) -> dict[str, Any]:
    """Register or log an E-Way bill consignment for an org."""
    _require_same_org_or_platform_admin(user, org_id)

    async with get_db_session() as session:
        from synthetiq_shared.models.facilities import EWayBillRecord
        ewb = EWayBillRecord(
            eway_bill_no=body.eway_bill_no,
            org_id=org_id,
            facility_id=body.facility_id,
            transporter_gstin=body.transporter_gstin,
            vehicle_number=body.vehicle_number,
            source_pincode=body.source_pincode,
            destination_pincode=body.destination_pincode,
            category_code=body.category_code,
            consignment_weight_tons=body.consignment_weight_tons,
            status=body.status,
            verification_source=body.verification_source,
        )
        session.add(ewb)
        await session.commit()
        return ewb.to_dict()


@router.get("/{org_id}/epr-certificates")
async def list_epr_certificates(
    org_id: str,
    user: CurrentUser,
    _: Any = Depends(require_permission("config:read")),
) -> list[dict[str, Any]]:
    """List all minted/transferred EPR credit certificates for an org."""
    _require_same_org_or_platform_admin(user, org_id)

    async with get_db_session() as session:
        from synthetiq_shared.models.facilities import EPRCreditCertificate
        from sqlalchemy import or_
        res = await session.execute(
            select(EPRCreditCertificate).where(
                or_(
                    EPRCreditCertificate.brand_org_id == org_id,
                    EPRCreditCertificate.recycler_org_id == org_id,
                )
            ).order_by(EPRCreditCertificate.issued_at.desc())
        )
        return [cert.to_dict() for cert in res.scalars().all()]
