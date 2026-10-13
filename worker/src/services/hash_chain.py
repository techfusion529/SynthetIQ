"""HashChain  -  Simple SHA-256 hash chaining for telemetry frames.

Provides a lightweight, tamper-evident chain over TelemetryFrame objects.
Each append returns the new head digest; the head property exposes the current tip.
"""

from __future__ import annotations

import hashlib
import json
import logging

from synthetiq_shared.schemas.telemetry import TelemetryFrame

logger = logging.getLogger(__name__)


class HashChain:
    """SHA-256 hash chain seeded from a GENESIS block.

    Usage::

        chain = HashChain()
        digest = chain.append(frame)
        assert chain.head == digest
    """

    def __init__(self) -> None:
        self._head: str = hashlib.sha256(b"GENESIS").hexdigest()

    @property
    def head(self) -> str:
        """Current tip of the hash chain."""
        return self._head

    def append(self, frame: TelemetryFrame) -> str:
        """Append *frame* to the chain and return the new head digest.

        The new digest is::

            SHA-256( current_head + json.dumps(frame, sort_keys=True) )

        Args:
            frame: A validated :class:`TelemetryFrame` to append.

        Returns:
            The new head hex digest.
        """
        payload_json: str = json.dumps(frame.model_dump(mode="json"), sort_keys=True)
        new_head: str = hashlib.sha256(
            (self._head + payload_json).encode()
        ).hexdigest()
        self._head = new_head
        logger.debug("HashChain appended frame %s → head=%s", frame.frame_id, self._head)
        return self._head
