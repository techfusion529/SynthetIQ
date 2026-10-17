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
        elif self.path == "/metrics":
            # Prometheus scrape endpoint for SCADA simulator metrics
            reading = scada_generator.generate_reading(mode="GENUINE")
            torque = reading.get("torque_nm", 45.2)
            pf = reading.get("power_factor", 0.86)
            kw = reading.get("active_power_kw", 94.0)
            metrics_payload = (
                f"# HELP synthetiq_scada_stream_throughput_readings_per_sec Telemetry streaming rate\n"
                f"# TYPE synthetiq_scada_stream_throughput_readings_per_sec gauge\n"
                f"synthetiq_scada_stream_throughput_readings_per_sec 50.0\n"
                f"# HELP synthetiq_scada_torque_nm Real-time VFD shaft torque\n"
                f"# TYPE synthetiq_scada_torque_nm gauge\n"
                f'synthetiq_scada_torque_nm{{plant_id="PLANT-OKHLA-2"}} {torque}\n'
                f"# HELP synthetiq_scada_power_factor Motor power factor\n"
                f"# TYPE synthetiq_scada_power_factor gauge\n"
                f'synthetiq_scada_power_factor{{plant_id="PLANT-OKHLA-2"}} {pf}\n'
                f"# HELP synthetiq_scada_energy_expected_kwh Physics expected energy\n"
                f"# TYPE synthetiq_scada_energy_expected_kwh gauge\n"
                f"synthetiq_scada_energy_expected_kwh {round(kw * 0.95, 2)}\n"
                f"# HELP synthetiq_scada_energy_metered_kwh Metered energy\n"
                f"# TYPE synthetiq_scada_energy_metered_kwh gauge\n"
                f"synthetiq_scada_energy_metered_kwh {kw}\n"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
            self.send_header("Content-Length", str(len(metrics_payload)))
            self.end_headers()
            self.wfile.write(metrics_payload)
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
    # Start BigQuery real-time streaming pusher daemon
    try:
        from src.services.bigquery_pusher import bigquery_pusher
        bigquery_pusher.start()
        print("[Simulator] BigQuery real-time streaming worker started.")
    except Exception as exc:
        print(f"[Simulator] Warning: BigQuery streaming worker could not start: {exc}")

    server = HTTPServer(("0.0.0.0", port), SimulatorHTTPHandler)
    print(f"SynthetIQ SCADA Simulator running on port {port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
        try:
            bigquery_pusher.stop()
        except Exception:
            pass


if __name__ == "__main__":
    port = int(os.getenv("SIMULATOR_PORT", str(SIMULATOR_PORT)))
    run_simulator(port)
