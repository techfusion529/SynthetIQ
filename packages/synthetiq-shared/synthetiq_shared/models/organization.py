"""Multi-tenant ORM models  -  Organizations, Users, DataSources, and Schedules.

These models persist in PostgreSQL (or SQLite for dev) and drive
the generic multi-tenant onboarding and scheduling capabilities.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from synthetiq_shared.database import Base


# ---------------------------------------------------------------------------
# OrgType enum
# ---------------------------------------------------------------------------

class OrgType(str, enum.Enum):
    brand_owner = "brand_owner"
    recycler = "recycler"
    external_auditor = "external_auditor"
    platform = "platform"


# ---------------------------------------------------------------------------
# Organization  -  Top-level tenant
# ---------------------------------------------------------------------------

class Organization(Base):
    """An enterprise onboarded into the SynthetIQ platform."""

    __tablename__ = "organizations"

    org_id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"ORG-{uuid.uuid4().hex[:8].upper()}"
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    industry_sector: Mapped[str] = mapped_column(String(128), default="FMCG")
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    country: Mapped[str] = mapped_column(String(2), default="IN")
    annual_plastic_footprint_tons: Mapped[float] = mapped_column(Float, default=0.0)

    # Organization-level settings (JSON blob for flexibility)
    settings: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, server_default="{}"
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, default="active")
    org_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    users: Mapped[list[User]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    data_sources: Mapped[list[DataSource]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    agent_configurations: Mapped[list[Any]] = relationship("AgentConfiguration", back_populates="organization", cascade="all, delete-orphan")
    schedules: Mapped[list[Schedule]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    workflow_runs: Mapped[list[WorkflowRun]] = relationship(back_populates="organization", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"Organization(org_id={self.org_id!r}, name={self.name!r})"


# ---------------------------------------------------------------------------
# User  -  Belongs to an Organization with RBAC role
# ---------------------------------------------------------------------------

VALID_ROLES = Literal["admin", "compliance_officer", "auditor", "viewer"]


class User(Base):
    """A user within an organization with role-based access."""

    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"USR-{uuid.uuid4().hex[:8].upper()}"
    )
    email: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(256), nullable=True)
    display_name: Mapped[str] = mapped_column(String(256), default="")
    firebase_uid: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)

    role: Mapped[str] = mapped_column(String(32), default="viewer")

    # Platform-level admin flag -- grants cross-tenant management capabilities
    platform_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    organization: Mapped[Organization] = relationship(back_populates="users")

    def __repr__(self) -> str:
        return f"User(user_id={self.user_id!r}, email={self.email!r}, role={self.role!r})"


# ---------------------------------------------------------------------------
# DataSource  -  Pluggable data connection per organization
# ---------------------------------------------------------------------------

VALID_SOURCE_TYPES = Literal["bigquery", "postgresql", "rest_api", "csv", "pubsub"]


class DataSource(Base):
    """A pluggable data source connection for an organization."""

    __tablename__ = "data_sources"

    source_id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"DS-{uuid.uuid4().hex[:8].upper()}"
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)  # bigquery, postgresql, rest_api, csv, pubsub
    description: Mapped[str] = mapped_column(Text, default="")

    # Connection configuration (encrypted in production)
    connection_config: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, server_default="{}"
    )

    # What this source provides
    purpose: Mapped[str] = mapped_column(
        String(64), default="erp_sales"
    )  # erp_sales, scada_telemetry, regulatory, erp_po, cpcb_portal

    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # RUN-01: ingestion mapping and secret reference
    mapping: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    secret_ref: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    organization: Mapped[Organization] = relationship(back_populates="data_sources")
    agent_configurations: Mapped[list[Any]] = relationship("AgentConfiguration", back_populates="data_source")

    def __repr__(self) -> str:
        return f"DataSource(source_id={self.source_id!r}, type={self.source_type!r}, purpose={self.purpose!r})"


# ---------------------------------------------------------------------------
# Schedule  -  Per-org cron-based workflow execution
# ---------------------------------------------------------------------------

VALID_WORKFLOW_TYPES = Literal[
    "upstream_liability",
    "auction_liquidity",
    "quad_core_audit",
    "settlement_dispatch",
    "master_e2e_compliance",
]


class Schedule(Base):
    """A cron schedule for periodic multi-agent workflow execution."""

    __tablename__ = "schedules"

    schedule_id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"SCHED-{uuid.uuid4().hex[:8].upper()}"
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    workflow_type: Mapped[str] = mapped_column(String(64), nullable=False)
    cron_expression: Mapped[str] = mapped_column(String(64), nullable=False)

    # Workflow parameters (passed to the Temporal workflow)
    workflow_params: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, server_default="{}"
    )

    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    run_count: Mapped[int] = mapped_column(default=0)
    last_status: Mapped[str] = mapped_column(String(32), default="PENDING")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    organization: Mapped[Organization] = relationship(back_populates="schedules")

    def __repr__(self) -> str:
        return f"Schedule(schedule_id={self.schedule_id!r}, cron={self.cron_expression!r}, workflow={self.workflow_type!r})"


# ---------------------------------------------------------------------------
# WorkflowRun  -  Execution history per org
# ---------------------------------------------------------------------------

class WorkflowRun(Base):
    """A record of a workflow execution for audit and tracking."""

    __tablename__ = "workflow_runs"

    run_id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"RUN-{uuid.uuid4().hex[:8].upper()}"
    )
    workflow_type: Mapped[str] = mapped_column(String(64), nullable=False)
    temporal_workflow_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    schedule_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=False
    )

    status: Mapped[str] = mapped_column(String(32), default="RUNNING")
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    triggered_by: Mapped[str] = mapped_column(String(64), default="manual")  # manual, scheduler, api
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Phase 2: extended run metadata
    input_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    hitl_required: Mapped[bool] = mapped_column(Boolean, default=False)
    temporal_run_id: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # Phase 6: HITL hardening columns
    initiated_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    hitl_resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hitl_resolver_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    hitl_reason_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Relationships
    organization: Mapped[Organization] = relationship(back_populates="workflow_runs")

    def __repr__(self) -> str:
        return f"WorkflowRun(run_id={self.run_id!r}, status={self.status!r})"


# ---------------------------------------------------------------------------
# AuctionRecord  -  Persisted auction (replaces _AUCTIONS_DB in-memory dict)
# ---------------------------------------------------------------------------

class AuctionRecord(Base):
    """A marketplace auction for EPR certificate procurement."""

    __tablename__ = "auctions"

    auction_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    target_tons: Mapped[float] = mapped_column(Float, default=0.0)
    statutory_rate_per_kg: Mapped[float] = mapped_column(Float, default=12.0)
    floor_price_inr: Mapped[float] = mapped_column(Float, default=3.6)
    ceiling_price_inr: Mapped[float] = mapped_column(Float, default=12.0)
    corridor_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    corridor_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    clearing_price_inr: Mapped[float] = mapped_column(Float, default=0.0)
    total_cleared_tons: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    company_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    winning_recyclers: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    org_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bids: Mapped[list["BidRecord"]] = relationship(back_populates="auction", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "auction_id": self.auction_id, "id": self.auction_id,
            "category": self.category, "target_tons": self.target_tons,
            "statutory_rate_per_kg": self.statutory_rate_per_kg,
            "floor_price_inr": self.floor_price_inr, "ceiling_price_inr": self.ceiling_price_inr,
            "corridor_min": self.corridor_min, "corridor_max": self.corridor_max,
            "clearing_price_inr": self.clearing_price_inr, "total_cleared_tons": self.total_cleared_tons,
            "status": self.status, "company_id": self.company_id,
            "winning_recyclers": self.winning_recyclers or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# BidRecord  -  Individual recycler bid in an auction
# ---------------------------------------------------------------------------

class BidRecord(Base):
    """A recycler bid submitted to an auction."""

    __tablename__ = "bids"

    bid_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    auction_id: Mapped[str] = mapped_column(String(64), ForeignKey("auctions.auction_id"), nullable=False)
    recycler_id: Mapped[str] = mapped_column(String(64), nullable=False)
    recycler_name: Mapped[str] = mapped_column(String(256), default="")
    plant_id: Mapped[str] = mapped_column(String(64), default="")
    plant_name: Mapped[str] = mapped_column(String(256), default="")
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    volume_tons: Mapped[float] = mapped_column(Float, default=0.0)
    price_per_kg: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(32), default="BIDDING")
    org_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    auction: Mapped[AuctionRecord] = relationship(back_populates="bids")

    def to_dict(self) -> dict:
        return {
            "bid_id": self.bid_id, "auction_id": self.auction_id,
            "recycler_id": self.recycler_id, "recycler_name": self.recycler_name,
            "plant_id": self.plant_id, "plant_name": self.plant_name,
            "category": self.category, "volume_tons": self.volume_tons,
            "price_per_kg": self.price_per_kg, "status": self.status,
            "timestamp": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# AuditRecord  -  Persisted fraud audit verdicts (replaces _AUDITS_DB)
# ---------------------------------------------------------------------------

class AuditRecord(Base):
    """A SCADA fraud audit result record."""

    __tablename__ = "audit_records"

    audit_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    recycler_id: Mapped[str] = mapped_column(String(64), nullable=False)
    plant_id: Mapped[str] = mapped_column(String(64), nullable=False)
    plastic_category: Mapped[str] = mapped_column(String(64), default="cat_i_rigid")
    reported_volume_tons: Mapped[float] = mapped_column(Float, default=0.0)
    verified_physical_melt_tons: Mapped[float] = mapped_column(Float, default=0.0)
    physical_melt_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    eway_bill_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    org_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=True
    )
    audit_verdict: Mapped[str] = mapped_column(String(32), default="PENDING")
    rejection_reasons: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    audit_hash: Mapped[str] = mapped_column(String(256), default="")
    physics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    triggered_by: Mapped[str] = mapped_column(String(64), default="")
    # RUN-01: ingestion run linkage
    ingestion_run_id: Mapped[Optional[str]] = mapped_column(String(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self) -> dict:
        return {
            "audit_id": self.audit_id, "recycler_id": self.recycler_id,
            "plant_id": self.plant_id, "plastic_category": self.plastic_category,
            "reported_volume_tons": self.reported_volume_tons,
            "verified_physical_melt_tons": self.verified_physical_melt_tons,
            "physical_melt_verified": self.physical_melt_verified,
            "confidence_score": self.confidence_score,
            "eway_bill_verified": self.eway_bill_verified,
            "audit_verdict": self.audit_verdict,
            "rejection_reasons": self.rejection_reasons or [],
            "audit_hash": self.audit_hash, "physics": self.physics,
            "triggered_by": self.triggered_by,
            "ingestion_run_id": self.ingestion_run_id,
            "timestamp": self.created_at.timestamp() if self.created_at else 0,
        }


# ---------------------------------------------------------------------------
# EscrowPORecord  -  Persisted escrow purchase orders
# ---------------------------------------------------------------------------

class EscrowPORecord(Base):
    """An 80/20 split escrow purchase order."""

    __tablename__ = "escrow_pos"

    po_number: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    recycler_id: Mapped[str] = mapped_column(String(64), nullable=False)
    recycler_name: Mapped[str] = mapped_column(String(256), default="")
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    plastic_tons: Mapped[float] = mapped_column(Float, default=0.0)
    total_amount_inr: Mapped[float] = mapped_column(Float, default=0.0)
    advance_amount_inr: Mapped[float] = mapped_column(Float, default=0.0)
    retention_amount_inr: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    escrow_account: Mapped[str | None] = mapped_column(String(64), nullable=True)
    audit_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sap_purchase_order_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sap_sync_status: Mapped[str] = mapped_column(String(64), default="PENDING")
    org_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Phase-5 escrow split columns
    advance_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    holdback_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    escrow_status: Mapped[str] = mapped_column(String(32), default="advance_pending")

    def to_dict(self) -> dict:
        total = float(self.total_amount_inr or 0.0)
        if total <= 0.0:
            total = float(self.advance_amount or 0.0) + float(self.holdback_amount or 0.0)
        advance = float(self.advance_amount_inr or 0.0)
        if advance <= 0.0:
            advance = float(self.advance_amount or 0.0)
        if advance <= 0.0 and total > 0.0:
            advance = round(total * 0.8, 2)

        retention = float(self.retention_amount_inr or 0.0)
        if retention <= 0.0:
            retention = float(self.holdback_amount or 0.0)
        if retention <= 0.0 and total > 0.0:
            retention = round(total * 0.2, 2)

        recycler = self.recycler_name or self.recycler_id or "Delhi Plastic Recyclers Ltd"

        return {
            "po_number": self.po_number,
            "company_id": self.company_id,
            "recycler_id": self.recycler_id,
            "recycler_name": recycler,
            "category": self.category,
            "plastic_tons": self.plastic_tons,
            "total_amount_inr": total,
            "advance_amount_inr": advance,
            "retention_amount_inr": retention,
            "status": self.status,
            "escrow_account": self.escrow_account,
            "audit_id": self.audit_id,
            "sap_purchase_order_number": self.sap_purchase_order_number or self.po_number,
            "sap_sync_status": self.sap_sync_status,
            "advance_amount": advance,
            "holdback_amount": retention,
            "escrow_status": self.escrow_status,
        }


# ---------------------------------------------------------------------------
# Form1Record  -  Persisted CPCB Form-1 statutory submissions
# ---------------------------------------------------------------------------

class Form1Record(Base):
    """A CPCB Form-1 statutory submission record."""

    __tablename__ = "form1_records"

    form_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    recycler_id: Mapped[str] = mapped_column(String(64), nullable=False)
    recycler_name: Mapped[str] = mapped_column(String(256), default="")
    po_number: Mapped[str] = mapped_column(String(64), nullable=False)
    audit_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    plastic_category: Mapped[str] = mapped_column(String(64), nullable=False)
    physical_melt_tons: Mapped[float] = mapped_column(Float, default=0.0)
    conversion_factor_cf: Mapped[float] = mapped_column(Float, default=1.0)
    credited_tons: Mapped[float] = mapped_column(Float, default=0.0)
    portal_status: Mapped[str] = mapped_column(String(32), default="SUBMITTED")
    portal_ack_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    dsc_signature: Mapped[str | None] = mapped_column(String(256), nullable=True)
    full_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    dispatched_by: Mapped[str] = mapped_column(String(64), default="")
    org_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self) -> dict:
        d = dict(self.full_payload or {})
        d.update({
            "form_id": self.form_id,
            "company_id": self.company_id,
            "recycler_id": self.recycler_id,
            "recycler_name": self.recycler_name,
            "po_number": self.po_number,
            "sap_purchase_order_number": self.po_number,
            "audit_id": self.audit_id,
            "plastic_category": self.plastic_category,
            "physical_melt_tons": self.physical_melt_tons,
            "physical_melt_verified_tons": self.physical_melt_tons,
            "conversion_factor_cf": self.conversion_factor_cf,
            "credited_tons": self.credited_tons,
            "portal_status": self.portal_status,
            "portal_ack_number": self.portal_ack_number,
            "dsc_signature": self.dsc_signature,
            "signed": bool(self.dsc_signature),
            "dispatched_by": self.dispatched_by,
        })
        return d


# ---------------------------------------------------------------------------
# LegalEntity  -  GST legal entity belonging to an org
# ---------------------------------------------------------------------------

class LegalEntity(Base):
    """A GST-registered legal entity under an organisation."""

    __tablename__ = "legal_entities"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: uuid.uuid4().hex
    )
    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=False
    )
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    legal_name: Mapped[str] = mapped_column(String(256), nullable=False)
    state_code: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    organization: Mapped[Organization] = relationship("Organization")

    def __repr__(self) -> str:
        return f"LegalEntity(id={self.id!r}, legal_name={self.legal_name!r})"


# ---------------------------------------------------------------------------
# Membership  -  User ↔ Org relationship with role
# ---------------------------------------------------------------------------

class Membership(Base):
    """Membership of a user in an organisation with a specific role."""

    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "org_id", name="uq_memberships_user_org"),
    )

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: uuid.uuid4().hex
    )
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.user_id"), nullable=False
    )
    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship("User")
    organization: Mapped[Organization] = relationship("Organization")

    def __repr__(self) -> str:
        return f"Membership(user_id={self.user_id!r}, org_id={self.org_id!r}, role={self.role!r})"


# ---------------------------------------------------------------------------
# InviteToken  -  Email verification and org invite tokens
# ---------------------------------------------------------------------------

class InviteToken(Base):
    """A single-use token for email verification or org invite acceptance."""

    __tablename__ = "invite_tokens"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: uuid.uuid4().hex
    )
    email: Mapped[str] = mapped_column(String(256), nullable=False)
    org_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=True
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False, default="invite")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("users.user_id"), nullable=True
    )

    def __repr__(self) -> str:
        return f"InviteToken(email={self.email!r}, purpose={self.purpose!r})"


# ---------------------------------------------------------------------------
# LlmUsageLog  -  Per-call LLM token usage for cost-cap enforcement
# ---------------------------------------------------------------------------

class LlmUsageLog(Base):
    """A record of LLM token consumption per org/agent/model call."""

    __tablename__ = "llm_usage_log"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"LLM-{uuid.uuid4().hex[:16].upper()}"
    )
    org_id: Mapped[str] = mapped_column(String(64), nullable=False)
    agent_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"LlmUsageLog(id={self.id!r}, org_id={self.org_id!r})"
