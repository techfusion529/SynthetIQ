"""SynthetIQ Zero-Trust MCP Server  -  tool execution gateway for AI agents.

# WARNING: This MCP server must only be accessible from the internal network.
# Never expose it directly to the internet.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading
from typing import Any

from src.constants import DEFAULT_MCP_PORT, MCP_SERVER_NAME, MCP_SERVER_VERSION
from src.tools import cpcb_tool, gst_tool
from src.tools.bigquery_tool import initialize_bigquery_tool, get_bigquery_tool
from src.tools.pubsub_tool import initialize_pubsub_tool, get_pubsub_tool

# Internal auth token for all /call endpoints.
# Must be set to a strong random value in production via MCP_INTERNAL_TOKEN env var.
_MCP_TOKEN: str | None = os.getenv("MCP_INTERNAL_TOKEN")


def init_gcp_tools() -> None:
    """Initialize GCP-backed MCP tools with environment settings."""
    project_id = os.getenv("GCP_PROJECT_ID", "synthetiq-dev")
    dataset_id = os.getenv("BIGQUERY_DATASET_ID", "epr_compliance")
    sales_table = os.getenv("BIGQUERY_SALES_TABLE", "sales_data")
    subscription = os.getenv("PUBSUB_SCADA_SUBSCRIPTION", "scada-telemetry-sub")
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    try:
        initialize_bigquery_tool(
            project_id=project_id,
            dataset_id=dataset_id,
            sales_table=sales_table,
            credentials_path=creds_path,
        )
        print(f" -  MCP BigQuery tool ready (project={project_id}, dataset={dataset_id})")
    except Exception as e:
        print(f"⚠ MCP BigQuery tool initialization deferred: {e}")

    try:
        initialize_pubsub_tool(
            project_id=project_id,
            subscription_name=subscription,
            credentials_path=creds_path,
        )
        print(f" -  MCP Pub/Sub tool ready (project={project_id}, subscription={subscription})")
    except Exception as e:
        print(f"⚠ MCP Pub/Sub tool initialization deferred: {e}")


class MCPHTTPHandler(BaseHTTPRequestHandler):
    """HTTP gateway for MCP healthchecks and tool invocations."""

    def _check_bearer_auth(self) -> bool:
        """Return True if request carries a valid MCP_INTERNAL_TOKEN.

        When MCP_INTERNAL_TOKEN is not set, access is allowed but a warning is
        logged — this permits local dev without a token while enforcing auth in
        any environment where the variable is configured.
        """
        if not _MCP_TOKEN:
            print(
                "WARNING: MCP_INTERNAL_TOKEN not set — unauthenticated access permitted. "
                "Set this variable before any production deployment.",
                file=sys.stderr,
            )
            return True
        auth_header = self.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return False
        return auth_header[len("Bearer "):].strip() == _MCP_TOKEN

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = {
                "status": "ok",
                "server": MCP_SERVER_NAME,
                "version": MCP_SERVER_VERSION,
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
        elif self.path == "/tools":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            tools_list = [
                {"name": "query_erp_sales", "description": "BigQuery ERP sales query"},
                {"name": "fetch_scada_telemetry", "description": "Pub/Sub SCADA stream reader"},
                {"name": "verify_eway_bill", "description": "GST E-Way bill validator"},
                {"name": "verify_cto_capacity", "description": "CPCB CTO capacity checker"},
            ]
            self.wfile.write(json.dumps({"tools": tools_list}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self) -> None:
        if self.path.startswith("/call"):
            # Authenticate before processing any tool call
            if not self._check_bearer_auth():
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.send_header("WWW-Authenticate", 'Bearer realm="mcp"')
                self.end_headers()
                self.wfile.write(b'{"error": "Unauthorized"}')
                return
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                tool_name = data.get("tool")
                args = data.get("args", {})

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

                if tool_name == "query_erp_sales":
                    bq_tool = get_bigquery_tool()
                    result = loop.run_until_complete(
                        bq_tool.execute_sales_query(
                            company_id=args.get("company_id", "COMP-001"),
                            fiscal_year=args.get("fiscal_year", "FY2026-27"),
                        )
                    )
                elif tool_name == "fetch_scada_telemetry":
                    ps_tool = get_pubsub_tool()
                    result = loop.run_until_complete(
                        ps_tool.fetch_telemetry_batch(
                            recycler_id=args.get("recycler_id", "RECYC-01"),
                            plant_id=args.get("plant_id", "PLANT-01"),
                        )
                    )
                elif tool_name == "verify_eway_bill":
                    result = loop.run_until_complete(
                        gst_tool.verify_bill(
                            eway_bill_number=args.get("eway_bill_number", "EWB-123"),
                        )
                    )
                elif tool_name == "verify_cto_capacity":
                    result = loop.run_until_complete(
                        cpcb_tool.verify_cto(
                            recycler_id=args.get("recycler_id", "RECYC-01"),
                            plant_id=args.get("plant_id", "PLANT-01"),
                        )
                    )
                else:
                    result = {"error": f"Unknown tool: {tool_name}"}

                loop.close()

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"result": result}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        """Suppress default HTTP request console spam."""
        pass


def run_server(port: int = DEFAULT_MCP_PORT) -> None:
    init_gcp_tools()
    server = HTTPServer(("0.0.0.0", port), MCPHTTPHandler)
    print(f"SynthetIQ MCP Server listening on port {port} (Zero-Trust Tool Gateway)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", str(DEFAULT_MCP_PORT)))
    run_server(port)
