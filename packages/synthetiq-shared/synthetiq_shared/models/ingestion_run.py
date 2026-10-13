"""ORM model for ingestion_runs table."""
from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

try:
    from synthetiq_shared.database import Base  # type: ignore[import-not-found]
except ImportError:
    from sqlalchemy.orm import DeclarativeBase
    class Base(DeclarativeBase):  # type: ignore[no-redef]
        pass

class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(String, ForeignKey("organizations.org_id", ondelete="CASCADE"), nullable=False, index=True)
    data_source_id = Column(String, nullable=False)
    schema_type = Column(String, nullable=False)
    rows_read = Column(Integer, nullable=False, default=0)
    rows_accepted = Column(Integer, nullable=False, default=0)
    rows_quarantined = Column(Integer, nullable=False, default=0)
    source_hash = Column(String(64), nullable=True)
    schema_fingerprint = Column(String(64), nullable=True)
    status = Column(String, nullable=False, default="pending")
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
