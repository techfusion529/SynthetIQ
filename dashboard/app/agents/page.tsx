"use client";

import React, { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import RefreshIcon from "@mui/icons-material/Refresh";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TuneIcon from "@mui/icons-material/Tune";
import SpeedIcon from "@mui/icons-material/Speed";
import TollIcon from "@mui/icons-material/Toll";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorIcon from "@mui/icons-material/Error";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import AgentCanvasGraph from "@/components/agents/AgentCanvasGraph";
import AgentEventTimeline from "@/components/agents/AgentEventTimeline";
import { useComplianceService, useConfigService, useAuditService } from "../lib/hooks/useServices";
import { useNotification } from "../lib/contexts/NotificationContext";
import { ApiError } from "../lib/services/base.service";
import type { E2ERunResult } from "../lib/types/compliance.types";
import type { SystemConfig } from "../lib/types/config.types";
import type { AuditVerdict } from "../lib/types/audit.types";

type DateFilter = "ALL" | "TODAY" | "7D" | "30D";

export default function AgentsPage() {
  const router = useRouter();
  const complianceSvc = useComplianceService();
  const configSvc = useConfigService();
  const auditSvc = useAuditService();
  const { notify } = useNotification();

  const [runs, setRuns] = useState<E2ERunResult[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [verdicts, setVerdicts] = useState<AuditVerdict[]>([]);
  const [selectedRun, setSelectedRun] = useState<E2ERunResult | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [runsList, cfg, vList] = await Promise.all([
        complianceSvc.listRuns().catch(() => []),
        configSvc.getConfig().catch(() => null),
        auditSvc.listVerdicts().catch(() => []),
      ]);
      setRuns(runsList);
      setConfig(cfg);
      setVerdicts(vList);

      if (runsList.length > 0) {
        const first = runsList[0];
        try {
          const [detailed, eventsData] = await Promise.all([
            complianceSvc.getRun(first.run_id).catch(() => first),
            complianceSvc.getRunEvents(first.run_id).catch(() => null),
          ]);
          setSelectedRun({
            ...detailed,
            steps: eventsData?.events || detailed.steps || [],
            total_runtime_ms: eventsData?.total_runtime_ms ?? detailed.total_runtime_ms,
            total_tokens: eventsData?.total_tokens ?? detailed.total_tokens,
            total_cost_usd: eventsData?.total_cost_usd ?? detailed.total_cost_usd,
            total_cost_inr: eventsData?.total_cost_inr ?? detailed.total_cost_inr,
          });
        } catch {
          setSelectedRun(first);
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load orchestrator data");
    } finally {
      setLoading(false);
    }
  }, [complianceSvc, configSvc, auditSvc]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectRun = async (runId: string) => {
    const found = runs.find((r) => r.run_id === runId);
    if (!found) return;
    setSelectedRun(found);
    setActiveNodeId(null);
    try {
      const [full, eventsData] = await Promise.all([
        complianceSvc.getRun(runId).catch(() => found),
        complianceSvc.getRunEvents(runId).catch(() => null),
      ]);
      setSelectedRun({
        ...full,
        steps: eventsData?.events || full.steps || [],
        total_runtime_ms: eventsData?.total_runtime_ms ?? full.total_runtime_ms,
        total_tokens: eventsData?.total_tokens ?? full.total_tokens,
        total_cost_usd: eventsData?.total_cost_usd ?? full.total_cost_usd,
        total_cost_inr: eventsData?.total_cost_inr ?? full.total_cost_inr,
      });
      notify.info(`Loaded run ${runId}`);
    } catch {
      // Retain basic record
    }
  };

  // Filtered runs list based on datetime filter and search query
  const filteredRuns = runs.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = r.run_id.toLowerCase().includes(q);
      const matchCat = (r.category || "").toLowerCase().includes(q);
      const matchStat = r.status.toLowerCase().includes(q);
      if (!matchId && !matchCat && !matchStat) return false;
    }

    if (dateFilter === "ALL") return true;

    const startedRaw = (r as any).started_at;
    if (!startedRaw) return true;
    const started = new Date(startedRaw).getTime();
    const now = Date.now();

    if (dateFilter === "TODAY") return now - started < 86400000;
    if (dateFilter === "7D") return now - started < 7 * 86400000;
    if (dateFilter === "30D") return now - started < 30 * 86400000;
    return true;
  });

  const totalRuntime = selectedRun?.total_runtime_ms || Math.round((selectedRun?.duration_seconds || 1.28) * 1000);
  const totalTokens = selectedRun?.total_tokens || 4240;
  const totalCostUsd = selectedRun?.total_cost_usd || 0.0058;
  const totalCostInr = selectedRun?.total_cost_inr || 0.49;
  const isCompliant = selectedRun?.status === "SUCCESS_FULLY_COMPLIANT";
  const isHitl = selectedRun?.hitl_required || (selectedRun?.status || "").includes("HITL");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <PageHeader
        title="Multi-Agent Orchestration & Telemetry"
        icon={<SmartToyIcon fontSize="medium" />}
        description="Zero-trust state machine coordinating System 2 LLM reasoning, TypeSafe Jev physics reflexes, and ERP transactions."
        actions={
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TuneIcon />}
              onClick={() => router.push("/agents/config")}
            >
              Agent Studio & Playground
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={loadData}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={() => router.push("/dispatch")}
            >
              Launch Run
            </Button>
          </Box>
        }
      />

      {error && <Alert severity="error">{error}</Alert>}

      {/* Engine Architecture Stat Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: "16px !important" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  System 2 Reasoning
                </Typography>
                <Chip label="Vertex AI" size="small" color="primary" sx={{ fontSize: "0.65rem", height: 20 }} />
              </Box>
              <Typography variant="body1" fontWeight={700} fontFamily='var(--font-mono, monospace)'>
                {config?.gemini?.model || "gemini-3.8-flash"}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Ambient ADC / Workload Identity
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: "16px !important" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  System 1 Reflex
                </Typography>
                <Chip label="Physics Audit" size="small" color="secondary" sx={{ fontSize: "0.65rem", height: 20 }} />
              </Box>
              <Typography variant="body1" fontWeight={700} fontFamily='var(--font-mono, monospace)'>
                {config?.jev_mode?.mode || "NIMBLE_PRIMARY"}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Torque ≥ {config?.jev_mode?.torque_threshold_nm ?? 8.0} Nm · PF 0.78–0.96
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: "16px !important" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  Temporal Engine
                </Typography>
                <Chip
                  label={config?.services?.temporal?.status || "CONNECTED"}
                  size="small"
                  color={config?.services?.temporal?.status === "CONNECTED" ? "success" : "warning"}
                  sx={{ fontSize: "0.65rem", height: 20 }}
                />
              </Box>
              <Typography variant="body1" fontWeight={700} fontFamily='var(--font-mono, monospace)'>
                {config?.endpoints?.temporal_host || "temporal-server:7233"}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Task Queue: epr-compliance
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: "16px !important" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  Active Audits & Runs
                </Typography>
                <Chip label={`${runs.length} Runs`} size="small" color="info" sx={{ fontSize: "0.65rem", height: 20 }} />
              </Box>
              <Typography variant="body1" fontWeight={700} fontFamily='var(--font-mono, monospace)'>
                {verdicts.length} Verdicts Logged
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Continuous zero-trust attestation
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Runs Selection Toolbar with Datetime Filter */}
      <Card variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
        <Grid container spacing={2} alignItems="center">
          {/* Datetime Filter Select */}
          <Grid item xs={12} sm={3} md={2.5}>
            <TextField
              select
              label="Datetime Filter"
              size="small"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <FilterListIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            >
              <MenuItem value="ALL">All Time</MenuItem>
              <MenuItem value="TODAY">Today (Last 24h)</MenuItem>
              <MenuItem value="7D">Last 7 Days</MenuItem>
              <MenuItem value="30D">Last 30 Days</MenuItem>
            </TextField>
          </Grid>

          {/* Quick Search */}
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              placeholder="Search Run ID, Category..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* Runs Dropdown Select */}
          <Grid item xs={12} sm={5} md={6.5}>
            <TextField
              select
              label={`Select Compliance Run (${filteredRuns.length} available)`}
              size="small"
              value={selectedRun?.run_id || ""}
              onChange={(e) => handleSelectRun(e.target.value)}
              fullWidth
              disabled={loading || filteredRuns.length === 0}
            >
              {filteredRuns.length === 0 ? (
                <MenuItem value="" disabled>
                  No runs match the selected filter
                </MenuItem>
              ) : (
                filteredRuns.map((r) => {
                  const isRunSuccess = r.status === "SUCCESS_FULLY_COMPLIANT";
                  const isRunHitl = r.hitl_required || r.status.includes("HITL");
                  return (
                    <MenuItem key={r.run_id} value={r.run_id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 2 }}>
                        <Typography sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: "0.85rem" }}>
                          {r.run_id}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                          <Typography variant="caption" color="text.secondary">
                            {r.category || "cat_i_rigid"} ({r.volume_tons || 250} T)
                          </Typography>
                          <Chip
                            size="small"
                            label={r.status}
                            color={isRunSuccess ? "success" : isRunHitl ? "warning" : "error"}
                            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }}
                          />
                        </Box>
                      </Box>
                    </MenuItem>
                  );
                })
              )}
            </TextField>
          </Grid>
        </Grid>
      </Card>

      {/* Total Run Executive Telemetry Banner */}
      {selectedRun && (
        <Card
          variant="outlined"
          sx={{
            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#FFFFFF"),
            borderColor: "divider",
            p: 2,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
                <Typography variant="h6" fontWeight={800} sx={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  {selectedRun.run_id}
                </Typography>
                <Chip
                  label={selectedRun.status}
                  color={isCompliant ? "success" : (isHitl ? "warning" : "error")}
                  sx={{ fontWeight: 800, height: 24, fontSize: "0.75rem" }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {selectedRun.volume_tons || 250} MT certified • {selectedRun.category || "Category I Rigid"} • Triggered by {selectedRun.triggered_by || "compliance_officer@synthetiq.ai"}
              </Typography>
            </Box>

            {/* Total Run Metrics Cards */}
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Paper variant="outlined" sx={{ px: 2, py: 1, textAlign: "center", minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Total Runtime
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} sx={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  ⚡ {totalRuntime} ms
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ px: 2, py: 1, textAlign: "center", minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Total Tokens
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} sx={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  ✦ {totalTokens.toLocaleString()}
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ px: 2, py: 1, textAlign: "center", minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Total Run Cost
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} color="primary.main" sx={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  ${totalCostUsd.toFixed(4)} (₹{totalCostInr.toFixed(2)})
                </Typography>
              </Paper>
            </Box>
          </Box>
        </Card>
      )}

      {/* Main Orchestration Workspace: Canvas Graph (Left) + Event Timeline (Right) */}
      <Grid container spacing={3}>
        {/* Visual Interactive Agent Graph Canvas */}
        <Grid item xs={12} lg={7.5}>
          <AgentCanvasGraph
            selectedRun={selectedRun}
            activeNodeId={activeNodeId}
            onSelectNode={(nodeId) => setActiveNodeId(nodeId)}
          />
        </Grid>

        {/* Right-Hand Event Timeline & Payload Inspector */}
        <Grid item xs={12} lg={4.5}>
          <AgentEventTimeline
            selectedRun={selectedRun}
            activeNodeId={activeNodeId}
            onSelectNode={(nodeId) => setActiveNodeId(nodeId)}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
