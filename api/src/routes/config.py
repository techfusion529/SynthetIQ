"""Engine Configuration & Microservice Health Router."""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.constants import (
    DEFAULT_GEMINI_MODEL,
    DEFAULT_JEV_MODE,
    DEFAULT_PF_MAX,
    DEFAULT_PF_MIN,
    DEFAULT_TORQUE_THRESHOLD_NM,
    MCP_URL,
    MOCKS_URL,
    SIMULATOR_URL,
    TEMPORAL_HOST,
)
from src.middleware.auth import CurrentUser
from src.middleware.rbac import require_permission

router = APIRouter(prefix="/config", tags=["System & Engine Configuration"])


class EngineConfig(BaseModel):
    gemini_api_key: str = ""
    gemini_model: str = DEFAULT_GEMINI_MODEL
    jev_mode: str = DEFAULT_JEV_MODE
    torque_threshold_nm: float = DEFAULT_TORQUE_THRESHOLD_NM
    power_factor_min: float = DEFAULT_PF_MIN
    power_factor_max: float = DEFAULT_PF_MAX
    mcp_url: str = MCP_URL
    simulator_url: str = SIMULATOR_URL
    mocks_url: str = MOCKS_URL
    temporal_host: str = TEMPORAL_HOST


# Runtime active configuration seeded from environment variables
_RUNTIME_CONFIG = EngineConfig(
    gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
    gemini_model=os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL),
    jev_mode=os.getenv("JEV_MODE", DEFAULT_JEV_MODE),
    torque_threshold_nm=float(os.getenv("JEV_TORQUE_THRESHOLD_NM", str(DEFAULT_TORQUE_THRESHOLD_NM))),
    power_factor_min=float(os.getenv("JEV_POWER_FACTOR_MIN", str(DEFAULT_PF_MIN))),
    power_factor_max=float(os.getenv("JEV_POWER_FACTOR_MAX", str(DEFAULT_PF_MAX))),
    mcp_url=os.getenv("MCP_URL", MCP_URL),
    simulator_url=os.getenv("SIMULATOR_URL", SIMULATOR_URL),
    mocks_url=os.getenv("MOCKS_URL", MOCKS_URL),
    temporal_host=os.getenv("TEMPORAL_HOST", TEMPORAL_HOST),
)


def get_runtime_config() -> EngineConfig:
    return _RUNTIME_CONFIG


def mask_key(key: str) -> str:
    if not key:
        return "NOT_CONFIGURED (Mock Fallback)"
    if len(key) <= 8:
        return "********"
    return f"{key[:6]}...{key[-4:]}"


async def check_http_service(url: str, path: str = "/health") -> dict[str, Any]:
    full_url = f"{url.rstrip('/')}{path}"
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.get(full_url)
            if resp.status_code == 200:
                return {"status": "ONLINE", "url": full_url, "code": resp.status_code}
            return {"status": "DEGRADED", "url": full_url, "code": resp.status_code}
    except Exception as e:
        return {"status": "OFFLINE", "url": full_url, "error": str(e)[:60]}


@router.get("")
async def get_system_config() -> dict[str, Any]:
    """Returns active runtime configuration and microservice statuses. Public read."""
    # Live health checks
    mcp_status = await check_http_service(_RUNTIME_CONFIG.mcp_url)
    simulator_status = await check_http_service(_RUNTIME_CONFIG.simulator_url)
    mocks_status = await check_http_service(_RUNTIME_CONFIG.mocks_url)

    return {
        "gemini": {
            "model": _RUNTIME_CONFIG.gemini_model,
            "api_key_masked": mask_key(_RUNTIME_CONFIG.gemini_api_key),
            "is_key_provided": bool(_RUNTIME_CONFIG.gemini_api_key),
            "temperature": 0.2,
        },
        "jev_mode": {
            "mode": _RUNTIME_CONFIG.jev_mode,
            "torque_threshold_nm": _RUNTIME_CONFIG.torque_threshold_nm,
            "power_factor_range": [_RUNTIME_CONFIG.power_factor_min, _RUNTIME_CONFIG.power_factor_max],
            "description": (
                "TypeSafe Jev System 1 Reflex (Physics Rules Engine)"
                if _RUNTIME_CONFIG.jev_mode == "REFLEX_PHYSICS_ONLY"
                else "Gemini System 2 Deep Forensic Reasoning"
                if _RUNTIME_CONFIG.jev_mode == "DEEP_FORENSIC_ONLY"
                else "Hybrid Dual-Speed: Jev System 1 Reflex + Gemini System 2 Audit"
            ),
        },
        "services": {
            "api": {"status": "ONLINE", "port": 8000},
            "mcp": mcp_status,
            "simulator": simulator_status,
            "mocks": mocks_status,
            "temporal": {"status": "ONLINE", "host": _RUNTIME_CONFIG.temporal_host},
        },
        "endpoints": {
            "mcp_url": _RUNTIME_CONFIG.mcp_url,
            "simulator_url": _RUNTIME_CONFIG.simulator_url,
            "mocks_url": _RUNTIME_CONFIG.mocks_url,
            "temporal_host": _RUNTIME_CONFIG.temporal_host,
        },
    }


@router.post("")
async def update_system_config(
    payload: dict[str, Any],
    user: CurrentUser,
    _: Any = Depends(require_permission("config:write")),
) -> dict[str, Any]:
    """Updates runtime engine configuration. Requires config:write (admin only)."""
    if "gemini_model" in payload and payload["gemini_model"]:
        _RUNTIME_CONFIG.gemini_model = str(payload["gemini_model"])
    if "gemini_api_key" in payload:
        _RUNTIME_CONFIG.gemini_api_key = str(payload["gemini_api_key"])
        os.environ["GEMINI_API_KEY"] = _RUNTIME_CONFIG.gemini_api_key
    if "jev_mode" in payload and payload["jev_mode"]:
        _RUNTIME_CONFIG.jev_mode = str(payload["jev_mode"])
    if "torque_threshold_nm" in payload:
        _RUNTIME_CONFIG.torque_threshold_nm = float(payload["torque_threshold_nm"])
    if "power_factor_min" in payload:
        _RUNTIME_CONFIG.power_factor_min = float(payload["power_factor_min"])
    if "power_factor_max" in payload:
        _RUNTIME_CONFIG.power_factor_max = float(payload["power_factor_max"])

    return {
        "status": "success",
        "message": "Configuration updated successfully",
        "gemini_model": _RUNTIME_CONFIG.gemini_model,
        "api_key_masked": mask_key(_RUNTIME_CONFIG.gemini_api_key),
        "jev_mode": _RUNTIME_CONFIG.jev_mode,
        "torque_threshold_nm": _RUNTIME_CONFIG.torque_threshold_nm,
    }


@router.post("/test-gemini")
async def test_gemini_connection(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Tests Gemini connectivity with given or configured API key."""
    api_key = (payload or {}).get("api_key") or _RUNTIME_CONFIG.gemini_api_key
    model = (payload or {}).get("model") or _RUNTIME_CONFIG.gemini_model

    if not api_key:
        return {
            "status": "MOCK_FALLBACK",
            "message": "No GEMINI_API_KEY provided. Using deterministic zero-hallucination fallback engine.",
            "model": model,
        }

    # When key is present, verify against Google GenAI API endpoint
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}?key={api_key}"
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "status": "CONNECTED",
                    "model": data.get("name", model),
                    "displayName": data.get("displayName", "Gemini Model"),
                    "supportedGenerationMethods": data.get("supportedGenerationMethods", []),
                }
            return {
                "status": "API_ERROR",
                "code": resp.status_code,
                "message": resp.text[:120],
            }
    except Exception as e:
        return {"status": "CONNECTION_FAILED", "error": str(e)}
