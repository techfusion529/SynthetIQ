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
                    text("SELECT set_config('app.org_id', :oid, true)"), {"oid": org_id or ""}
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
    # Step 0: Ensure all ORM models are registered with Base.metadata
    try:
        import synthetiq_shared.models  # noqa: F401
    except Exception as exc:
        logger.warning(f"[DB] Notice during models pre-import in init_db: {exc}")

    # Step 1: Create all tables in its own clean, committed transaction
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("[DB] Base tables created and committed successfully")

    # Step 2: Run each self-healing ALTER in an isolated transaction so one cannot abort another
    is_pg = "postgresql" in DATABASE_URL
    bool_default = "FALSE" if is_pg else "0"
    if_not_exists = "IF NOT EXISTS " if is_pg else ""

    alter_stmts = [
        f"ALTER TABLE organizations ADD COLUMN {if_not_exists}status VARCHAR(32) DEFAULT 'active'",
        f"ALTER TABLE organizations ADD COLUMN {if_not_exists}org_type VARCHAR(64) DEFAULT 'brand_owner'",
        f"ALTER TABLE users ADD COLUMN {if_not_exists}platform_admin BOOLEAN DEFAULT {bool_default}",
        f"ALTER TABLE users ADD COLUMN {if_not_exists}last_login_at TIMESTAMP",
        f"ALTER TABLE data_sources ADD COLUMN {if_not_exists}mapping JSON",
        f"ALTER TABLE data_sources ADD COLUMN {if_not_exists}secret_ref VARCHAR(256)",
        f"ALTER TABLE audit_records ADD COLUMN {if_not_exists}org_id VARCHAR(64)",
        f"ALTER TABLE audit_records ADD COLUMN {if_not_exists}ingestion_run_id VARCHAR(64)",
        f"ALTER TABLE auctions ADD COLUMN {if_not_exists}org_id VARCHAR(64)",
        f"ALTER TABLE bids ADD COLUMN {if_not_exists}org_id VARCHAR(64)",
        f"ALTER TABLE escrow_pos ADD COLUMN {if_not_exists}org_id VARCHAR(64)",
        f"ALTER TABLE form1_records ADD COLUMN {if_not_exists}org_id VARCHAR(64)",
        f"ALTER TABLE escrow_pos ADD COLUMN {if_not_exists}advance_amount FLOAT",
        f"ALTER TABLE escrow_pos ADD COLUMN {if_not_exists}holdback_amount FLOAT",
        f"ALTER TABLE escrow_pos ADD COLUMN {if_not_exists}escrow_status VARCHAR(32) DEFAULT 'held'",
    ]

    for stmt in alter_stmts:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception:
            pass  # column already exists or table not yet migrated

    logger.info("[DB] Database tables and self-healing columns verified successfully")


async def close_db() -> None:
    """Dispose of the database engine."""
    await engine.dispose()
    logger.info("Database engine disposed")
