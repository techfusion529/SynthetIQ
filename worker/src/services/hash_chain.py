"""HashChain  -  Simple SHA-256 hash chaining for telemetry frames.

Provides a lightweight, tamper-evident chain over TelemetryFrame objects.
Each append returns the new head digest; the head property exposes the current tip.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import TYPE_CHECKING, Union

if TYPE_CHECKING:
    from synthetiq_shared.schemas.telemetry import TelemetryFrame

logger = logging.getLogger(__name__)


class HashChain:
    """SHA-256 hash chain seeded from a GENESIS block, scoped to an (org_id, plant_id) pair.

    Usage::

        chain = HashChain("org1", "plant1")
        digest = chain.append(frame)
        assert chain.head == digest
        assert len(chain) == 1
    """

    def __init__(self, org_id: str = "", plant_id: str = "") -> None:
        self._org_id: str = org_id
        self._plant_id: str = plant_id
        self._count: int = 0
        # Seed from (org_id, plant_id) so each chain is unique per tenant/plant
        seed = f"GENESIS:{org_id}:{plant_id}".encode()
        self._head: str = hashlib.sha256(seed).hexdigest()

    def __len__(self) -> int:
        """Number of frames appended to this chain."""
        return self._count

    @property
    def head(self) -> str:
        """Current tip of the hash chain."""
        return self._head

    def append(self, frame: "Union[TelemetryFrame, dict]") -> str:
        """Append *frame* to the chain and return the new head digest.

        The new digest is::

            SHA-256( current_head + json.dumps(frame, sort_keys=True) )

        Args:
            frame: A :class:`TelemetryFrame` or plain dict to append.

        Returns:
            The new head hex digest.
        """
        if isinstance(frame, dict):
            payload: dict = frame
            frame_id: str = str(payload.get("frame_id", ""))
        else:
            payload = frame.model_dump(mode="json")
            frame_id = str(frame.frame_id)

        payload_json: str = json.dumps(payload, sort_keys=True)
        new_head: str = hashlib.sha256(
            (self._head + payload_json).encode()
        ).hexdigest()
        self._head = new_head
        self._count += 1
        logger.debug("HashChain appended frame %s → head=%s", frame_id, self._head)
        return self._head
