"""Google Pub/Sub tool for real-time SCADA telemetry streaming."""

from __future__ import annotations

import json
import logging
from typing import Any

from google.cloud import pubsub_v1
from google.oauth2 import service_account

logger = logging.getLogger(__name__)


class PubSubSCADATool:
    """Real Pub/Sub integration for SCADA telemetry streams."""

    def __init__(
        self,
        project_id: str,
        subscription_name: str,
        credentials_path: str | None = None,
    ) -> None:
        """Initialize Pub/Sub subscriber.

        Args:
            project_id: GCP project ID
            subscription_name: Subscription name for SCADA topic
            credentials_path: Path to service account JSON
        """
        self.project_id = project_id
        self.subscription_name = subscription_name

        # Initialize Pub/Sub client
        if credentials_path:
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path
            )
            self.subscriber = pubsub_v1.SubscriberClient(credentials=credentials)
        else:
            self.subscriber = pubsub_v1.SubscriberClient()

        self.subscription_path = self.subscriber.subscription_path(
            project_id, subscription_name
        )

        logger.info(f"Initialized Pub/Sub subscriber for: {self.subscription_path}")

    async def fetch_telemetry_batch(
        self,
        recycler_id: str,
        plant_id: str,
        max_messages: int = 100,
    ) -> list[dict[str, Any]]:
        """Fetch SCADA telemetry data from Pub/Sub.

        Args:
            recycler_id: Recycler identifier to filter messages
            plant_id: Plant identifier
            max_messages: Maximum messages to pull

        Returns:
            List of telemetry records
        """
        logger.info(f"Fetching telemetry for {recycler_id}/{plant_id}")

        try:
            # Pull messages from subscription
            response = self.subscriber.pull(
                request={
                    "subscription": self.subscription_path,
                    "max_messages": max_messages,
                }
            )

            telemetry_records = []
            ack_ids = []

            for received_message in response.received_messages:
                try:
                    # Parse message data
                    data = json.loads(received_message.message.data.decode("utf-8"))

                    # Filter by recycler and plant
                    if (data.get("recycler_id") == recycler_id and
                        data.get("plant_id") == plant_id):

                        telemetry_records.append({
                            "recycler_id": data.get("recycler_id"),
                            "plant_id": data.get("plant_id"),
                            "timestamp": data.get("timestamp"),
                            "torque_nm": float(data.get("torque_nm", 0)),
                            "power_factor": float(data.get("power_factor", 0)),
                            "active_power_kw": float(data.get("active_power_kw", 0)),
                            "vfd_frequency_hz": float(data.get("vfd_frequency_hz", 50)),
                            "melt_rate_kg_h": float(data.get("melt_rate_kg_h", 0)),
                            "temperature_c": float(data.get("temperature_c", 0)),
                        })

                    ack_ids.append(received_message.ack_id)

                except Exception as e:
                    logger.warning(f"Failed to parse message: {e}")
                    continue

            # Acknowledge processed messages
            if ack_ids:
                self.subscriber.acknowledge(
                    request={
                        "subscription": self.subscription_path,
                        "ack_ids": ack_ids,
                    }
                )

            logger.info(f"Fetched {len(telemetry_records)} telemetry records")
            return telemetry_records

        except Exception as e:
            logger.error(f"Pub/Sub pull failed: {e}")
            raise


pubsub_scada_tool: PubSubSCADATool | None = None


def initialize_pubsub_tool(
    project_id: str,
    subscription_name: str,
    credentials_path: str | None = None,
) -> PubSubSCADATool:
    """Initialize global Pub/Sub tool.

    Args:
        project_id: GCP project ID
        subscription_name: Subscription name
        credentials_path: Service account JSON path

    Returns:
        Initialized PubSubSCADATool
    """
    global pubsub_scada_tool
    pubsub_scada_tool = PubSubSCADATool(
        project_id, subscription_name, credentials_path
    )
    return pubsub_scada_tool


def get_pubsub_tool() -> PubSubSCADATool:
    """Get global Pub/Sub tool instance.

    Raises:
        RuntimeError: If tool not initialized
    """
    if pubsub_scada_tool is None:
        raise RuntimeError("PubSubSCADATool not initialized")
    return pubsub_scada_tool
