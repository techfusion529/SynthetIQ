"""Temporal activity: fetch_run_config_activity.

Pulls together the active regulatory pack, org policy, plant calibrations,
and obligation ledger into a single RunConfig dict for use by the master workflow.
"""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import select
from temporalio import activity
from temporalio.exceptions import ApplicationError

from synthetiq_shared.constants import RegulatoryPackStatus
from synthetiq_shared.database import get_db_session
from synthetiq_shared.models import (
    OrgPolicy,
    PlantCalibration,
    ObligationLedger,
    RegulatoryPack,
)
from synthetiq_shared.models.dynamic_config import (
    FacilitySnapshot,
    ObligationLedgerEntry,
    OrgPolicySnapshot,
    PlantCalibrationSnapshot,
    RegulatoryPackPayload,
    RunConfig,
)

logger = logging.getLogger(__name__)


@activity.defn
async def fetch_run_config_activity(org_id: str, regulatory_pack_version: str) -> dict:
    """Fetch the complete run configuration from the database.

    Queries the active regulatory pack matching the requested version, the org's
    policy, any currently-valid plant calibrations, and all obligation ledger rows.

    Args:
        org_id: Tenant organisation ID.
        regulatory_pack_version: The pack version string to look up.

    Returns:
        A serialised RunConfig dict.

    Raises:
        ApplicationError (retryable): if no active pack with the given version exists.
    """
    logger.info(
        f"[config_activity] Fetching run config for org={org_id!r}, "
        f"pack_version={regulatory_pack_version!r}"
    )

    today = date.today()

    async with get_db_session() as session:
        # 1. Regulatory pack — "default" resolves to latest active pack
        if regulatory_pack_version == "default" or not regulatory_pack_version:
            pack_res = await session.execute(
                select(RegulatoryPack)
                .where(RegulatoryPack.status == RegulatoryPackStatus.active.value)
                .order_by(RegulatoryPack.approved_at.desc())
                .limit(1)
            )
        else:
            pack_res = await session.execute(
                select(RegulatoryPack)
                .where(RegulatoryPack.version == regulatory_pack_version)
                .where(RegulatoryPack.status == RegulatoryPackStatus.active.value)
            )
        pack = pack_res.scalar_one_or_none()
        if not pack:
            raise ApplicationError(
                f"No active regulatory pack found (version={regulatory_pack_version!r})",
                non_retryable=False,
            )
        pack_payload = RegulatoryPackPayload(**pack.payload)

        # 2. Org policy — use defaults if not configured
        policy_res = await session.execute(
            select(OrgPolicy).where(OrgPolicy.org_id == org_id)
        )
        policy_row = policy_res.scalar_one_or_none()
        if policy_row:
            policy_snapshot = OrgPolicySnapshot(
                approval_threshold_tons=policy_row.approval_threshold_tons,
                categories_in_scope=policy_row.categories_in_scope or [],
                signatory_name=policy_row.signatory_name,
                signatory_designation=policy_row.signatory_designation,
                timezone=policy_row.timezone,
            )
        else:
            logger.warning(
                f"[config_activity] No OrgPolicy for org={org_id!r}; using defaults"
            )
            policy_snapshot = OrgPolicySnapshot(
                approval_threshold_tons=0.0,
                categories_in_scope=[],
                signatory_name=None,
                signatory_designation=None,
                timezone="Asia/Kolkata",
            )

        # 3. Plant calibrations — only rows valid on today's date
        cal_res = await session.execute(
            select(PlantCalibration)
            .where(PlantCalibration.org_id == org_id)
            .where(PlantCalibration.valid_from <= today)
            .where(
                (PlantCalibration.valid_to.is_(None)) | (PlantCalibration.valid_to >= today)
            )
        )
        calibrations = [
            PlantCalibrationSnapshot(
                plant_id=c.plant_id,
                material_grade=c.material_grade,
                sec_baseline_kwh_per_ton=c.sec_baseline_kwh_per_ton,
                sec_variance=c.sec_variance,
                motor_efficiency=c.motor_efficiency,
                valid_from=c.valid_from,
                valid_to=c.valid_to,
            )
            for c in cal_res.scalars().all()
        ]

        # 4. Obligation ledger — all rows for this org
        obl_res = await session.execute(
            select(ObligationLedger).where(ObligationLedger.org_id == org_id)
        )
        obligations = [
            ObligationLedgerEntry(
                org_id=o.org_id,
                fiscal_year=o.fiscal_year,
                category=o.category,
                obligation_tons=o.obligation_tons,
                source=o.source,
            )
            for o in obl_res.scalars().all()
        ]

        # 5. Facilities — all registered facilities for this org
        facilities = []
        try:
            from synthetiq_shared.models import Facility
            fac_res = await session.execute(
                select(Facility).where(Facility.org_id == org_id, Facility.is_active.is_(True))
            )
            facilities = [
                FacilitySnapshot(
                    facility_id=f.facility_id,
                    org_id=f.org_id,
                    name=f.name,
                    facility_type=f.facility_type,
                    state_code=f.state_code,
                    pincode=f.pincode,
                    cpcb_pwp_reg_no=f.cpcb_pwp_reg_no,
                    cto_number=f.cto_number,
                    licensed_capacity_tons_year=f.licensed_capacity_tons_year,
                    is_active=f.is_active,
                )
                for f in fac_res.scalars().all()
            ]
        except Exception as fac_exc:
            logger.debug(f"[config_activity] Facility query bypassed ({fac_exc})")

    run_config = RunConfig(
        pack=pack_payload,
        policy=policy_snapshot,
        calibrations=calibrations,
        obligations=obligations,
        facilities=facilities,
    )
    logger.info(
        f"[config_activity] RunConfig assembled: pack={pack.version!r}, "
        f"facilities={len(facilities)}, calibrations={len(calibrations)}, "
        f"obligations={len(obligations)}"
    )
    return run_config.model_dump(mode="json")


@activity.defn
async def update_workflow_run_activity(
    run_id: str,
    status: str,
    result: dict | None = None,
    hitl_required: bool = False,
    error_message: str | None = None,
) -> None:
    """Write back WorkflowRun status, result, and hitl_required to the DB."""
    from datetime import datetime, timezone
    from sqlalchemy import select as _sa_select
    from synthetiq_shared.database import get_db_session
    from synthetiq_shared.models import WorkflowRun

    try:
        async with get_db_session() as session:
            row = (await session.execute(
                _sa_select(WorkflowRun).where(WorkflowRun.run_id == run_id)
            )).scalar_one_or_none()
            if row:
                row.status = status
                row.hitl_required = hitl_required
                if result is not None:
                    row.result = result
                if error_message is not None:
                    row.error_message = error_message
                if status in (
                    "SUCCESS_FULLY_COMPLIANT", "COMPLETED",
                    "HALTED_DUE_TO_FRAUD", "FAILED", "CANCELLED",
                ):
                    now = datetime.now(timezone.utc)
                    row.completed_at = now
                    if row.started_at:
                        row.duration_seconds = (now - row.started_at).total_seconds()
                await session.commit()
    except Exception as exc:
        import logging as _logging
        _logging.getLogger(__name__).warning(
            f"update_workflow_run_activity failed for run_id={run_id}: {exc}"
        )
