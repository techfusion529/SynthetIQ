"""Privacy service using local Gemma 2B via Ollama for PII scrubbing.

Ensures sensitive corporate data is cleaned before sending to external LLMs.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class PrivacyService:
    """Local PII scrubbing service using Ollama + Gemma 2B."""

    def __init__(
        self,
        ollama_host: str = "http://localhost:11434",
        model: str = "gemma2:2b",
        enabled: bool = True,
    ) -> None:
        """Initialize privacy service.

        Args:
            ollama_host: Ollama server URL
            model: Model identifier (default: gemma2:2b)
            enabled: Whether PII scrubbing is enabled
        """
        self.ollama_host = ollama_host.rstrip("/")
        self.model = model
        self.enabled = enabled
        self.timeout = 30.0

        if enabled:
            logger.info(f"Initialized PrivacyService with Ollama at {ollama_host}, model={model}")
        else:
            logger.info("PrivacyService disabled (will skip PII scrubbing)")

    async def _check_ollama_health(self) -> bool:
        """Check if Ollama server is running."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.ollama_host}/api/tags")
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"Ollama health check failed: {e}")
            return False

    async def scrub_pii(self, text: str) -> str:
        """Remove PII from text using local Gemma model.

        Args:
            text: Input text potentially containing PII

        Returns:
            Scrubbed text with PII replaced by placeholders
        """
        if not self.enabled:
            logger.debug("PII scrubbing disabled, returning original text")
            return text

        if not text or len(text.strip()) == 0:
            return text

        # First pass: regex-based scrubbing for common patterns
        text = self._regex_scrub(text)

        # Second pass: AI-powered scrubbing for contextual PII
        try:
            if await self._check_ollama_health():
                text = await self._ai_scrub(text)
            else:
                logger.warning("Ollama not available, using regex-only scrubbing")

        except Exception as e:
            logger.error(f"AI scrubbing failed: {e}, falling back to regex-only")

        return text

    def _regex_scrub(self, text: str) -> str:
        """Fast regex-based scrubbing for obvious patterns.

        Args:
            text: Input text

        Returns:
            Text with common PII patterns replaced
        """
        # Email addresses
        text = re.sub(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            '[EMAIL_REDACTED]',
            text
        )

        # Phone numbers (Indian format)
        text = re.sub(
            r'\b(?:\+91[\-\s]?)?[6-9]\d{9}\b',
            '[PHONE_REDACTED]',
            text
        )

        # PAN numbers (Indian tax ID)
        text = re.sub(
            r'\b[A-Z]{5}[0-9]{4}[A-Z]\b',
            '[PAN_REDACTED]',
            text
        )

        # GST numbers
        text = re.sub(
            r'\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b',
            '[GSTIN_REDACTED]',
            text
        )

        # Credit card numbers
        text = re.sub(
            r'\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b',
            '[CARD_REDACTED]',
            text
        )

        # Aadhaar numbers
        text = re.sub(
            r'\b\d{4}\s?\d{4}\s?\d{4}\b',
            '[AADHAAR_REDACTED]',
            text
        )

        return text

    async def _ai_scrub(self, text: str) -> str:
        """AI-powered contextual PII scrubbing using Gemma.

        Args:
            text: Input text (after regex scrubbing)

        Returns:
            Text with contextual PII replaced
        """
        prompt = f"""You are a privacy protection assistant. Your task is to identify and replace any Personally Identifiable Information (PII) in the following text with appropriate placeholders.

Replace:
- Person names with [NAME_REDACTED]
- Company names (keep generic ones like "company", "recycler") with [COMPANY_REDACTED] only if specific
- Addresses with [ADDRESS_REDACTED]
- Account numbers with [ACCOUNT_REDACTED]
- Any other sensitive personal information with [PII_REDACTED]

DO NOT replace:
- Generic business terms (company, recycler, brand, etc.)
- Technical terms (tons, kg, plastic, etc.)
- Category names (cat_i_rigid, mechanical, etc.)
- Regulatory terms (EPR, CPCB, etc.)

Text to scrub:
{text}

Return only the scrubbed text without any explanation."""

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.ollama_host}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.1,  # Low temp for consistent scrubbing
                            "num_predict": 1024,
                        }
                    }
                )

                if response.status_code == 200:
                    result = response.json()
                    scrubbed_text = result.get("response", text).strip()
                    logger.debug("Successfully scrubbed text with Gemma")
                    return scrubbed_text
                else:
                    logger.warning(f"Ollama returned status {response.status_code}")
                    return text

        except Exception as e:
            logger.error(f"Ollama API call failed: {e}")
            return text

    async def scrub_dict(self, data: dict[str, Any]) -> dict[str, Any]:
        """Recursively scrub PII from dictionary values.

        Args:
            data: Dictionary potentially containing PII

        Returns:
            Dictionary with PII scrubbed from string values
        """
        if not self.enabled:
            return data

        scrubbed = {}
        for key, value in data.items():
            if isinstance(value, str):
                scrubbed[key] = await self.scrub_pii(value)
            elif isinstance(value, dict):
                scrubbed[key] = await self.scrub_dict(value)
            elif isinstance(value, list):
                scrubbed[key] = [
                    await self.scrub_pii(item) if isinstance(item, str)
                    else await self.scrub_dict(item) if isinstance(item, dict)
                    else item
                    for item in value
                ]
            else:
                scrubbed[key] = value

        return scrubbed


# Global privacy service instance
privacy_service: PrivacyService | None = None


def initialize_privacy_service(
    ollama_host: str = "http://localhost:11434",
    model: str = "gemma2:2b",
    enabled: bool = True,
) -> PrivacyService:
    """Initialize the global privacy service.

    Args:
        ollama_host: Ollama server URL
        model: Model identifier
        enabled: Whether to enable PII scrubbing

    Returns:
        Initialized PrivacyService
    """
    global privacy_service
    privacy_service = PrivacyService(ollama_host, model, enabled)
    return privacy_service


def get_privacy_service() -> PrivacyService:
    """Get the global privacy service instance.

    Raises:
        RuntimeError: If service not initialized
    """
    if privacy_service is None:
        raise RuntimeError("PrivacyService not initialized. Call initialize_privacy_service first.")
    return privacy_service
