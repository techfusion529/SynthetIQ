"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
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
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";

import StorageIcon from "@mui/icons-material/Storage";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VerifiedIcon from "@mui/icons-material/Verified";
import SyncIcon from "@mui/icons-material/Sync";
import PageHeader from "@/components/ui/PageHeader";

import { useRouter } from "next/navigation";
import { useSession } from "../lib/contexts/SessionContext";

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
  error_count: number;
  errors: string[];
}

/** Mask sensitive keys in a connection_config object before displaying. */
function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE = new Set(["password", "auth_token"]);
  return Object.fromEntries(
    Object.entries(config).map(([k, v]) => [k, SENSITIVE.has(k) ? "●●●●●●" : v])
  );
}

export default function DataSourcesPage() {
  const router = useRouter();
  const { user, token } = useSession();
  const orgId = user?.org_id || "ORG-DEV-001";

  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Test failed";
      setTestResults((prev) => ({ ...prev, [sourceId]: { healthy: false, message: msg } }));
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
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
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setModalOpen(true)}
            >
              Add Data Connection
            </Button>
          </>
        }
      />

      {error && <Alert severity="error">{error}</Alert>}

      {/* Sources Grid */}
      <Box
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5 }}
      >
        {sources.map((src) => {
          const test = testResults[src.source_id];
          const uploadState = uploadStates[src.source_id];
          const validateResult = validateResults[src.source_id];
          const maskedConfig = maskConfig(src.connection_config);

          return (
            <Card
              key={src.source_id}
              variant="outlined"
              sx={{
                bgcolor: "rgba(255, 255, 255, 0.02)",
                borderColor: "rgba(255, 255, 255, 0.08)",
                borderRadius: 2.5,
              }}
            >
              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {/* Header */}
                <Box
                  sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {src.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                      {src.source_id}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                      label={src.source_type.toUpperCase()}
                      size="small"
                      color={src.source_type === "bigquery" ? "primary" : "secondary"}
                      variant="outlined"
                    />
                    <Chip label={src.purpose} size="small" variant="filled" />
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                  {src.description || "Active production data connection for tenant agents."}
                </Typography>

                {/* Masked config preview */}
                {Object.keys(maskedConfig).length > 0 && (
                  <Box
                    sx={{
                      bgcolor: "rgba(0,0,0,0.2)",
                      borderRadius: 1,
                      p: 1,
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      color: "text.secondary",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {JSON.stringify(maskedConfig, null, 2)}
                  </Box>
                )}

                {/* Test Result Banner */}
                {test && (
                  <Alert
                    severity={test.healthy ? "success" : "error"}
                    icon={test.healthy ? <CheckCircleIcon /> : <ErrorIcon />}
                    sx={{ py: 0.5, px: 1.5, fontSize: "0.8rem" }}
                  >
                    {test.message}
                  </Alert>
                )}

                {/* Real-time Sync Result Banner */}
                {syncResults[src.source_id] && (
                  <Alert
                    severity={syncResults[src.source_id].ok ? "success" : "warning"}
                    icon={<SyncIcon />}
                    sx={{ py: 0.5, px: 1.5, fontSize: "0.8rem" }}
                  >
                    {syncResults[src.source_id].message}
                  </Alert>
                )}

                {/* ── CSV Upload Section ── */}
                {src.source_type === "csv" && (
                  <Box
                    sx={{
                      border: "1px dashed",
                      borderColor: "divider",
                      borderRadius: "2px",
                      p: 1.5,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      CSV FILE UPLOAD
                    </Typography>
                    <input
                      type="file"
                      accept=".csv"
                      style={{ display: "none" }}
                      ref={(el) => {
                        fileInputRefs.current[src.source_id] = el;
                      }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(src.source_id, file);
                        // Reset so the same file can be re-uploaded
                        e.target.value = "";
                      }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={
                        uploadState?.loading ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <UploadFileIcon />
                        )
                      }
                      disabled={uploadState?.loading}
                      onClick={() => fileInputRefs.current[src.source_id]?.click()}
                      sx={{ textTransform: "none", alignSelf: "flex-start" }}
                    >
                      {uploadState?.loading ? "Uploading…" : "Choose & Upload CSV"}
                    </Button>

                    {uploadState?.error && (
                      <Alert severity="error" sx={{ py: 0.5, fontSize: "0.8rem" }}>
                        {uploadState.error}
                      </Alert>
                    )}

                    {uploadState?.preview && uploadState.preview.sample_rows.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mb: 0.5 }}
                        >
                          Preview (first {Math.min(5, uploadState.preview.sample_rows.length)}{" "}
                          rows)
                        </Typography>
                        <TableContainer
                          component={Paper}
                          sx={{ bgcolor: "transparent", maxHeight: 180 }}
                        >
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                {uploadState.preview.columns.map((col) => (
                                  <TableCell
                                    key={col}
                                    sx={{ fontWeight: 700, color: "primary.light", fontSize: "0.75rem" }}
                                  >
                                    {col}
                                  </TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {uploadState.preview.sample_rows.slice(0, 5).map((row, idx) => (
                                <TableRow key={idx}>
                                  {uploadState.preview!.columns.map((col) => (
                                    <TableCell
                                      key={col}
                                      sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}
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
                      </Box>
                    )}
                  </Box>
                )}

                {/* ── Column Mapping Section ── */}
                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{
                    bgcolor: "transparent",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "2px !important",
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      COLUMN MAPPING
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "primary.light" }}>
                              Source Column
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "primary.light" }}>
                              Canonical Field
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "primary.light" }}>
                              Transform
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {getMapping(src.source_id).map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ py: 0.5, pr: 0.5 }}>
                                <TextField
                                  size="small"
                                  value={row.source_column}
                                  onChange={(e) =>
                                    updateMappingRow(
                                      src.source_id,
                                      idx,
                                      "source_column",
                                      e.target.value
                                    )
                                  }
                                  placeholder="e.g. SKU_CODE"
                                  sx={{ minWidth: 100 }}
                                  inputProps={{ style: { fontSize: "0.8rem" } }}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 0.5, pr: 0.5 }}>
                                <TextField
                                  select
                                  size="small"
                                  value={row.canonical_field}
                                  onChange={(e) =>
                                    updateMappingRow(
                                      src.source_id,
                                      idx,
                                      "canonical_field",
                                      e.target.value
                                    )
                                  }
                                  sx={{ minWidth: 140 }}
                                  inputProps={{ style: { fontSize: "0.8rem" } }}
                                >
                                  <MenuItem value="">
                                    <em>— select —</em>
                                  </MenuItem>
                                  {CANONICAL_FIELDS.map((f) => (
                                    <MenuItem key={f} value={f}>
                                      {f}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              </TableCell>
                              <TableCell sx={{ py: 0.5 }}>
                                <TextField
                                  size="small"
                                  value={row.transform}
                                  onChange={(e) =>
                                    updateMappingRow(
                                      src.source_id,
                                      idx,
                                      "transform",
                                      e.target.value
                                    )
                                  }
                                  placeholder="e.g. lowercase()"
                                  sx={{ minWidth: 120 }}
                                  inputProps={{ style: { fontSize: "0.8rem" } }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => addMappingRow(src.source_id)}
                        sx={{ textTransform: "none", fontSize: "0.78rem" }}
                      >
                        + Add Row
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        disabled={mappingSaving[src.source_id]}
                        onClick={() => saveMapping(src.source_id)}
                        sx={{
                          textTransform: "none",
                          fontSize: "0.78rem",
                        }}
                      >
                        {mappingSaving[src.source_id] ? "Saving…" : "Save Mapping"}
                      </Button>
                      {mappingSaved[src.source_id] && (
                        <Typography
                          variant="caption"
                          color="success.main"
                          sx={{ alignSelf: "center" }}
                        >
                          Saved ✓
                        </Typography>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>

                {/* ── Validate Section ── */}
                {validateResult && (
                  <Alert
                    severity={validateResult.valid ? "success" : "warning"}
                    icon={<VerifiedIcon />}
                    sx={{ py: 0.5, px: 1.5, fontSize: "0.8rem" }}
                  >
                    {validateResult.valid
                      ? `Validation passed — ${validateResult.error_count} errors found.`
                      : `Validation issues — ${validateResult.error_count} error(s) found.`}
                    {validateResult.errors.length > 0 && (
                      <Box component="ul" sx={{ m: 0, pl: 2, mt: 0.5 }}>
                        {validateResult.errors.slice(0, 3).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </Box>
                    )}
                  </Alert>
                )}

                {/* Actions */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    pt: 1,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={
                        testingId === src.source_id ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <PlayArrowIcon />
                        )
                      }
                      onClick={() => handleTest(src.source_id)}
                      disabled={testingId === src.source_id}
                      sx={{ textTransform: "none" }}
                    >
                      {testingId === src.source_id ? "Testing..." : "Test Connection"}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handlePreview(src.source_id)}
                      disabled={previewLoading}
                      sx={{ textTransform: "none" }}
                    >
                      Preview Data
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="info"
                      startIcon={
                        validateLoading[src.source_id] ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <VerifiedIcon />
                        )
                      }
                      onClick={() => handleValidate(src.source_id)}
                      disabled={validateLoading[src.source_id]}
                      sx={{ textTransform: "none" }}
                    >
                      {validateLoading[src.source_id] ? "Validating…" : "Validate"}
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={
                        syncLoading[src.source_id] ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <SyncIcon />
                        )
                      }
                      onClick={() => handleSync(src.source_id)}
                      disabled={syncLoading[src.source_id]}
                      sx={{ textTransform: "none" }}
                    >
                      {syncLoading[src.source_id] ? "Syncing…" : "Sync / Onboard"}
                    </Button>
                  </Box>

                  <Tooltip title="Delete Connection">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(src.source_id)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

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
              <MenuItem value="bigquery">Google BigQuery</MenuItem>
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

          {/* CSV note — no file path input */}
          {sourceType === "csv" && (
            <Alert severity="info" sx={{ fontSize: "0.85rem" }}>
              Use the Upload tab to attach a CSV file.
            </Alert>
          )}

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
