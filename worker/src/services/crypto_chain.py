"""Immutable Cryptographic Log  -  Nanosecond SHA-256 Hash Chaining.

Enforces tamper-evident physical SCADA telemetry ingestion and audit trail integrity
as required by Feature 1 (AC 1.3) of the SynthetIQ Architecture Audit.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, asdict
from typing import Any


GENESIS_HASH = "0" * 64


@dataclass
class ChainedFrame:
    """A single cryptographically chained frame."""
    index: int
    nanosecond_timestamp: int
    previous_hash: str
    frame_hash: str
    payload: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class TelemetryHashChain:
    """Nanosecond SHA-256 hash chaining engine for SCADA telemetry and audit records."""

    def __init__(self, genesis_hash: str = GENESIS_HASH) -> None:
        self.current_hash = genesis_hash
        self.frame_count = 0
        self.chain: list[ChainedFrame] = []

    def append_frame(self, payload: dict[str, Any], timestamp_ns: int | None = None) -> ChainedFrame:
        """Append a payload to the hash chain with nanosecond precision.

        Formula:
            H_n = SHA-256( H_{n-1} || timestamp_ns || canonical_json(payload) )
        """
        if timestamp_ns is None:
            timestamp_ns = time.time_ns()

        canonical_payload = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        hasher = hashlib.sha256()
        hasher.update(self.current_hash.encode("ascii"))
        hasher.update(str(timestamp_ns).encode("ascii"))
        hasher.update(canonical_payload.encode("utf-8"))
        frame_hash = hasher.hexdigest()

        frame = ChainedFrame(
            index=self.frame_count,
            nanosecond_timestamp=timestamp_ns,
            previous_hash=self.current_hash,
            frame_hash=frame_hash,
            payload=payload,
        )

        self.chain.append(frame)
        self.current_hash = frame_hash
        self.frame_count += 1
        return frame

    def verify_integrity(self) -> tuple[bool, str]:
        """Verify the cryptographic integrity of the entire chain."""
        expected_prev = GENESIS_HASH
        for idx, frame in enumerate(self.chain):
            if frame.previous_hash != expected_prev:
                return False, f"Broken link at frame {idx}: expected prev {expected_prev}, got {frame.previous_hash}"

            canonical_payload = json.dumps(frame.payload, sort_keys=True, separators=(",", ":"))
            hasher = hashlib.sha256()
            hasher.update(expected_prev.encode("ascii"))
            hasher.update(str(frame.nanosecond_timestamp).encode("ascii"))
            hasher.update(canonical_payload.encode("utf-8"))
            computed_hash = hasher.hexdigest()

            if frame.frame_hash != computed_hash:
                return False, f"Hash mismatch at frame {idx}: stored {frame.frame_hash}, computed {computed_hash}"

            expected_prev = frame.frame_hash

        return True, f"Chain intact ({len(self.chain)} frames verified)"

    def get_latest_hash(self) -> str:
        return self.current_hash


# Singleton instance for live telemetry stream
_global_chain: TelemetryHashChain | None = None


def get_telemetry_hash_chain() -> TelemetryHashChain:
    global _global_chain
    if _global_chain is None:
        _global_chain = TelemetryHashChain()
    return _global_chain
