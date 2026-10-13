"""MCP tools export.

Tools with heavy cloud dependencies (BigQuery, PubSub) are imported lazily
so that lightweight tools (gst_tool, cpcb_tool) can be loaded independently
without requiring google-cloud-bigquery or google-cloud-pubsub at import time.
"""

from __future__ import annotations

__all__ = [
    "bigquery_erp_tool",
    "pubsub_scada_tool",
    "gst_tool",
    "cpcb_tool",
]

_MODULE_MAP: dict[str, str] = {
    "bigquery_erp_tool": "src.tools.bigquery_tool",
    "pubsub_scada_tool": "src.tools.pubsub_tool",
    "gst_tool": "src.tools.gst_tool",
    "cpcb_tool": "src.tools.cpcb_tool",
}


def __getattr__(name: str):
    if name in _MODULE_MAP:
        import importlib
        mod = importlib.import_module(_MODULE_MAP[name])
        return getattr(mod, name)
    raise AttributeError(f"module 'src.tools' has no attribute {name!r}")
