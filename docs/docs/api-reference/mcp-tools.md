---
id: mcp-tools
title: MCP Tool Execution Gateway
sidebar_position: 2
---

# Model Context Protocol (MCP) Tools

SynthetIQ agents interact with external infrastructure through a secure Model Context Protocol gateway running on port `8001`.

## Available MCP Tools

1. **`query_bigquery_sales`**: Queries enterprise ERP sales databases and calculates category-wise polymer usage.
2. **`fetch_scada_telemetry`**: Retrieves high-frequency motor torque and electrical energy timeseries.
3. **`scrub_pii_entities`**: Offline PII sanitization via local Ollama Gemma 2B model.
4. **`verify_gst_invoice`**: Matches GSTN e-Invoice hash against official tax database.
5. **`generate_cpcb_form1`**: Compiles verification results into statutory CPCB compliance dossiers.
