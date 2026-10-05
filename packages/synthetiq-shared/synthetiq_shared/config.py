"""Centralized configuration management for SynthetIQ.

All environment variables and secrets are loaded from here.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class GCPConfig(BaseSettings):
    """Google Cloud Platform configuration."""

    project_id: str = Field(default="", alias="GCP_PROJECT_ID")
    region: str = Field(default="asia-south1", alias="GCP_REGION")
    credentials_path: str = Field(
        default="./credentials/service-account.json",
        alias="GOOGLE_APPLICATION_CREDENTIALS",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class GeminiConfig(BaseSettings):
    """Gemini AI model configuration."""

    api_key: str = Field(default="", alias="GEMINI_API_KEY")
    model: str = Field(default="gemini-2.0-flash-exp", alias="GEMINI_MODEL")
    temperature: float = Field(default=0.2, alias="GEMINI_TEMPERATURE")
    max_tokens: int = Field(default=8192, alias="GEMINI_MAX_TOKENS")
    safety_settings: str = Field(
        default="BLOCK_MEDIUM_AND_ABOVE",
        alias="GEMINI_SAFETY_SETTINGS",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def is_configured(self) -> bool:
        """Check if Gemini API key is provided."""
        return bool(self.api_key and self.api_key.strip())


class AgentConfig(BaseSettings):
    """Multi-agent orchestration configuration."""

    max_retries: int = Field(default=3, alias="AGENT_MAX_RETRIES")
    timeout_seconds: int = Field(default=120, alias="AGENT_TIMEOUT_SECONDS")
    enable_memory: bool = Field(default=True, alias="AGENT_ENABLE_MEMORY")
    memory_backend: Literal["redis", "memory"] = Field(
        default="redis",
        alias="AGENT_MEMORY_BACKEND",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class JevConfig(BaseSettings):
    """TypeSafe Jev / Nimble fraud detection configuration."""

    mode: Literal["NIMBLE_PRIMARY", "ML_MODEL", "HYBRID_ENSEMBLE", "REFLEX_PHYSICS_ONLY"] = Field(
        default="NIMBLE_PRIMARY",
        alias="JEV_MODE",
    )
    model_path: str = Field(
        default="./models/scada_fraud_detector_v1.pkl",
        alias="JEV_MODEL_PATH",
    )
    torque_threshold_nm: float = Field(default=8.0, alias="JEV_TORQUE_THRESHOLD_NM")
    power_factor_min: float = Field(default=0.78, alias="JEV_POWER_FACTOR_MIN")
    power_factor_max: float = Field(default=0.96, alias="JEV_POWER_FACTOR_MAX")
    confidence_threshold: float = Field(
        default=0.85,
        alias="JEV_CONFIDENCE_THRESHOLD",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def model_exists(self) -> bool:
        """Check if ML model file exists."""
        return Path(self.model_path).exists()


class OllamaConfig(BaseSettings):
    """Ollama local AI configuration for privacy layer."""

    host: str = Field(default="http://localhost:11434", alias="OLLAMA_HOST")
    model: str = Field(default="gemma2:2b", alias="OLLAMA_MODEL")
    enable_pii_scrubbing: bool = Field(
        default=True,
        alias="OLLAMA_ENABLE_PII_SCRUBBING",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class BigQueryConfig(BaseSettings):
    """BigQuery data warehouse configuration."""

    dataset_id: str = Field(default="epr_compliance", alias="BIGQUERY_DATASET_ID")
    sales_table: str = Field(default="sales_data", alias="BIGQUERY_SALES_TABLE")
    location: str = Field(default="asia-south1", alias="BIGQUERY_LOCATION")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class PubSubConfig(BaseSettings):
    """Google Pub/Sub configuration for SCADA telemetry."""

    scada_topic: str = Field(
        default="scada-telemetry-stream",
        alias="PUBSUB_SCADA_TOPIC",
    )
    scada_subscription: str = Field(
        default="scada-telemetry-sub",
        alias="PUBSUB_SCADA_SUBSCRIPTION",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class CPCBConfig(BaseSettings):
    """CPCB (Central Pollution Control Board) API configuration."""

    portal_url: str = Field(
        default="https://cpcb.nic.in/api/v1",
        alias="CPCB_PORTAL_URL",
    )
    api_key: str = Field(default="", alias="CPCB_API_KEY")
    digital_signature_path: str = Field(
        default="./credentials/dsc_certificate.p12",
        alias="CPCB_DIGITAL_SIGNATURE_PATH",
    )
    dsc_password: str = Field(default="", alias="CPCB_DSC_PASSWORD")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def is_configured(self) -> bool:
        """Check if CPCB credentials are provided."""
        return bool(self.api_key and self.api_key.strip())


class GSTConfig(BaseSettings):
    """GST (Goods and Services Tax) E-Way Bill API configuration."""

    api_url: str = Field(
        default="https://gst.gov.in/api/v2.1",
        alias="GST_API_URL",
    )
    api_key: str = Field(default="", alias="GST_API_KEY")
    gstin: str = Field(default="", alias="GST_GSTIN")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def is_configured(self) -> bool:
        """Check if GST credentials are provided."""
        return bool(self.api_key and self.gstin)


class FirebaseConfig(BaseSettings):
    """Firebase authentication configuration."""

    project_id: str = Field(default="", alias="FIREBASE_PROJECT_ID")
    admin_sdk_path: str = Field(
        default="./credentials/firebase-admin.json",
        alias="FIREBASE_ADMIN_SDK_PATH",
    )
    web_api_key: str = Field(default="", alias="FIREBASE_WEB_API_KEY")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def is_configured(self) -> bool:
        """Check if Firebase is configured."""
        return bool(self.project_id) and Path(self.admin_sdk_path).exists()


class RedisConfig(BaseSettings):
    """Redis configuration for agent memory and caching."""

    url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class TemporalConfig(BaseSettings):
    """Temporal workflow engine configuration."""

    host: str = Field(default="localhost:7233", alias="TEMPORAL_HOST")
    namespace: str = Field(default="default", alias="TEMPORAL_NAMESPACE")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class ObservabilityConfig(BaseSettings):
    """Observability and monitoring configuration."""

    enable_telemetry: bool = Field(default=True, alias="ENABLE_TELEMETRY")
    otel_endpoint: str = Field(
        default="http://localhost:4318",
        alias="OTEL_EXPORTER_OTLP_ENDPOINT",
    )
    prometheus_port: int = Field(default=9090, alias="PROMETHEUS_PORT")
    grafana_port: int = Field(default=3001, alias="GRAFANA_PORT")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class CostConfig(BaseSettings):
    """LLM cost management configuration."""

    tracking_enabled: bool = Field(default=True, alias="LLM_COST_TRACKING_ENABLED")
    monthly_budget_usd: float = Field(default=500.0, alias="LLM_MONTHLY_BUDGET_USD")
    alert_threshold_percent: float = Field(
        default=80.0,
        alias="LLM_ALERT_THRESHOLD_PERCENT",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class DatabaseConfig(BaseSettings):
    """PostgreSQL / SQLite database configuration."""

    url: str = Field(
        default="sqlite+aiosqlite:///./synthetiq.db",
        alias="DATABASE_URL",
    )
    echo: bool = Field(default=False, alias="DB_ECHO")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class AppConfig(BaseSettings):
    """Application-level configuration."""

    enable_mock_mode: bool = Field(default=False, alias="ENABLE_MOCK_MODE")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    api_port: int = Field(default=8000, alias="API_PORT")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class SynthetIQConfig:
    """Central configuration container for all SynthetIQ services."""

    def __init__(self) -> None:
        """Initialize all configuration sections."""
        self.gcp = GCPConfig()
        self.gemini = GeminiConfig()
        self.agent = AgentConfig()
        self.jev = JevConfig()
        self.ollama = OllamaConfig()
        self.bigquery = BigQueryConfig()
        self.pubsub = PubSubConfig()
        self.cpcb = CPCBConfig()
        self.gst = GSTConfig()
        self.firebase = FirebaseConfig()
        self.redis = RedisConfig()
        self.temporal = TemporalConfig()
        self.observability = ObservabilityConfig()
        self.cost = CostConfig()
        self.db = DatabaseConfig()
        self.app = AppConfig()

    def validate(self) -> dict[str, list[str]]:
        """Validate configuration and return warnings/errors.

        Returns:
            Dictionary with 'errors' and 'warnings' keys.
        """
        errors: list[str] = []
        warnings: list[str] = []

        # Critical validations
        if not self.gemini.is_configured:
            errors.append("GEMINI_API_KEY is not set. AI agents will not function.")

        if not self.gcp.project_id:
            warnings.append("GCP_PROJECT_ID not set. BigQuery/Pub/Sub disabled.")

        if self.jev.mode == "ML_MODEL" and not self.jev.model_exists:
            warnings.append(
                f"JEV_MODE is ML_MODEL but model not found at {self.jev.model_path}"
            )

        if not self.cpcb.is_configured:
            warnings.append("CPCB API not configured. Form-1 submission will fail.")

        if not self.gst.is_configured:
            warnings.append("GST API not configured. E-Way bill verification disabled.")

        return {"errors": errors, "warnings": warnings}

    def __repr__(self) -> str:
        """Return string representation with masked secrets."""
        return (
            f"SynthetIQConfig("
            f"gemini={'configured' if self.gemini.is_configured else 'missing'}, "
            f"gcp_project={self.gcp.project_id or 'not set'}, "
            f"mode={'mock' if self.app.enable_mock_mode else 'production'})"
        )


# Global configuration instance
config = SynthetIQConfig()


def get_config() -> SynthetIQConfig:
    """Get the global configuration instance."""
    return config
