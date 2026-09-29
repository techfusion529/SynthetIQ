"""API service constants — route prefixes, CORS configs, and dynamic engine defaults."""

from __future__ import annotations

import os

API_V1_STR: str = "/api/v1"
PROJECT_NAME: str = "SynthetIQ API Gateway"
CORS_ORIGINS: list[str] = ["*"]
FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "synthetiq-cpcb-compliance")

# Microservice Endpoints
TEMPORAL_HOST: str = os.getenv("TEMPORAL_HOST", "localhost:7233")
MCP_URL: str = os.getenv("MCP_URL", "http://localhost:8001")
SIMULATOR_URL: str = os.getenv("SIMULATOR_URL", "http://localhost:9091")
MOCKS_URL: str = os.getenv("MOCKS_URL", "http://localhost:8002")

# AI & Physics Engine Configuration Defaults
DEFAULT_GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
DEFAULT_JEV_MODE: str = os.getenv("JEV_MODE", "HYBRID_ENSEMBLE")
DEFAULT_TORQUE_THRESHOLD_NM: float = float(os.getenv("JEV_TORQUE_THRESHOLD_NM", "8.0"))
DEFAULT_PF_MIN: float = float(os.getenv("JEV_POWER_FACTOR_MIN", "0.78"))
DEFAULT_PF_MAX: float = float(os.getenv("JEV_POWER_FACTOR_MAX", "0.96"))
