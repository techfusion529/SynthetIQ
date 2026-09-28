"""API service constants — route prefixes, CORS configs, and defaults."""

from __future__ import annotations

API_V1_STR: str = "/api/v1"
PROJECT_NAME: str = "SynthetIQ API Gateway"
CORS_ORIGINS: list[str] = ["*"]
TEMPORAL_HOST: str = "localhost:7233"
FIREBASE_PROJECT_ID: str = "synthetiq-cpcb-compliance"
