"""Test fixtures for api."""
from __future__ import annotations

import asyncio
import os

import pytest

# Set required env vars BEFORE any imports so the module-level singletons pick them up
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-256bit")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("ENV", "local")
os.environ.setdefault("AUTH_DEV_MODE", "true")


def _run_async(coro):
    """Run an async coroutine from sync context (Python 3.10+ compatible)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("closed")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@pytest.fixture(autouse=True, scope="session")
def setup_test_db():
    """Create all database tables and seed the test user/org."""
    async def _init():
        from synthetiq_shared.database import engine, Base
        from synthetiq_shared.models import (  # noqa: F401 — register all models
            Organization, User, DataSource, AgentConfiguration, Schedule,
            WorkflowRun, AuctionRecord, BidRecord, AuditRecord,
            EscrowPORecord, Form1Record, LegalEntity, Membership, InviteToken,
        )
        # Create all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Seed test organisation and user so auth middleware can verify the token
        from synthetiq_shared.database import async_session_factory
        async with async_session_factory() as session:
            # Check if already seeded
            from sqlalchemy import select
            existing = await session.execute(
                select(Organization).where(Organization.org_id == "ORG-TEST-001")
            )
            if existing.scalar_one_or_none() is None:
                session.add(Organization(
                    org_id="ORG-TEST-001",
                    name="Test Organisation",
                    industry_sector="FMCG",
                    country="IN",
                    is_active=True,
                    settings={},
                ))
                session.add(User(
                    user_id="USR-TEST-001",
                    email="test@synthetiq.ai",
                    display_name="Test Admin",
                    role="admin",
                    org_id="ORG-TEST-001",
                    is_active=True,
                    platform_admin=False,
                ))
                await session.commit()

    _run_async(_init())
