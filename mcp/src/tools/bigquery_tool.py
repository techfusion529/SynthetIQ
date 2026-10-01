"""MCP BigQuery tool for real ERP sales queries with authentication."""

from __future__ import annotations

import logging
from typing import Any

from google.cloud import bigquery
from google.oauth2 import service_account

logger = logging.getLogger(__name__)


class BigQueryERPTool:
    """Real BigQuery integration for ERP sales data queries."""

    def __init__(
        self,
        project_id: str,
        dataset_id: str = "epr_compliance",
        sales_table: str = "sales_data",
        credentials_path: str | None = None,
    ) -> None:
        """Initialize BigQuery client.

        Args:
            project_id: GCP project ID
            dataset_id: BigQuery dataset name
            sales_table: Sales data table name
            credentials_path: Path to service account JSON
        """
        self.project_id = project_id
        self.dataset_id = dataset_id
        self.sales_table = sales_table

        # Initialize BigQuery client
        if credentials_path:
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path
            )
            self.client = bigquery.Client(
                project=project_id,
                credentials=credentials,
            )
        else:
            # Use default credentials (ADC)
            self.client = bigquery.Client(project=project_id)

        logger.info(f"Initialized BigQuery client for project: {project_id}")

    async def execute_sales_query(
        self,
        company_id: str,
        fiscal_year: str,
    ) -> list[dict[str, Any]]:
        """Query ERP sales data from BigQuery.

        Args:
            company_id: Company identifier
            fiscal_year: Fiscal year (e.g., "FY2026-27")

        Returns:
            List of sales records with plastic content
        """
        logger.info(f"Querying sales data for {company_id}, {fiscal_year}")

        query = f"""
        SELECT
            record_id,
            company_id,
            fiscal_year,
            product_sku,
            plastic_category,
            plastic_weight_kg,
            units_sold,
            state_code,
            invoice_date
        FROM `{self.project_id}.{self.dataset_id}.{self.sales_table}`
        WHERE company_id = @company_id
          AND fiscal_year = @fiscal_year
        ORDER BY invoice_date DESC
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("company_id", "STRING", company_id),
                bigquery.ScalarQueryParameter("fiscal_year", "STRING", fiscal_year),
            ]
        )

        try:
            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()

            records = []
            for row in results:
                records.append({
                    "record_id": row.record_id,
                    "company_id": row.company_id,
                    "fiscal_year": row.fiscal_year,
                    "product_sku": row.product_sku,
                    "plastic_category": row.plastic_category,
                    "plastic_weight_kg": float(row.plastic_weight_kg),
                    "units_sold": int(row.units_sold),
                    "state_code": row.state_code,
                })

            logger.info(f"Retrieved {len(records)} sales records")
            return records

        except Exception as e:
            logger.error(f"BigQuery query failed: {e}")
            raise


bigquery_erp_tool: BigQueryERPTool | None = None


def initialize_bigquery_tool(
    project_id: str,
    dataset_id: str = "epr_compliance",
    sales_table: str = "sales_data",
    credentials_path: str | None = None,
) -> BigQueryERPTool:
    """Initialize global BigQuery tool.

    Args:
        project_id: GCP project ID
        dataset_id: Dataset name
        sales_table: Table name
        credentials_path: Service account JSON path

    Returns:
        Initialized BigQueryERPTool
    """
    global bigquery_erp_tool
    bigquery_erp_tool = BigQueryERPTool(
        project_id, dataset_id, sales_table, credentials_path
    )
    return bigquery_erp_tool


def get_bigquery_tool() -> BigQueryERPTool:
    """Get global BigQuery tool instance.

    Raises:
        RuntimeError: If tool not initialized
    """
    if bigquery_erp_tool is None:
        raise RuntimeError("BigQueryERPTool not initialized")
    return bigquery_erp_tool
