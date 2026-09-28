"""Rate limiting middleware to prevent runaway agent tool loops."""

from __future__ import annotations

import time


class AgentRateLimiter:
    """Token bucket rate limiter for MCP tool calls."""

    def __init__(self, max_calls_per_minute: int = 120) -> None:
        self.max_calls = max_calls_per_minute
        self.calls: list[float] = []

    def check_rate_limit(self) -> bool:
        """Returns True if within limits, False if throttled."""
        now = time.time()
        self.calls = [t for t in self.calls if now - t < 60.0]
        if len(self.calls) >= self.max_calls:
            return False
        self.calls.append(now)
        return True


rate_limiter = AgentRateLimiter()
