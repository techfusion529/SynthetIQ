"""Google ADK agent base utilities and tool registry for SynthetIQ.

Provides shared infrastructure for all ADK-based agents:
- Session service with Redis backend
- Agent runner factory
- Tool registration helpers
- Observability integration
"""

from __future__ import annotations

import logging
import os
from typing import Any

from google.adk.agents import LlmAgent, SequentialAgent, ParallelAgent, LoopAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global ADK Session Service
# ---------------------------------------------------------------------------

_session_service: InMemorySessionService | None = None


def get_session_service() -> InMemorySessionService:
    """Get or create the global ADK session service."""
    global _session_service
    if _session_service is None:
        _session_service = InMemorySessionService()
        logger.info("ADK InMemorySessionService initialized")
    return _session_service


# ---------------------------------------------------------------------------
# Agent Factory Helpers
# ---------------------------------------------------------------------------

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def create_llm_agent(
    name: str,
    instruction: str,
    tools: list | None = None,
    model: str | None = None,
    description: str = "",
    output_key: str | None = None,
) -> LlmAgent:
    """Create a configured LlmAgent with SynthetIQ defaults.

    Args:
        name: Unique agent name (snake_case)
        instruction: System instruction for the agent
        tools: List of tool functions or FunctionTool instances
        model: Gemini model name (defaults to env GEMINI_MODEL)
        description: Human-readable description
        output_key: Session state key to store agent output

    Returns:
        Configured LlmAgent instance
    """
    agent_tools = []
    for tool in (tools or []):
        if callable(tool) and not isinstance(tool, FunctionTool):
            agent_tools.append(FunctionTool(tool))
        else:
            agent_tools.append(tool)

    agent = LlmAgent(
        name=name,
        model=model or DEFAULT_MODEL,
        instruction=instruction,
        description=description or name.replace("_", " ").title(),
        tools=agent_tools,
    )

    if output_key:
        agent.output_key = output_key

    logger.info(f"Created ADK agent: {name} (model={model or DEFAULT_MODEL}, tools={len(agent_tools)})")
    return agent


def create_sequential_pipeline(
    name: str,
    agents: list,
    description: str = "",
) -> SequentialAgent:
    """Create a SequentialAgent pipeline.

    Args:
        name: Pipeline name
        agents: Ordered list of sub-agents
        description: Human-readable description

    Returns:
        SequentialAgent instance
    """
    return SequentialAgent(
        name=name,
        sub_agents=agents,
        description=description,
    )


def create_parallel_group(
    name: str,
    agents: list,
    description: str = "",
) -> ParallelAgent:
    """Create a ParallelAgent group for concurrent execution.

    Args:
        name: Group name
        agents: List of agents to run concurrently
        description: Human-readable description

    Returns:
        ParallelAgent instance
    """
    return ParallelAgent(
        name=name,
        sub_agents=agents,
        description=description,
    )


async def run_agent(
    agent: LlmAgent | SequentialAgent | ParallelAgent,
    user_message: str,
    session_id: str | None = None,
    user_id: str = "system",
) -> dict[str, Any]:
    """Execute an agent and collect results from the event stream.

    Args:
        agent: ADK agent to execute
        user_message: Input message / context string
        session_id: Optional session ID for state continuity
        user_id: User identifier for session tracking

    Returns:
        Dict with agent response and metadata
    """
    from google.genai import types as genai_types

    session_svc = get_session_service()

    session = await session_svc.create_session(
        app_name=agent.name,
        user_id=user_id,
    )

    runner = Runner(
        agent=agent,
        app_name=agent.name,
        session_service=session_svc,
    )

    # ADK expects a Content object, not a raw string
    message_content = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=user_message)],
    )

    final_text = ""
    tool_calls: list[dict[str, Any]] = []

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session.id,
        new_message=message_content,
    ):
        if event.is_final_response():
            if event.content and event.content.parts:
                final_text = event.content.parts[0].text or ""
        elif hasattr(event, "function_calls") and event.function_calls:
            for fc in event.function_calls:
                tool_calls.append({
                    "tool": fc.name,
                    "args": dict(fc.args) if fc.args else {},
                })

    return {
        "agent": agent.name,
        "response": final_text,
        "tool_calls": tool_calls,
        "session_id": session.id,
    }
