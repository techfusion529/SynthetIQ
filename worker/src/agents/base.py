"""Base agent architecture for SynthetIQ multi-agent system.

Uses LangGraph for agent orchestration and state management.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)


@dataclass
class AgentState:
    """State container for agent execution."""

    messages: list[BaseMessage] = field(default_factory=list)
    context: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class AgentResult:
    """Result from agent execution."""

    agent_id: str
    status: str  # "success" | "failure" | "needs_review"
    data: dict[str, Any]
    reasoning: str
    confidence: float
    timestamp: datetime = field(default_factory=datetime.now)
    tokens_used: dict[str, int] = field(default_factory=dict)


class BaseAgent(ABC):
    """Abstract base class for all SynthetIQ agents."""

    def __init__(
        self,
        agent_id: str,
        role: str,
        model: ChatGoogleGenerativeAI,
        tools: list[Callable] | None = None,
        system_prompt: str | None = None,
    ) -> None:
        """Initialize base agent.

        Args:
            agent_id: Unique agent identifier
            role: Agent role description
            model: LangChain Gemini model
            tools: Optional list of tools the agent can use
            system_prompt: System instruction for the agent
        """
        self.agent_id = agent_id
        self.role = role
        self.model = model
        self.tools = tools or []
        self.system_prompt = system_prompt or self._default_system_prompt()
        self.state = AgentState()

        logger.info(f"Initialized {self.agent_id} with role: {role}")

    @abstractmethod
    def _default_system_prompt(self) -> str:
        """Return default system prompt for this agent."""
        pass

    @abstractmethod
    async def execute(self, **kwargs: Any) -> AgentResult:
        """Execute agent's primary task.

        Args:
            **kwargs: Task-specific arguments

        Returns:
            AgentResult with execution outcome
        """
        pass

    async def _invoke_model(
        self,
        prompt: str,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Invoke the underlying LLM with prompt and context.

        Args:
            prompt: User prompt
            context: Additional context data

        Returns:
            Parsed model response
        """
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=prompt),
        ]

        if context:
            context_str = f"\n\nContext:\n{context}"
            messages.append(HumanMessage(content=context_str))

        try:
            response = await self.model.ainvoke(messages)
            logger.debug(f"{self.agent_id} response: {response.content[:200]}...")

            # Track token usage if available
            if hasattr(response, "usage_metadata"):
                self.state.metadata["last_tokens"] = {
                    "input": getattr(response.usage_metadata, "input_tokens", 0),
                    "output": getattr(response.usage_metadata, "output_tokens", 0),
                }

            return {"content": response.content, "response": response}

        except Exception as e:
            logger.error(f"{self.agent_id} model invocation failed: {e}")
            self.state.errors.append(str(e))
            raise

    def update_context(self, key: str, value: Any) -> None:
        """Update agent's context state."""
        self.state.context[key] = value

    def get_context(self, key: str, default: Any = None) -> Any:
        """Retrieve value from agent's context."""
        return self.state.context.get(key, default)

    def add_message(self, message: BaseMessage) -> None:
        """Add message to agent's conversation history."""
        self.state.messages.append(message)

    def get_metrics(self) -> dict[str, Any]:
        """Get agent performance metrics."""
        return {
            "agent_id": self.agent_id,
            "role": self.role,
            "message_count": len(self.state.messages),
            "error_count": len(self.state.errors),
            "last_tokens": self.state.metadata.get("last_tokens", {}),
            "uptime": (datetime.now() - self.state.created_at).total_seconds(),
        }


class AgentRegistry:
    """Registry for managing multiple agents."""

    def __init__(self) -> None:
        """Initialize agent registry."""
        self._agents: dict[str, BaseAgent] = {}
        logger.info("Initialized AgentRegistry")

    def register(self, agent: BaseAgent) -> None:
        """Register an agent.

        Args:
            agent: Agent instance to register
        """
        if agent.agent_id in self._agents:
            logger.warning(f"Agent {agent.agent_id} already registered, replacing")

        self._agents[agent.agent_id] = agent
        logger.info(f"Registered agent: {agent.agent_id} ({agent.role})")

    def get(self, agent_id: str) -> BaseAgent | None:
        """Get agent by ID.

        Args:
            agent_id: Agent identifier

        Returns:
            Agent instance or None if not found
        """
        return self._agents.get(agent_id)

    def get_by_role(self, role: str) -> list[BaseAgent]:
        """Get all agents with specific role.

        Args:
            role: Role to search for

        Returns:
            List of agents with matching role
        """
        return [agent for agent in self._agents.values() if agent.role == role]

    def list_agents(self) -> list[dict[str, str]]:
        """List all registered agents.

        Returns:
            List of agent metadata
        """
        return [
            {"agent_id": agent.agent_id, "role": agent.role}
            for agent in self._agents.values()
        ]

    def get_all_metrics(self) -> dict[str, dict[str, Any]]:
        """Get metrics for all agents.

        Returns:
            Dictionary mapping agent_id to metrics
        """
        return {
            agent_id: agent.get_metrics()
            for agent_id, agent in self._agents.items()
        }


# Global agent registry
_registry = AgentRegistry()


def get_agent_registry() -> AgentRegistry:
    """Get the global agent registry."""
    return _registry
