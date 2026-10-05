"""Agent Configuration ORM Model — Multi-Tenant Agent Bindings & Parameters.

Stores dynamic configuration, prompt customizations, threshold parameters,
and data source bindings for each agent within an organization.
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

VALID_AGENT_NAMES = Literal[
    "brand_liability",
    "regulatory_watchdog",
    "treasury",
    "logistics",
    "auditor",
    "erp",
    "legal",
    "orchestrator",
]


class AgentConfiguration(Base):
    """Dynamic configuration and data source binding for an agent within an organization."""

    __tablename__ = "agent_configurations"

    config_id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"ACFG-{uuid.uuid4().hex[:8].upper()}"
    )
    org_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.org_id"), nullable=False
    )
    agent_name: Mapped[str] = mapped_column(String(64), nullable=False)

    # Optional binding to a specific tenant data source
    data_source_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("data_sources.source_id", ondelete="SET NULL"), nullable=True
    )

    # LLM and execution tuning
    model_name: Mapped[str] = mapped_column(String(64), default="gemini-2.0-flash")
    temperature: Mapped[float] = mapped_column(Float, default=0.2)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Hyperparameters & business rules (e.g. amortization rate, Jev thresholds, price corridors)
    parameters: Mapped[dict[str, Any]] = mapped_column(
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
    organization: Mapped[Any] = relationship("Organization", back_populates="agent_configurations")
    data_source: Mapped[Any] = relationship("DataSource", back_populates="agent_configurations")

    def __repr__(self) -> str:
        return f"AgentConfiguration(org_id={self.org_id!r}, agent={self.agent_name!r}, model={self.model_name!r})"
