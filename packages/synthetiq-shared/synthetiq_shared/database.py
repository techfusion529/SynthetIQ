"""Async SQLAlchemy database engine and session factory for multi-tenant state.

Supports PostgreSQL (production) and SQLite (development fallback).
"""

from __future__ import annotations

import contextvars
import os
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./synthetiq.db",
)

# ContextVar for the current org_id — set per-request by get_tenant_ctx.
# None means unauthenticated / no org context (RLS SET LOCAL is skipped).
# Empty string "" means platform_admin — RLS bypass value.
_current_org_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_org_id", default=None
)


def set_current_org_id(org_id: str | None) -> None:
    """Bind org_id for the current async task so every DB session within it
    gets the correct RLS context automatically.

    Call this inside get_tenant_ctx (or equivalent) before any DB work.
    """
    _current_org_id.set(org_id)


# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("DB_ECHO", "false").lower() == "true",
    pool_pre_ping=True,
)

# Session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session with automatic RLS context.

    When _current_org_id is set (non-None), issues SET LOCAL app.org_id
    at the start of the transaction so PostgreSQL row-level security policies
    can filter rows.  Skipped for SQLite (dev) and when org_id is not set.

    Usage:
        async with get_db_session() as session:
            result = await session.execute(select(Organization))
    """
    async with async_session_factory() as session:
        try:
            org_id = _current_org_id.get()
            if org_id is not None and "postgresql" in DATABASE_URL:
                # Empty string = platform_admin bypass; RLS policy should allow all rows.
                await session.execute(
                    text("SET LOCAL app.org_id = :oid"), {"oid": org_id}
                )
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables and ensure essential columns exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Self-healing column sync for PostgreSQL and SQLite
        for col_stmt in [
            "ALTER TABLE organizations ADD COLUMN status VARCHAR(32) DEFAULT 'active'",
            "ALTER TABLE organizations ADD COLUMN org_type VARCHAR(64) DEFAULT 'brand_owner'",
            "ALTER TABLE users ADD COLUMN platform_admin BOOLEAN DEFAULT 0",
            "ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP",
            "ALTER TABLE data_sources ADD COLUMN mapping JSON",
            "ALTER TABLE data_sources ADD COLUMN secret_ref VARCHAR(256)",
            "ALTER TABLE audit_records ADD COLUMN org_id VARCHAR(64)",
            "ALTER TABLE audit_records ADD COLUMN ingestion_run_id VARCHAR(64)",
            "ALTER TABLE auctions ADD COLUMN org_id VARCHAR(64)",
            "ALTER TABLE bids ADD COLUMN org_id VARCHAR(64)",
            "ALTER TABLE escrow_pos ADD COLUMN org_id VARCHAR(64)",
            "ALTER TABLE form1_records ADD COLUMN org_id VARCHAR(64)",
            "ALTER TABLE escrow_pos ADD COLUMN advance_amount FLOAT",
            "ALTER TABLE escrow_pos ADD COLUMN holdback_amount FLOAT",
            "ALTER TABLE escrow_pos ADD COLUMN escrow_status VARCHAR(32) DEFAULT 'held'",
        ]:
            try:
                await conn.execute(text(col_stmt))
            except Exception:
                pass  # column already exists or table not created yet
    logger.info("Database tables and columns created successfully")


async def close_db() -> None:
    """Dispose of the database engine."""
    await engine.dispose()
    logger.info("Database engine disposed")
