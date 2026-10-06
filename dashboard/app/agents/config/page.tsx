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
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";

import SmartToyIcon from "@mui/icons-material/SmartToy";
import TuneIcon from "@mui/icons-material/Tune";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import StorageIcon from "@mui/icons-material/Storage";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { useRouter } from "next/navigation";
import { useSession } from "../../lib/contexts/SessionContext";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1` : "/api/v1")
    : typeof window !== "undefined"
    ? "/api/v1"
    : "http://localhost:8000/api/v1";

interface AgentConfig {
  config_id: string;
  org_id: string;
  agent_name: string;
  data_source_id: string | null;
  data_source_name: string | null;
  model_name: string;
  temperature: number;
  system_prompt: string | null;
  parameters: Record<string, any>;
  is_active: boolean;
}

interface DataSource {
  source_id: string;
  name: string;
  source_type: string;
  purpose: string;
}

const AGENT_LABELS: Record<string, { label: string; role: string; defaultPurpose: string }> = {
  brand_liability: {
    label: "Brand Liability Agent",
    role: "System 2 Reasoning — Ingests ERP packaging data & applies 1/3 debt amortization",
    defaultPurpose: "erp_sales",
  },
  regulatory_watchdog: {
    label: "Regulatory Watchdog",
    role: "System 2 Reasoning — Parses CPCB Gazette rules & base clearing rates",
    defaultPurpose: "regulatory",
  },
  treasury: {
    label: "Treasury Agent",
    role: "System 2 Optimization — Executes continuous double auction & clearing corridors",
    defaultPurpose: "auction",
  },
  logistics: {
    label: "Logistics Agent",
    role: "System 2 Verification — Validates GST E-Way bills & weighbridge waypoints",
    defaultPurpose: "logistics",
  },
  auditor: {
    label: "Auditor Agent (Nimble/Jev)",
    role: "System 1 Reflex — Extruder SCADA physics audit for resistive heater spoofing",
    defaultPurpose: "scada_telemetry",
  },
  erp: {
    label: "ERP Agent",
    role: "System 2 Transaction — Manages 80/20 split escrow purchase orders",
    defaultPurpose: "erp_po",
  },
  legal: {
    label: "Legal Agent",
    role: "System 2 Attestation — Signs CPCB Form-1 filing packets with DSC keys",
    defaultPurpose: "cpcb_portal",
  },
};

export default function AgentConfigStudioPage() {
  const router = useRouter();
  const { user, token } = useSession();
  const orgId = user?.org_id || "ORG-DEV-001";

  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active selected agent editing state
  const [currentConfig, setCurrentConfig] = useState<AgentConfig | null>(null);

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgResp, dsResp] = await Promise.all([
        fetch(`${API_BASE}/organizations/${orgId}/agents`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/organizations/${orgId}/data-sources`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!cfgResp.ok) throw new Error("Failed to load agent configurations");
      const cfgData = await cfgResp.json();
      const dsData = dsResp.ok ? await dsResp.json() : [];

      setConfigs(cfgData);
      setDataSources(dsData);

      if (cfgData.length > 0 && !currentConfig) {
        setCurrentConfig(cfgData[0]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, token, currentConfig]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTabChange = (_: any, newIdx: number) => {
    setActiveTab(newIdx);
    setCurrentConfig(configs[newIdx] || null);
    setTestResult(null);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!currentConfig) return;
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const resp = await fetch(
        `${API_BASE}/organizations/${orgId}/agents/${currentConfig.agent_name}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            data_source_id: currentConfig.data_source_id,
            model_name: currentConfig.model_name,
            temperature: currentConfig.temperature,
            system_prompt: currentConfig.system_prompt,
            parameters: currentConfig.parameters,
            is_active: currentConfig.is_active,
          }),
        }
      );

      if (!resp.ok) throw new Error("Failed to save agent configuration");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestAgent = async () => {
    if (!currentConfig) return;
    setTesting(true);
    setTestResult(null);

    try {
      const resp = await fetch(
        `${API_BASE}/organizations/${orgId}/agents/${currentConfig.agent_name}/test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sample_input: {} }),
        }
      );
      const data = await resp.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ status: "ERROR", error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const agentMeta = currentConfig ? AGENT_LABELS[currentConfig.agent_name] : null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <Breadcrumbs>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/")}>
          Executive Hub
        </Link>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/agents")}>
          Agents
        </Link>
        <Typography color="primary.light" fontWeight={600}>
          Multi-Agent Dynamic Configuration Studio
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SmartToyIcon color="primary" /> Configurable Multi-Agent System Studio
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bind tenant data sources to specific agents, customize Gemini model prompts, and tune physics & treasury thresholds.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !currentConfig}
            sx={{ fontWeight: 600, textTransform: "none" }}
          >
            {saving ? "Saving Changes..." : "Save Configuration"}
          </Button>
          <Button
            variant="contained"
            startIcon={testing ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleTestAgent}
            disabled={testing || !currentConfig}
            sx={{
              background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
              fontWeight: 600,
              textTransform: "none",
            }}
          >
            {testing ? "Executing Test..." : "Test with Dynamic Data"}
          </Button>
        </Box>
      </Box>

      {saveSuccess && (
        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
          Agent configuration saved successfully for tenant {orgId}.
        </Alert>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {/* Agent Selector Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.9rem" },
        }}
      >
        {configs.map((c) => (
          <Tab key={c.agent_name} label={AGENT_LABELS[c.agent_name]?.label || c.agent_name} />
        ))}
      </Tabs>

      {currentConfig && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 3 }}>
          {/* Main Config Form */}
          <Card
            variant="outlined"
            sx={{ bgcolor: "rgba(255, 255, 255, 0.02)", borderColor: "rgba(255, 255, 255, 0.08)", borderRadius: 2.5 }}
          >
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {agentMeta?.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {agentMeta?.role}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

              {/* Data Source Binding */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="subtitle2" sx={{ color: "primary.light", fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                  <StorageIcon fontSize="small" /> Bound Data Source
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Select which connected data source this agent pulls from during workflow execution:
                </Typography>
                <TextField
                  select
                  size="small"
                  value={currentConfig.data_source_id || ""}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, data_source_id: e.target.value || null })}
                  fullWidth
                >
                  <MenuItem value="">— Use Default Engine Fallback —</MenuItem>
                  {dataSources.map((ds) => (
                    <MenuItem key={ds.source_id} value={ds.source_id}>
                      {ds.name} ({ds.source_type.toUpperCase()} • {ds.purpose})
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              {/* LLM Model Selection & Temperature */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <TextField
                  select
                  label="LLM Model"
                  size="small"
                  value={currentConfig.model_name}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, model_name: e.target.value })}
                >
                  <MenuItem value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</MenuItem>
                  <MenuItem value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</MenuItem>
                  <MenuItem value="gemini-1.5-flash">Gemini 1.5 Flash</MenuItem>
                </TextField>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Reasoning Temperature: {currentConfig.temperature}
                  </Typography>
                  <Slider
                    size="small"
                    value={currentConfig.temperature}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    onChange={(_, val) => setCurrentConfig({ ...currentConfig, temperature: val as number })}
                  />
                </Box>
              </Box>

              {/* Custom System Prompt */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="subtitle2" sx={{ color: "primary.light", fontWeight: 700 }}>
                  Agent Instructions / System Prompt
                </Typography>
                <TextField
                  multiline
                  rows={4}
                  size="small"
                  fullWidth
                  value={currentConfig.system_prompt || ""}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, system_prompt: e.target.value })}
                  placeholder="Enter custom instructions to tailor agent reasoning..."
                />
              </Box>

              {/* Agent Hyperparameters */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="subtitle2" sx={{ color: "primary.light", fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                  <TuneIcon fontSize="small" /> Domain Hyperparameters (JSON)
                </Typography>
                <TextField
                  multiline
                  rows={4}
                  size="small"
                  fullWidth
                  value={JSON.stringify(currentConfig.parameters, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setCurrentConfig({ ...currentConfig, parameters: parsed });
                    } catch {
                      // Allow typing in JSON
                    }
                  }}
                  sx={{ "& textarea": { fontFamily: "monospace", fontSize: "0.85rem" } }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Test & Live Execution Preview Panel */}
          <Card
            variant="outlined"
            sx={{ bgcolor: "rgba(255, 255, 255, 0.02)", borderColor: "rgba(255, 255, 255, 0.08)", borderRadius: 2.5 }}
          >
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Live Dynamic Test Output
                </Typography>
                <Chip label="Isolated Sandbox" size="small" variant="outlined" color="primary" />
              </Box>

              <Typography variant="body2" color="text.secondary">
                Executes the agent against your connected data source using the configured parameters.
              </Typography>

              {testing && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6, gap: 1.5 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary">
                    Querying dynamic data & executing agent reasoning...
                  </Typography>
                </Box>
              )}

              {testResult && !testing && (
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: "rgba(0,0,0,0.3)",
                    borderRadius: 2,
                    border: "1px solid rgba(255,255,255,0.06)",
                    maxHeight: 480,
                    overflow: "auto",
                  }}
                >
                  <Typography variant="caption" fontFamily="monospace" component="pre" sx={{ m: 0, color: "#86EFAC" }}>
                    {JSON.stringify(testResult, null, 2)}
                  </Typography>
                </Paper>
              )}

              {!testResult && !testing && (
                <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
                  <SmartToyIcon sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
                  <Typography variant="body2">
                    Click &quot;Test with Dynamic Data&quot; to inspect live execution output.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}
