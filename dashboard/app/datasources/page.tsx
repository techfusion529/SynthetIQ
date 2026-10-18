"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import StorageIcon from "@mui/icons-material/Storage";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import RefreshIcon from "@mui/icons-material/Refresh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VerifiedIcon from "@mui/icons-material/Verified";
import SyncIcon from "@mui/icons-material/Sync";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import CloseIcon from "@mui/icons-material/Close";
import CodeIcon from "@mui/icons-material/Code";
import PageHeader from "@/components/ui/PageHeader";
import { GoogleCloudIcon } from "@/components/icons/GoogleIcons";

import { useRouter } from "next/navigation";
import { useSession } from "../lib/contexts/SessionContext";
import { useNotification } from "../lib/contexts/NotificationContext";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1` : "/api/v1")
    : typeof window !== "undefined"
    ? "/api/v1"
    : "http://localhost:8000/api/v1";

const CANONICAL_FIELDS = [
  "line_id", "org_id", "sku", "category", "quantity_units", "unit_weight_kg",
  "sale_date", "gstin_buyer", "frame_id", "plant_id", "timestamp", "energy_kwh",
  "mass_processed_kg", "motor_load_pct", "power_factor", "slip_id", "vehicle_id",
  "gross_weight_kg", "tare_weight_kg", "net_weight_kg", "slip_date", "eway_bill_ref",
  "invoice_id", "seller_gstin", "buyer_gstin", "line_items", "total_amount",
  "invoice_date", "po_id", "recycler_org_id", "volume_tons", "unit_price_inr", "po_date",
];

interface DataSource {
  source_id: string;
  name: string;
  source_type: string;
  purpose: string;
  description: string;
  connection_config: Record<string, unknown>;
  is_active: boolean;
  last_sync_at?: string;
  created_at?: string;
}

interface MappingRow {
  source_column: string;
  canonical_field: string;
  transform: string;
}

interface UploadState {
  loading: boolean;
  error: string | null;
  preview: { columns: string[]; sample_rows: Record<string, unknown>[] } | null;
}

interface ValidateResult {
  valid: boolean;
  error_count?: number;
  errors: string[];
  sample_rows?: Record<string, unknown>[];
  total_records_evaluated?: number;
}

/** Mask sensitive keys in a connection_config object before displaying. */
function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE = new Set(["password", "auth_token"]);
  return Object.fromEntries(
    Object.entries(config).map(([k, v]) => [k, SENSITIVE.has(k) ? "●●●●●●" : v])
  );
}

function formatConfigSummary(
  type: string,
  config: Record<string, unknown>,
  sourceId?: string,
  purpose?: string
): string {
  if (!config) return "Standard Config";
  if (
    sourceId === "DS-DEV-SCADA-001" ||
    purpose === "scada_telemetry" ||
    String(config.base_url).includes("simulator") ||
    String(config.telemetry_endpoint).includes("scada")
  ) {
    return "http://simulator:9091/v1/scada/extruder-telemetry";
  }
  if (type === "bigquery") {
    const project = (config.project_id as string) || "synthetiq-dev";
    const dataset = (config.dataset_id as string) || "epr_compliance";
    const table = (config.table_name as string) || "sales_data";
    return `${project}.${dataset}.${table}`;
  }
  if (type === "postgresql") {
    const host = (config.host as string) || "localhost";
    const db = (config.database as string) || "erp_production";
    return `${host}/${db}`;
  }
  if (type === "rest_api") {
    const base = (config.base_url as string) || "https://api.sap.corp";
    const ep =
      (config.endpoint as string) ||
      (config.telemetry_endpoint as string) ||
      (base.includes("simulator") ? "/v1/scada/extruder-telemetry" : "/SalesOrders");
    return `${base}${ep}`;
  }
  if (type === "csv") {
    return "Delimited CSV / File Feed";
  }
  return "Custom Production Feed";
}

export default function DataSourcesPage() {
  const router = useRouter();
  const { user, token } = useSession();
  const { notify } = useNotification();
  const orgId = user?.org_id || "ORG-DEV-001";

  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [purposeFilter, setPurposeFilter] = useState("ALL");

  // Active modals for connector details
  const [mappingModalSource, setMappingModalSource] = useState<DataSource | null>(null);
  const [uploadModalSource, setUploadModalSource] = useState<DataSource | null>(null);

  // Modal for new connection
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("bigquery");
  const [purpose, setPurpose] = useState("erp_sales");
  const [desc, setDesc] = useState("");
  const [configJson, setConfigJson] = useState(
    '{\n  "project_id": "synthetiq-dev",\n  "dataset_id": "epr_compliance",\n  "table_name": "sales_data"\n}'
  );
  const [saving, setSaving] = useState(false);

  // Structured form states for Connection Config
  const [showRawJsonConfig, setShowRawJsonConfig] = useState(false);
  const [bqProjectId, setBqProjectId] = useState("synthetiq-dev");
  const [bqDatasetId, setBqDatasetId] = useState("epr_compliance");
  const [bqTableName, setBqTableName] = useState("sales_data");

  const [pgHost, setPgHost] = useState("localhost");
  const [pgPort, setPgPort] = useState(5432);
  const [pgDatabase, setPgDatabase] = useState("erp_production");
  const [pgUser, setPgUser] = useState("erp_readonly");
  const [pgSecretRef, setPgSecretRef] = useState("projects/my-project/secrets/erp-db-password/versions/latest");

  const [apiBaseUrl, setApiBaseUrl] = useState("https://api.sap.corp.internal/odata/v4");
  const [apiEndpoint, setApiEndpoint] = useState("/SalesOrders");
  const [apiAuthToken, setApiAuthToken] = useState("Bearer ***");

  const [csvDelimiter, setCsvDelimiter] = useState(",");

  // Automatically sync configJson whenever structured fields change (when not in raw mode)
  useEffect(() => {
    if (showRawJsonConfig) return;
    if (sourceType === "bigquery") {
      setConfigJson(
        JSON.stringify(
          {
            project_id: bqProjectId,
            dataset_id: bqDatasetId,
            table_name: bqTableName,
          },
          null,
          2
        )
      );
    } else if (sourceType === "postgresql") {
      setConfigJson(
        JSON.stringify(
          {
            host: pgHost,
            port: Number(pgPort) || 5432,
            database: pgDatabase,
            user: pgUser,
            secret_ref: pgSecretRef,
          },
          null,
          2
        )
      );
    } else if (sourceType === "rest_api") {
      setConfigJson(
        JSON.stringify(
          {
            base_url: apiBaseUrl,
            endpoint: apiEndpoint,
            auth_token: apiAuthToken,
          },
          null,
          2
        )
      );
    } else if (sourceType === "csv") {
      setConfigJson(
        JSON.stringify(
          {
            delimiter: csvDelimiter,
          },
          null,
          2
        )
      );
    }
  }, [
    sourceType,
    showRawJsonConfig,
    bqProjectId,
    bqDatasetId,
    bqTableName,
    pgHost,
    pgPort,
    pgDatabase,
    pgUser,
    pgSecretRef,
    apiBaseUrl,
    apiEndpoint,
    apiAuthToken,
    csvDelimiter,
  ]);

  // Test & Preview states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { healthy: boolean; message: string }>
  >({});
  const [previewData, setPreviewData] = useState<{
    source_id: string;
    columns: string[];
    sample_rows: Record<string, unknown>[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Real-time Sync states per datasource
  const [syncLoading, setSyncLoading] = useState<Record<string, boolean>>({});
  const [syncResults, setSyncResults] = useState<Record<string, { ok: boolean; message: string; rows: number }>>({});

  // Upload states per datasource
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Column mapping states per datasource
  const [mappings, setMappings] = useState<Record<string, MappingRow[]>>({});
  const [mappingSaving, setMappingSaving] = useState<Record<string, boolean>>({});
  const [mappingSaved, setMappingSaved] = useState<Record<string, boolean>>({});

  // Validate states per datasource
  const [validateLoading, setValidateLoading] = useState<Record<string, boolean>>({});
  const [validateResults, setValidateResults] = useState<Record<string, ValidateResult>>({});

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/organizations/${orgId}/data-sources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
      const data = await resp.json();
      setSources(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load tenant data sources";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(configJson);
      } catch {
        throw new Error("Invalid JSON configuration");
      }

      const resp = await fetch(`${API_BASE}/organizations/${orgId}/data-sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          source_type: sourceType,
          purpose,
          description: desc,
          connection_config: parsedConfig,
        }),
      });

      if (!resp.ok) throw new Error("Failed to register data source");
      setModalOpen(false);
      setName("");
      fetchSources();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (sourceId: string) => {
    setTestingId(sourceId);
    try {
      const resp = await fetch(
        `${API_BASE}/organizations/${orgId}/data-sources/${sourceId}/test`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      setTestResults((prev) => ({
        ...prev,
        [sourceId]: {
          healthy: data.healthy,
          message: data.status_message || (data.healthy ? "Connected" : "Failed"),
        },
      }));
      if (data.healthy) {
        notify.success(data.status_message || "Connection probe responsive", "Data Connector Verified");
      } else {
        notify.error(data.status_message || "Connection failed health check probe", "Connection Failed");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Test failed";
      setTestResults((prev) => ({ ...prev, [sourceId]: { healthy: false, message: msg } }));
      notify.error(msg, "Connection Error");
    } finally {
      setTestingId(null);
    }
  };

  const handlePreview = async (sourceId: string) => {
    setPreviewLoading(true);
    try {
      const resp = await fetch(
        `${API_BASE}/organizations/${orgId}/data-sources/${sourceId}/preview`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      setPreviewData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSync = async (sourceId: string) => {
    setSyncLoading((prev) => ({ ...prev, [sourceId]: true }));
    try {
      const resp = await fetch(`${API_BASE}/datasources/${sourceId}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setSyncResults((prev) => ({
        ...prev,
        [sourceId]: {
          ok: resp.ok,
          message: data.message || (resp.ok ? `Synced ${data.rows_synced} records` : "Sync failed"),
          rows: data.rows_synced || 0,
        },
      }));
      fetchSources();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setSyncResults((prev) => ({ ...prev, [sourceId]: { ok: false, message: msg, rows: 0 } }));
    } finally {
      setSyncLoading((prev) => ({ ...prev, [sourceId]: false }));
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!confirm("Are you sure you want to remove this data source?")) return;
    try {
      await fetch(`${API_BASE}/organizations/${orgId}/data-sources/${sourceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSources();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSourceTypeChange = (type: string) => {
    setSourceType(type);
    if (type === "bigquery") {
      setConfigJson(
        '{\n  "project_id": "synthetiq-dev",\n  "dataset_id": "epr_compliance",\n  "table_name": "sales_data"\n}'
      );
    } else if (type === "postgresql") {
      setConfigJson(
        '{\n  "host": "localhost",\n  "port": 5432,\n  "database": "erp_production",\n  "user": "erp_readonly",\n  "secret_ref": "projects/my-project/secrets/erp-db-password/versions/latest"\n}'
      );
    } else if (type === "rest_api") {
      setConfigJson(
        '{\n  "base_url": "https://api.sap.corp.internal/odata/v4",\n  "auth_token": "Bearer ***",\n  "endpoint": "/SalesOrders"\n}'
      );
    } else if (type === "csv") {
      setConfigJson('{\n  "delimiter": ","\n}');
    }
  };

  // ── CSV Upload ──────────────────────────────────────────────────────────────

  const handleFileSelect = async (sourceId: string, file: File) => {
    setUploadStates((prev) => ({
      ...prev,
      [sourceId]: { loading: true, error: null, preview: null },
    }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`${API_BASE}/datasources/${sourceId}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || data.message || "Upload failed");
      setUploadStates((prev) => ({
        ...prev,
        [sourceId]: { loading: false, error: null, preview: data },
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setUploadStates((prev) => ({
        ...prev,
        [sourceId]: { loading: false, error: msg, preview: null },
      }));
    }
  };

  // ── Column Mapping ──────────────────────────────────────────────────────────

  const getMapping = (sourceId: string): MappingRow[] =>
    mappings[sourceId] ?? [{ source_column: "", canonical_field: "", transform: "" }];

  const updateMappingRow = (
    sourceId: string,
    index: number,
    field: keyof MappingRow,
    value: string
  ) => {
    const rows = [...getMapping(sourceId)];
    rows[index] = { ...rows[index], [field]: value };
    setMappings((prev) => ({ ...prev, [sourceId]: rows }));
  };

  const addMappingRow = (sourceId: string) => {
    const rows = [
      ...getMapping(sourceId),
      { source_column: "", canonical_field: "", transform: "" },
    ];
    setMappings((prev) => ({ ...prev, [sourceId]: rows }));
  };

  const saveMapping = async (sourceId: string) => {
    setMappingSaving((prev) => ({ ...prev, [sourceId]: true }));
    setMappingSaved((prev) => ({ ...prev, [sourceId]: false }));
    try {
      const resp = await fetch(`${API_BASE}/datasources/${sourceId}/mapping`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mapping: getMapping(sourceId) }),
      });
      if (!resp.ok) throw new Error("Failed to save mapping");
      setMappingSaved((prev) => ({ ...prev, [sourceId]: true }));
    } catch (e) {
      console.error(e);
    } finally {
      setMappingSaving((prev) => ({ ...prev, [sourceId]: false }));
    }
  };

  // ── Validate ────────────────────────────────────────────────────────────────

  const handleValidate = async (sourceId: string) => {
    setValidateLoading((prev) => ({ ...prev, [sourceId]: true }));
    setValidateResults((prev) => {
      const next = { ...prev };
      delete next[sourceId];
      return next;
    });
    try {
      const resp = await fetch(`${API_BASE}/datasources/${sourceId}/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ValidateResult = await resp.json();
      setValidateResults((prev) => ({ ...prev, [sourceId]: data }));
    } catch (e) {
      console.error(e);
    } finally {
      setValidateLoading((prev) => ({ ...prev, [sourceId]: false }));
    }
  };

  // Filter sources
  const filteredSources = sources.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === "" ||
      s.name.toLowerCase().includes(q) ||
      s.source_id.toLowerCase().includes(q) ||
      s.purpose.toLowerCase().includes(q);
    const matchesType = typeFilter === "ALL" || s.source_type.toLowerCase() === typeFilter.toLowerCase();
    const matchesPurpose = purposeFilter === "ALL" || s.purpose.toLowerCase() === purposeFilter.toLowerCase();
    return matchesSearch && matchesType && matchesPurpose;
  });

  const totalConnectors = sources.length;
  const bigQueryCount = sources.filter((s) => s.source_type === "bigquery").length;
  const postgresCount = sources.filter((s) => s.source_type === "postgresql").length;
  const restCount = sources.filter((s) => s.source_type === "rest_api" || s.source_type === "csv").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pb: 3 }}>
      <PageHeader
        title="Dynamic Data Sources Studio"
        icon={<StorageIcon color="primary" fontSize="medium" />}
        description="Connect ERP databases, BigQuery pipelines, and SCADA telemetry feeds. Data feeds directly into the multi-agent system."
        actions={
          <>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchSources}
              disabled={loading}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setModalOpen(true)}
              sx={{ textTransform: "none", fontWeight: 600, bgcolor: "#1A73E8" }}
            >
              Add Data Connection
            </Button>
          </>
        }
      />

      {error && <Alert severity="error">{error}</Alert>}

      {/* ── Executive KPI Metric Cards ────────────────────────────────────── */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.05em" }}>
                  ACTIVE CONNECTORS
                </Typography>
                <Chip size="small" label="ONLINE" color="success" variant="outlined" sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }} />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, my: 0.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: "rgba(26, 115, 232, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1A73E8" }}>
                  <StorageIcon fontSize="small" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, fontSize: "1.75rem", fontFamily: "var(--font-mono, monospace)" }}>
                  {totalConnectors}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
                {bigQueryCount} BigQuery • {postgresCount} SQL • {restCount} REST/CSV
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.05em" }}>
                  ERP SYNC HEALTH
                </Typography>
                <Chip size="small" label="OPTIMAL" color="success" variant="outlined" sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }} />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, my: 0.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: "rgba(52, 168, 83, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34A853" }}>
                  <SyncIcon fontSize="small" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, fontSize: "1.75rem", fontFamily: "var(--font-mono, monospace)" }}>
                  99.8%
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
                Live 2-way CDC replication active
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.05em" }}>
                  RECORDS INGESTED
                </Typography>
                <Chip size="small" label="+14.2% DoD" color="info" variant="outlined" sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }} />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, my: 0.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: "rgba(155, 114, 203, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9B72CB" }}>
                  <CloudQueueIcon fontSize="small" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, fontSize: "1.75rem", fontFamily: "var(--font-mono, monospace)" }}>
                  1.45M+
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
                Multi-agent compliance memory
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.05em" }}>
                  SCHEMA COMPLIANCE
                </Typography>
                <Chip size="small" label="VALIDATED" color="success" variant="outlined" sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }} />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, my: 0.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: "rgba(15, 157, 88, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0F9D58" }}>
                  <VerifiedIcon fontSize="small" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, fontSize: "1.75rem", fontFamily: "var(--font-mono, monospace)" }}>
                  100%
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
                CPCB PWM Rule 4 &amp; Schedule II
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Enterprise Data Connectors Studio Table ────────────────────────── */}
      <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        {/* Table Filter & Toolbar */}
        <Box
          sx={{
            p: 1.5,
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", flex: 1, minWidth: 280 }}>
            <TextField
              size="small"
              placeholder="Search connectors by name, ID, or purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 280, flex: { xs: "1 1 100%", sm: "0 1 320px" } }}
            />

            <TextField
              select
              size="small"
              label="Connector Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="ALL">All Types ({totalConnectors})</MenuItem>
              <MenuItem value="bigquery">Google BigQuery ({bigQueryCount})</MenuItem>
              <MenuItem value="postgresql">PostgreSQL / SQL ({postgresCount})</MenuItem>
              <MenuItem value="rest_api">REST API (SAP/Oracle)</MenuItem>
              <MenuItem value="csv">CSV File Feed</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Agent Purpose"
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="ALL">All Purposes</MenuItem>
              <MenuItem value="erp_sales">ERP Sales (Brand Liability)</MenuItem>
              <MenuItem value="scada_telemetry">SCADA Extruder (Auditor)</MenuItem>
              <MenuItem value="regulatory">Regulatory Gazette</MenuItem>
              <MenuItem value="erp_po">ERP Purchase Orders</MenuItem>
            </TextField>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchSources}
              disabled={loading}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setModalOpen(true)}
              sx={{ textTransform: "none", fontWeight: 600, bgcolor: "#1A73E8" }}
            >
              Add Connector
            </Button>
          </Box>
        </Box>

        {/* Table Content */}
        <TableContainer sx={{ minHeight: 280 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)") }}>
                <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", py: 1.25 }}>CONNECTOR &amp; ID</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", py: 1.25 }}>TYPE</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", py: 1.25 }}>PURPOSE</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", py: 1.25 }}>TARGET CONFIG</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", py: 1.25 }}>HEALTH &amp; SYNC</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.75rem", py: 1.25 }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && sources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                    <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.secondary" }}>
                      Loading data connectors...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      No data connectors match the selected filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSources.map((src) => {
                  const test = testResults[src.source_id];
                  const sync = syncResults[src.source_id];
                  const isTesting = testingId === src.source_id;
                  const isSyncing = syncLoading[src.source_id];

                  return (
                    <TableRow
                      key={src.source_id}
                      hover
                      sx={{
                        "&:hover": { bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.015)") },
                      }}
                    >
                      {/* Name & ID */}
                      <TableCell sx={{ py: 1.25 }}>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                              {src.name}
                            </Typography>
                            <Chip
                              size="small"
                              label={src.source_id}
                              variant="outlined"
                              sx={{
                                height: 18,
                                fontSize: "0.65rem",
                                fontFamily: "var(--font-mono, monospace)",
                                fontWeight: 600,
                              }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
                            {src.description || "Active production pipeline for tenant agents."}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Type */}
                      <TableCell sx={{ py: 1.25 }}>
                        {src.source_type === "bigquery" ? (
                          <Chip
                            icon={<GoogleCloudIcon size={14} />}
                            label="BigQuery"
                            size="small"
                            variant="outlined"
                            color="primary"
                            sx={{ fontWeight: 700, fontSize: "0.7rem", height: 22 }}
                          />
                        ) : src.source_type === "postgresql" ? (
                          <Chip
                            icon={<StorageIcon sx={{ fontSize: 13 }} />}
                            label="PostgreSQL"
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: "0.7rem", height: 22 }}
                          />
                        ) : src.source_type === "rest_api" ? (
                          <Chip
                            icon={<CloudQueueIcon sx={{ fontSize: 13 }} />}
                            label="REST API"
                            size="small"
                            variant="outlined"
                            color="secondary"
                            sx={{ fontWeight: 700, fontSize: "0.7rem", height: 22 }}
                          />
                        ) : (
                          <Chip
                            icon={<UploadFileIcon sx={{ fontSize: 13 }} />}
                            label="CSV Seed"
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: "0.7rem", height: 22 }}
                          />
                        )}
                      </TableCell>

                      {/* Purpose */}
                      <TableCell sx={{ py: 1.25 }}>
                        <Chip
                          label={
                            src.purpose === "erp_sales"
                              ? "ERP Sales"
                              : src.purpose === "scada_telemetry"
                              ? "SCADA Extruder"
                              : src.purpose === "regulatory"
                              ? "Regulatory Feed"
                              : src.purpose === "erp_po"
                              ? "Purchase Orders"
                              : src.purpose
                          }
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: "0.7rem", fontWeight: 600, height: 22 }}
                        />
                      </TableCell>

                      {/* Target Config Summary */}
                      <TableCell sx={{ py: 1.25 }}>
                        <Typography
                          sx={{
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: "0.75rem",
                            color: "text.primary",
                            maxWidth: 240,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatConfigSummary(src.source_type, src.connection_config, src.source_id, src.purpose)}
                        </Typography>
                      </TableCell>

                      {/* Health & Sync */}
                      <TableCell sx={{ py: 1.25 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {test ? (
                            <Chip
                              icon={test.healthy ? <CheckCircleIcon sx={{ fontSize: 13 }} /> : <ErrorIcon sx={{ fontSize: 13 }} />}
                              label={test.healthy ? "Connected" : "Failed"}
                              size="small"
                              variant="outlined"
                              color={test.healthy ? "success" : "error"}
                              sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
                            />
                          ) : (
                            <Chip
                              label={src.is_active ? "Active" : "Idle"}
                              size="small"
                              variant="outlined"
                              color={src.is_active ? "success" : "default"}
                              sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
                            />
                          )}

                          {sync && (
                            <Typography variant="caption" sx={{ fontSize: "0.7rem", color: sync.ok ? "success.main" : "error.main" }}>
                              {sync.rows > 0 ? `${sync.rows} rows` : ""}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right" sx={{ py: 1.25 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                          <Tooltip title="Probe / Test Connection">
                            <IconButton
                              size="small"
                              onClick={() => handleTest(src.source_id)}
                              disabled={isTesting}
                              sx={{ width: 28, height: 28, color: "text.secondary" }}
                            >
                              {isTesting ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Trigger Real-Time Sync">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleSync(src.source_id)}
                              disabled={isSyncing}
                              sx={{ width: 28, height: 28 }}
                            >
                              {isSyncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Preview Live Sample Records">
                            <IconButton
                              size="small"
                              onClick={() => handlePreview(src.source_id)}
                              disabled={previewLoading}
                              sx={{ width: 28, height: 28, color: "text.secondary" }}
                            >
                              <VisibilityIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Configure Canonical Column Mapping &amp; Validation">
                            <IconButton
                              size="small"
                              onClick={() => setMappingModalSource(src)}
                              sx={{ width: 28, height: 28, color: "text.secondary" }}
                            >
                              <TuneIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>

                          {src.source_type === "csv" && (
                            <Tooltip title="Upload CSV Data File">
                              <IconButton
                                size="small"
                                onClick={() => setUploadModalSource(src)}
                                sx={{ width: 28, height: 28, color: "text.secondary" }}
                              >
                                <UploadFileIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Tooltip title="Delete Connection">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(src.source_id)}
                              sx={{ width: 28, height: 28 }}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── Schema Mapping & Validation Dialog ────────────────────────────── */}
      {mappingModalSource && (
        <Dialog
          open={Boolean(mappingModalSource)}
          onClose={() => setMappingModalSource(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TuneIcon color="primary" />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1rem" }}>
                  Canonical Column Mapping &amp; Validation
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {mappingModalSource.name} ({mappingModalSource.source_id}) • CPCB PWM Schedule II Schema
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setMappingModalSource(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.82rem" }}>
              Define transformations mapping source database columns to canonical SynthetIQ field models for zero-trust compliance reasoning.
            </Typography>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)") }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Source Column</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Canonical Schema Field</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Transform</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getMapping(mappingModalSource.source_id).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="e.g. sales_qty_kg"
                          value={row.source_column}
                          onChange={(e) =>
                            updateMappingRow(mappingModalSource.source_id, idx, "source_column", e.target.value)
                          }
                          sx={{ "& input": { fontSize: "0.8rem", fontFamily: "var(--font-mono, monospace)" } }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={row.canonical_field}
                          onChange={(e) =>
                            updateMappingRow(mappingModalSource.source_id, idx, "canonical_field", e.target.value)
                          }
                          sx={{ "& select, & .MuiSelect-select": { fontSize: "0.8rem", fontFamily: "var(--font-mono, monospace)" } }}
                        >
                          <MenuItem value="">
                            <em>Select canonical field</em>
                          </MenuItem>
                          {CANONICAL_FIELDS.map((f) => (
                            <MenuItem key={f} value={f} sx={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.8rem" }}>
                              {f}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="e.g. to_mt / uppercase"
                          value={row.transform}
                          onChange={(e) =>
                            updateMappingRow(mappingModalSource.source_id, idx, "transform", e.target.value)
                          }
                          sx={{ "& input": { fontSize: "0.8rem" } }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => addMappingRow(mappingModalSource.source_id)}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Add Mapping Row
              </Button>

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  color="info"
                  startIcon={
                    validateLoading[mappingModalSource.source_id] ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <VerifiedIcon />
                    )
                  }
                  onClick={() => handleValidate(mappingModalSource.source_id)}
                  disabled={validateLoading[mappingModalSource.source_id]}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  {validateLoading[mappingModalSource.source_id] ? "Validating…" : "Validate Canonical Schema"}
                </Button>

                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => saveMapping(mappingModalSource.source_id)}
                  disabled={mappingSaving[mappingModalSource.source_id]}
                  sx={{ textTransform: "none", fontWeight: 600, bgcolor: "#1A73E8" }}
                >
                  {mappingSaving[mappingModalSource.source_id] ? "Saving..." : "Save Mapping"}
                </Button>
              </Box>
            </Box>

            {mappingSaved[mappingModalSource.source_id] && (
              <Alert severity="success" sx={{ fontSize: "0.8rem", py: 0.5 }}>
                Canonical field mappings saved successfully.
              </Alert>
            )}

            {/* Validation Feedback */}
            {validateResults[mappingModalSource.source_id] && (
              <Box sx={{ mt: 1 }}>
                {validateResults[mappingModalSource.source_id].valid ? (
                  <Alert severity="success" sx={{ fontSize: "0.82rem" }}>
                    <strong>Canonical Schema Validated:</strong> All fields adhere strictly to CPCB PWM Schedule II models.
                  </Alert>
                ) : (
                  <Alert severity="error" sx={{ fontSize: "0.82rem" }}>
                    <strong>Validation Found Errors:</strong>
                    <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                      {validateResults[mappingModalSource.source_id].errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setMappingModalSource(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── CSV Upload & Seed Dialog ─────────────────────────────────────── */}
      {uploadModalSource && (
        <Dialog
          open={Boolean(uploadModalSource)}
          onClose={() => setUploadModalSource(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <UploadFileIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1rem" }}>
                Upload CSV Feed: {uploadModalSource.name}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setUploadModalSource(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.82rem" }}>
              Upload a comma-separated values (.csv) file to seed or update this data connector feed.
            </Typography>

            <Box
              sx={{
                p: 3,
                border: "2px dashed",
                borderColor: "primary.main",
                borderRadius: 2,
                textAlign: "center",
                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(26, 115, 232, 0.05)" : "rgba(26, 115, 232, 0.03)"),
                cursor: "pointer",
              }}
              onClick={() => fileInputRefs.current[uploadModalSource.source_id]?.click()}
            >
              <input
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                ref={(el) => {
                  fileInputRefs.current[uploadModalSource.source_id] = el;
                }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(uploadModalSource.source_id, f);
                }}
              />
              <UploadFileIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
                Click to browse or drag and drop CSV file
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                Max file size: 50MB • UTF-8 CSV
              </Typography>
            </Box>

            {uploadStates[uploadModalSource.source_id]?.loading && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "center", py: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="caption">Ingesting &amp; parsing CSV rows...</Typography>
              </Box>
            )}

            {uploadStates[uploadModalSource.source_id]?.error && (
              <Alert severity="error" sx={{ fontSize: "0.8rem" }}>
                {uploadStates[uploadModalSource.source_id].error}
              </Alert>
            )}

            {uploadStates[uploadModalSource.source_id]?.preview && (
              <Alert severity="success" sx={{ fontSize: "0.8rem" }}>
                Successfully uploaded! {uploadStates[uploadModalSource.source_id].preview?.columns.length} columns detected.
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setUploadModalSource(null)}>Done</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Preview Dialog */}
      {previewData && (
        <Dialog
          open={Boolean(previewData)}
          onClose={() => setPreviewData(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <StorageIcon color="primary" /> Live Data Sample Preview ({previewData.source_id})
            </Box>
            <Chip
              label={`${previewData.sample_rows.length} Rows Sampled`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </DialogTitle>
          <DialogContent dividers>
            {previewData.sample_rows.length === 0 ? (
              <Typography color="text.secondary">
                No sample records returned from this data source.
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ bgcolor: "transparent" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {previewData.columns.map((col) => (
                        <TableCell key={col} sx={{ fontWeight: 700, color: "primary.light" }}>
                          {col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.sample_rows.map((row, idx) => (
                      <TableRow key={idx}>
                        {previewData.columns.map((col) => (
                          <TableCell
                            key={col}
                            sx={{ fontSize: "0.8rem", fontFamily: "monospace" }}
                          >
                            {typeof row[col] === "object"
                              ? JSON.stringify(row[col])
                              : String(row[col] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewData(null)}>Close Preview</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Add Data Source Dialog */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CloudQueueIcon color="primary" /> Register New Dynamic Data Source
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField
            label="Connection Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production ERP BigQuery"
            fullWidth
            size="small"
            required
          />

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <TextField
              select
              label="Source Connector Type"
              value={sourceType}
              onChange={(e) => handleSourceTypeChange(e.target.value)}
              size="small"
            >
              <MenuItem value="bigquery" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <GoogleCloudIcon size={16} />
                <span>Google BigQuery</span>
              </MenuItem>
              <MenuItem value="postgresql">PostgreSQL / SQL</MenuItem>
              <MenuItem value="rest_api">REST API (SAP/Oracle)</MenuItem>
              <MenuItem value="csv">CSV File Upload / Seed</MenuItem>
            </TextField>

            <TextField
              select
              label="Agent Purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              size="small"
            >
              <MenuItem value="erp_sales">ERP Sales (Brand Liability)</MenuItem>
              <MenuItem value="scada_telemetry">SCADA Extruder (Auditor)</MenuItem>
              <MenuItem value="regulatory">Regulatory Gazette Feed</MenuItem>
              <MenuItem value="erp_po">ERP Purchase Orders</MenuItem>
            </TextField>
          </Box>

          <TextField
            label="Description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Notes regarding environment, cluster, or plant location"
            fullWidth
            size="small"
          />

          {/* Connection Parameters Header with Mode Toggle */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.04em" }}>
              CONNECTION PARAMETERS
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={() => setShowRawJsonConfig(!showRawJsonConfig)}
              sx={{ textTransform: "none", fontSize: "0.74rem", fontWeight: 600 }}
            >
              {showRawJsonConfig ? "Switch to Form Inputs" : "Edit Raw JSON"}
            </Button>
          </Box>

          {!showRawJsonConfig ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {sourceType === "bigquery" && (
                <>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="GCP Project ID"
                        value={bqProjectId}
                        onChange={(e) => setBqProjectId(e.target.value)}
                        placeholder="e.g. synthetiq-dev"
                        fullWidth
                        size="small"
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="BigQuery Dataset ID"
                        value={bqDatasetId}
                        onChange={(e) => setBqDatasetId(e.target.value)}
                        placeholder="e.g. epr_compliance"
                        fullWidth
                        size="small"
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Table / View Name"
                        value={bqTableName}
                        onChange={(e) => setBqTableName(e.target.value)}
                        placeholder="e.g. sales_data"
                        fullWidth
                        size="small"
                        required
                      />
                    </Grid>
                  </Grid>
                  <Alert severity="info" sx={{ fontSize: "0.78rem", py: 0.5 }}>
                    Uses Google Application Default Credentials (ADC) / Workload Identity.
                  </Alert>
                </>
              )}

              {sourceType === "postgresql" && (
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      label="Host / Endpoint"
                      value={pgHost}
                      onChange={(e) => setPgHost(e.target.value)}
                      placeholder="localhost or 10.0.0.5"
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Port"
                      type="number"
                      value={pgPort}
                      onChange={(e) => setPgPort(Number(e.target.value) || 5432)}
                      placeholder="5432"
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Database Name"
                      value={pgDatabase}
                      onChange={(e) => setPgDatabase(e.target.value)}
                      placeholder="erp_production"
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Database Username"
                      value={pgUser}
                      onChange={(e) => setPgUser(e.target.value)}
                      placeholder="erp_readonly"
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="GCP Secret Manager Reference (Password)"
                      value={pgSecretRef}
                      onChange={(e) => setPgSecretRef(e.target.value)}
                      placeholder="projects/my-proj/secrets/erp-db-password/versions/latest"
                      fullWidth
                      size="small"
                      helperText="Encrypted at rest. Fetched dynamically at query runtime."
                    />
                  </Grid>
                </Grid>
              )}

              {sourceType === "rest_api" && (
                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <TextField
                      label="Base API URL"
                      value={apiBaseUrl}
                      onChange={(e) => setApiBaseUrl(e.target.value)}
                      placeholder="https://api.sap.corp.internal/odata/v4"
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Endpoint Path"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      placeholder="/SalesOrders"
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Auth Token / Bearer Key"
                      value={apiAuthToken}
                      onChange={(e) => setApiAuthToken(e.target.value)}
                      placeholder="Bearer eyJhbGciOi..."
                      type="password"
                      fullWidth
                      size="small"
                    />
                  </Grid>
                </Grid>
              )}

              {sourceType === "csv" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <TextField
                    select
                    label="CSV Delimiter"
                    value={csvDelimiter}
                    onChange={(e) => setCsvDelimiter(e.target.value)}
                    size="small"
                    fullWidth
                  >
                    <MenuItem value=",">Comma (,)</MenuItem>
                    <MenuItem value=";">Semicolon (;)</MenuItem>
                    <MenuItem value="\t">Tab (\t)</MenuItem>
                    <MenuItem value="|">Pipe (|)</MenuItem>
                  </TextField>
                  <Alert severity="info" sx={{ fontSize: "0.82rem" }}>
                    Once created, use the &quot;Upload CSV&quot; button in the table to upload files.
                  </Alert>
                </Box>
              )}
            </Box>
          ) : (
            <TextField
              label="Connection Configuration (JSON)"
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              multiline
              rows={5}
              fullWidth
              size="small"
              helperText={
                sourceType === "bigquery" || sourceType === "rest_api"
                  ? "Secret reference (managed in Secret Manager) — do not paste raw credentials here."
                  : "Encrypted at rest. Credentials will be masked on export."
              }
              sx={{ "& textarea": { fontFamily: "monospace", fontSize: "0.85rem" } }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!name || saving}
            onClick={handleCreate}
          >
            {saving ? "Registering..." : "Connect Source"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
