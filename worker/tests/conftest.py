"""Test fixtures for worker."""

import sys
from pathlib import Path

# Make both `worker` (for `from src.*` imports) and `worker/src` (for bare imports)
# available so that test modules can use either import style.
_worker_root = Path(__file__).parent.parent
_src_root = _worker_root / "src"

for _p in (_src_root, _worker_root):
    _p_str = str(_p)
    if _p_str not in sys.path:
        sys.path.insert(0, _p_str)
