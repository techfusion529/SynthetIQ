"""System 2 AI (Reasoning) service using Google Gemini.

Real LLM integration for:
- Regulatory document parsing
- Auction bidding strategy evaluation
- Brand liability optimization
- Dynamic planning and reasoning
"""

from __future__ import annotations

import json
import logging
from typing import Any

import google.generativeai as genai
from google.generativeai import GenerativeModel
from google.generativeai.types import GenerationConfig, HarmBlockThreshold, HarmCategory
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


class GeminiAIService:
    """Production-ready Gemini AI service with error handling and structured outputs."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-2.0-flash-exp",
        temperature: float = 0.2,
        max_tokens: int = 8192,
    ) -> None:
        """Initialize Gemini service.

        Args:
            api_key: Google AI Studio API key
            model_name: Gemini model identifier
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum output tokens
        """
        if not api_key or not api_key.strip():
            raise ValueError(
                "GEMINI_API_KEY is required. Get one at https://aistudio.google.com/app/apikey"
            )

        genai.configure(api_key=api_key)
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens

        # Configure safety settings (less restrictive for business data)
        self.safety_settings = {
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        }

        self.model = GenerativeModel(
            model_name=self.model_name,
            safety_settings=self.safety_settings,
        )

        logger.info(
            f"Initialized GeminiAIService with model={model_name}, temp={temperature}"
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
    )
    async def generate_structured(
        self,
        prompt: str,
        system_instruction: str | None = None,
    ) -> dict[str, Any]:
        """Generate structured JSON response from Gemini.

        Args:
            prompt: User prompt
            system_instruction: System instruction to guide model behavior

        Returns:
            Parsed JSON response as dictionary
        """
        try:
            generation_config = GenerationConfig(
                temperature=self.temperature,
                max_output_tokens=self.max_tokens,
                response_mime_type="application/json",
            )

            # Create model with system instruction if provided
            if system_instruction:
                model = GenerativeModel(
                    model_name=self.model_name,
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction,
                )
            else:
                model = self.model

            response = await model.generate_content_async(
                prompt,
                generation_config=generation_config,
            )

            # Parse JSON response
            result = json.loads(response.text)
            logger.debug(f"Gemini response: {result}")
            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            logger.error(f"Raw response: {response.text}")
            raise ValueError(f"Invalid JSON from Gemini: {e}")
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise

    async def analyze_regulatory_rules(self, text: str) -> dict[str, Any]:
        """Parse regulatory gazette notification into structured conversion factors.

        Args:
            text: Raw regulatory document text or PDF content

        Returns:
            Structured regulatory data with conversion factors
        """
        system_instruction = """You are an expert regulatory analyst specializing in 
        India's Extended Producer Responsibility (EPR) and Plastic Waste Management rules.
        Extract structured compliance data from regulatory documents."""

        prompt = f"""Analyze the following CPCB (Central Pollution Control Board) regulatory text 
        and extract EPR compliance rules:

{text}

Return a JSON object with this exact structure:
{{
    "fiscal_year": "FY2026-27",
    "statutory_conversion_factors": {{
        "cat_i_rigid": {{"mechanical": float, "co_processing": float}},
        "cat_ii_flexible": {{"mechanical": float, "co_processing": float}},
        "cat_iii_mlp": {{"mechanical": float, "co_processing": float}},
        "cat_iv_compostable": {{"mechanical": float, "co_processing": float}}
    }},
    "amortization_fraction": float,
    "statutory_base_rate_inr": float,
    "compliance_deadline": "YYYY-MM-DD",
    "source_document": "document name",
    "key_changes": ["change 1", "change 2"]
}}

Conversion factors represent credit multipliers for different recycling methods.
Typical ranges: mechanical (0.5-1.0), co-processing (0.6-0.9).
Amortization fraction is typically 1/3 (0.333) for historic debt."""

        result = await self.generate_structured(prompt, system_instruction)
        result["model_used"] = self.model_name
        return result

    async def evaluate_auction_strategy(
        self,
        bids: list[dict[str, Any]],
        target_tons: float,
        ceiling_price: float,
        floor_price: float,
    ) -> dict[str, Any]:
        """Treasury agent: AI-powered auction strategy within regulatory corridor.

        Args:
            bids: List of recycler bids with offered_tons and unit_price_inr
            target_tons: Required procurement volume
            ceiling_price: Maximum allowed price (100% statutory rate)
            floor_price: Minimum allowed price (30% statutory rate)

        Returns:
            Optimized auction allocation strategy
        """
        system_instruction = """You are a treasury optimization agent for EPR compliance 
        procurement. Your goal is to minimize cost while meeting volume targets within 
        strict statutory price corridors (30%-100% of base rate)."""

        prompt = f"""Execute a continuous double auction with these constraints:

TARGET: {target_tons} tons of plastic waste certificates
PRICE CORRIDOR: ₹{floor_price:.2f} - ₹{ceiling_price:.2f} per kg
BUDGET CONSTRAINT: Minimize total cost while meeting volume target

AVAILABLE BIDS:
{json.dumps(bids, indent=2)}

Consider:
1. Recycler reputation and capacity utilization
2. Price optimization within corridor
3. Risk diversification across multiple recyclers
4. Payment terms and escrow requirements

Return JSON with this structure:
{{
    "strategy": "COST_MINIMIZATION | RISK_BALANCED | SPEED_PRIORITY",
    "allocated_bids": [
        {{
            "bid_id": "string",
            "recycler_id": "string",
            "allocated_tons": float,
            "unit_price_inr": float,
            "rationale": "why selected"
        }}
    ],
    "total_cost_inr": float,
    "total_tons": float,
    "avg_price_inr": float,
    "status": "COMPLETED | PARTIAL",
    "optimization_notes": "explanation of strategy"
}}"""

        result = await self.generate_structured(prompt, system_instruction)
        result["cleared_tons"] = result.get("total_tons", 0)
        result["clearing_price_inr"] = result.get("avg_price_inr", 0)
        result["winning_bids"] = result.get("allocated_bids", [])
        return result

    async def calculate_brand_liability(
        self,
        sales_data: list[dict[str, Any]],
        fiscal_year: str,
        historic_debt_tons: float = 0.0,
    ) -> dict[str, Any]:
        """Calculate EPR liability from ERP sales data using AI reasoning.

        Args:
            sales_data: List of product sales records
            fiscal_year: Target fiscal year
            historic_debt_tons: Carryover debt from previous years

        Returns:
            Detailed liability breakdown
        """
        system_instruction = """You are a compliance analyst calculating Extended Producer 
        Responsibility (EPR) liability for brands. Apply statutory rules including 1/3 
        amortization for historic debt."""

        prompt = f"""Calculate EPR plastic waste liability for {fiscal_year}:

SALES DATA:
{json.dumps(sales_data, indent=2)}

HISTORIC DEBT: {historic_debt_tons} tons (carry-over from previous years)

RULES:
1. Calculate total plastic sold by category (cat_i_rigid, cat_ii_flexible, etc.)
2. Apply 1/3 amortization rule: only 1/3 of historic debt must be cleared this year
3. Sum current year liability + amortized historic debt
4. Subtract any already fulfilled obligations

Return JSON:
{{
    "company_id": "string",
    "fiscal_year": "{fiscal_year}",
    "current_year_liability_tons": float,
    "historic_debt_tons": float,
    "amortized_debt_tons": float,
    "already_fulfilled_tons": float,
    "net_liability_tons": float,
    "breakdown_by_category": {{
        "cat_i_rigid": float,
        "cat_ii_flexible": float,
        "cat_iii_mlp": float,
        "cat_iv_compostable": float
    }},
    "confidence_score": float,
    "compliance_status": "COMPLIANT | AT_RISK | NON_COMPLIANT"
}}"""

        return await self.generate_structured(prompt, system_instruction)

    async def plan_logistics_verification(
        self,
        eway_bill_data: dict[str, Any],
        qr_code_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Logistics agent: Verify material origin and transportation.

        Args:
            eway_bill_data: GST E-Way bill information
            qr_code_data: Optional QR code packaging ledger data

        Returns:
            Verification assessment
        """
        system_instruction = """You are a logistics verification agent ensuring waste 
        material authenticity through E-Way bill and QR code validation."""

        prompt = f"""Verify the authenticity and compliance of this waste shipment:

E-WAY BILL DATA:
{json.dumps(eway_bill_data, indent=2)}

QR CODE DATA:
{json.dumps(qr_code_data or {}, indent=2)}

Validate:
1. Origin and destination match expectations
2. Material weight consistency
3. Transportation documentation
4. Timeline feasibility
5. Regulatory compliance

Return JSON:
{{
    "verification_status": "VERIFIED | SUSPICIOUS | REJECTED",
    "origin_verified": bool,
    "destination_verified": bool,
    "weight_consistency": bool,
    "timeline_feasible": bool,
    "fraud_risk_score": float,
    "flags": ["list of concerns"],
    "recommendation": "APPROVE | MANUAL_REVIEW | REJECT"
}}"""

        return await self.generate_structured(prompt, system_instruction)


# Global service instance (initialized by worker)
gemini_service: GeminiAIService | None = None


def initialize_gemini_service(
    api_key: str,
    model_name: str = "gemini-2.0-flash-exp",
    temperature: float = 0.2,
    max_tokens: int = 8192,
) -> GeminiAIService:
    """Initialize the global Gemini service instance.

    Args:
        api_key: Google AI API key
        model_name: Model identifier
        temperature: Sampling temperature
        max_tokens: Max output tokens

    Returns:
        Initialized GeminiAIService
    """
    global gemini_service
    gemini_service = GeminiAIService(api_key, model_name, temperature, max_tokens)
    return gemini_service


def get_gemini_service() -> GeminiAIService:
    """Get the global Gemini service instance.

    Raises:
        RuntimeError: If service not initialized
    """
    if gemini_service is None:
        raise RuntimeError(
            "GeminiAIService not initialized. Call initialize_gemini_service first."
        )
    return gemini_service
