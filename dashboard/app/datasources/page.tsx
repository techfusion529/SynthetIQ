"use client";

import React, { useCallback, useEffect, useState } from "react";
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

import StorageIcon from "@mui/icons-material/Storage";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import RefreshIcon from "@mui/icons-material/Refresh";

import { useRouter } from "next/navigation";
import { useSession } from "../lib/contexts/SessionContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface DataSource {
  source_id: string;
  name: string;
  source_type: string;
  purpose: string;
  description: string;
  connection_config: Record<string, any>;
  is_active: boolean;
  last_sync_at?: string;
  created_at?: string;
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
  const [configJson, setConfigJson] = useState('{\n  "project_id": "synthetiq-dev",\n  "dataset_id": "epr_compliance",\n  "table_name": "sales_data"\n}');
  const [saving, setSaving] = useState(false);

  // Test & Preview states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { healthy: boolean; message: string }>>({});
  const [previewData, setPreviewData] = useState<{ source_id: string; columns: string[]; sample_rows: any[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
    } catch (e: any) {
      setError(e.message || "Failed to load tenant data sources");
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (sourceId: string) => {
    setTestingId(sourceId);
    try {
      const resp = await fetch(`${API_BASE}/organizations/${orgId}/data-sources/${sourceId}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setTestResults((prev) => ({
        ...prev,
        [sourceId]: { healthy: data.healthy, message: data.status_message || (data.healthy ? "Connected" : "Failed") },
      }));
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [sourceId]: { healthy: false, message: e.message },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handlePreview = async (sourceId: string) => {
    setPreviewLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/organizations/${orgId}/data-sources/${sourceId}/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setPreviewData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
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
      setConfigJson('{\n  "project_id": "synthetiq-dev",\n  "dataset_id": "epr_compliance",\n  "table_name": "sales_data"\n}');
    } else if (type === "postgresql") {
      setConfigJson('{\n  "host": "localhost",\n  "port": 5432,\n  "database": "erp_production",\n  "user": "erp_readonly",\n  "password": "***"\n}');
    } else if (type === "rest_api") {
      setConfigJson('{\n  "base_url": "https://api.sap.corp.internal/odata/v4",\n  "auth_token": "Bearer ***",\n  "endpoint": "/SalesOrders"\n}');
    } else if (type === "csv") {
      setConfigJson('{\n  "sales_file_path": "./data/seed/sales.csv",\n  "delimiter": ","\n}');
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <Breadcrumbs>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/")}>
          Executive Hub
        </Link>
        <Typography color="primary.light" fontWeight={600}>
          Dynamic Data Sources & Connectors
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <StorageIcon color="primary" /> Dynamic Data Sources Studio
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Connect ERP databases, BigQuery pipelines, and SCADA telemetry feeds. Data feeds directly into the multi-agent system.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchSources} disabled={loading}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setModalOpen(true)}
            sx={{
              background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
              fontWeight: 600,
              textTransform: "none",
            }}
          >
            Add Data Connection
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Sources Grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5 }}>
        {sources.map((src) => {
          const test = testResults[src.source_id];
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
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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

                {/* Actions */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={testingId === src.source_id ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
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
                      sx={{ textTransform: "none" }}
                    >
                      Preview Data
                    </Button>
                  </Box>

                  <Tooltip title="Delete Connection">
                    <IconButton size="small" color="error" onClick={() => handleDelete(src.source_id)}>
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
        <Dialog open={Boolean(previewData)} onClose={() => setPreviewData(null)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <StorageIcon color="primary" /> Live Data Sample Preview ({previewData.source_id})
            </Box>
            <Chip label={`${previewData.sample_rows.length} Rows Sampled`} size="small" color="primary" />
          </DialogTitle>
          <DialogContent dividers>
            {previewData.sample_rows.length === 0 ? (
              <Typography color="text.secondary">No sample records returned from this data source.</Typography>
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
                          <TableCell key={col} sx={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
                            {typeof row[col] === "object" ? JSON.stringify(row[col]) : String(row[col])}
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
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
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

          <TextField
            label="Connection Configuration (JSON)"
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            multiline
            rows={5}
            fullWidth
            size="small"
            helperText="Encrypted at rest. Credentials will be masked on export."
            sx={{ "& textarea": { fontFamily: "monospace", fontSize: "0.85rem" } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!name || saving}
            onClick={handleCreate}
            sx={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
          >
            {saving ? "Registering..." : "Connect Source"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
