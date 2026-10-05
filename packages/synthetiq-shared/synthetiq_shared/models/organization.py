"""Multi-tenant ORM models — Organizations, Users, DataSources, and Schedules.

These models persist in PostgreSQL (or SQLite for dev) and drive
the generic multi-tenant onboarding and scheduling capabilities.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from synthetiq_shared.database import Base


# ---------------------------------------------------------------------------
# Organization — Top-level tenant
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
# User — Belongs to an Organization with RBAC role
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
# DataSource — Pluggable data connection per organization
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    organization: Mapped[Organization] = relationship(back_populates="data_sources")
    agent_configurations: Mapped[list[Any]] = relationship("AgentConfiguration", back_populates="data_source")

    def __repr__(self) -> str:
        return f"DataSource(source_id={self.source_id!r}, type={self.source_type!r}, purpose={self.purpose!r})"


# ---------------------------------------------------------------------------
# Schedule — Per-org cron-based workflow execution
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
# WorkflowRun — Execution history per org
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

    # Relationships
    organization: Mapped[Organization] = relationship(back_populates="workflow_runs")

    def __repr__(self) -> str:
        return f"WorkflowRun(run_id={self.run_id!r}, status={self.status!r})"
