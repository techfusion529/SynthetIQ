"""SynthetIQ SCADA & Industrial Telemetry Simulator daemon."""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from src.constants import SIMULATOR_PORT
from src.generators import erp_generator, eway_generator, scada_generator


class SimulatorHTTPHandler(BaseHTTPRequestHandler):
    """HTTP handler for simulator health checks and telemetry queries."""

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "service": "synthetiq-simulator"}).encode("utf-8"))
        elif self.path.startswith("/telemetry/genuine"):
            reading = scada_generator.generate_reading(mode="GENUINE")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(reading).encode("utf-8"))
        elif self.path.startswith("/telemetry/spoofed"):
            reading = scada_generator.generate_reading(mode="RESISTIVE_SPOOF")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(reading).encode("utf-8"))
        elif self.path.startswith("/erp/sales"):
            sales = erp_generator.generate_sales_batch()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(sales).encode("utf-8"))
        elif self.path.startswith("/eway/bill"):
            bill = eway_generator.generate_bill()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(bill).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        pass


def run_simulator(port: int = SIMULATOR_PORT) -> None:
    server = HTTPServer(("0.0.0.0", port), SimulatorHTTPHandler)
    print(f"SynthetIQ SCADA Simulator running on port {port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    port = int(os.getenv("SIMULATOR_PORT", str(SIMULATOR_PORT)))
    run_simulator(port)
