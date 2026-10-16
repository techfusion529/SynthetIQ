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
import Tooltip from "@mui/material/Tooltip";
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
import AgentNodeDetailPanel from "@/components/agents/AgentNodeDetailPanel";
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

      {/* System Architecture Inline Badges */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Chip
          icon={<SmartToyIcon sx={{ fontSize: 14 }} />}
          label={`System 2: ${config?.gemini?.model || "gemini-3.8-flash"}`}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: "0.75rem" }}
        />
        <Chip
          icon={<SpeedIcon sx={{ fontSize: 14 }} />}
          label={`Physics Reflex: ${config?.jev_mode?.mode || "NIMBLE"} (Torque ≥ 8 Nm)`}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: "0.75rem" }}
        />
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
          label={`Temporal: ${config?.services?.temporal?.status || "CONNECTED"}`}
          size="small"
          color={config?.services?.temporal?.status === "CONNECTED" ? "success" : "warning"}
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: "0.75rem" }}
        />
        <Chip
          icon={<TollIcon sx={{ fontSize: 14 }} />}
          label={`Audits: ${verdicts.length} Logged (${runs.length} Runs)`}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: "0.75rem" }}
        />
      </Box>

      {/* Unified Compact Orchestration Run Toolbar */}
      <Card variant="outlined" sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
          {/* Controls: Run Selector + Datetime + Search */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", flex: 1, minWidth: 300 }}>
            <TextField
              select
              label="Select Compliance Run"
              size="small"
              value={selectedRun?.run_id || ""}
              onChange={(e) => handleSelectRun(e.target.value)}
              disabled={loading || filteredRuns.length === 0}
              sx={{ minWidth: 260, flex: { xs: "1 1 100%", md: "1 1 auto" } }}
            >
              {filteredRuns.length === 0 ? (
                <MenuItem value="" disabled>
                  No runs match filter
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
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {r.category || "cat_i_rigid"} ({r.volume_tons || 250} T)
                          </Typography>
                          <Chip
                            size="small"
                            label={r.status}
                            color={isRunSuccess ? "success" : isRunHitl ? "warning" : "error"}
                            sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }}
                          />
                        </Box>
                      </Box>
                    </MenuItem>
                  );
                })
              )}
            </TextField>

            <TextField
              select
              label="Period"
              size="small"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              sx={{ minWidth: 110 }}
            >
              <MenuItem value="ALL">All Time</MenuItem>
              <MenuItem value="TODAY">Last 24h</MenuItem>
              <MenuItem value="7D">Last 7d</MenuItem>
              <MenuItem value="30D">Last 30d</MenuItem>
            </TextField>

            <TextField
              placeholder="Search..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 130 }}
            />
          </Box>

          {/* Active Run Executive Summary Ribbon */}
          {selectedRun && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Chip
                label={selectedRun.status}
                color={isCompliant ? "success" : isHitl ? "warning" : "error"}
                sx={{ fontWeight: 800, height: 26, fontSize: "0.75rem" }}
              />
              <Chip
                label={`${selectedRun.volume_tons || 250} MT • ${selectedRun.category || "cat_i_rigid"}`}
                variant="outlined"
                size="small"
                sx={{ fontWeight: 600, height: 26, fontSize: "0.75rem" }}
              />
              <Paper
                variant="outlined"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 1.5,
                  py: 0.5,
                  bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                  borderRadius: 1.5,
                }}
              >
                <Tooltip title="Total Runtime">
                  <Typography sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: "0.78rem" }}>
                    ⚡ {totalRuntime} ms
                  </Typography>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ height: 14, my: "auto" }} />
                <Tooltip title="Total Tokens">
                  <Typography sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: "0.78rem", color: "secondary.main" }}>
                    ✦ {totalTokens.toLocaleString()}
                  </Typography>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ height: 14, my: "auto" }} />
                <Tooltip title="Total Run Cost">
                  <Typography sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: "0.78rem", color: "primary.main" }}>
                    ₹{totalCostInr.toFixed(2)}
                  </Typography>
                </Tooltip>
              </Paper>
            </Box>
          )}
        </Box>
      </Card>

      {/* Main Orchestration Workspace: Full Width Canvas or Shrunk Canvas + Right Detail Panel */}
      <Grid container spacing={2} alignItems="stretch">
        {/* Visual Interactive Agent Graph Canvas */}
        <Grid
          item
          xs={12}
          lg={activeNodeId ? 6.8 : 12}
          sx={{ display: "flex", flexDirection: "column", transition: "all 0.25s ease-in-out" }}
        >
          <AgentCanvasGraph
            selectedRun={selectedRun}
            activeNodeId={activeNodeId}
            onSelectNode={(nodeId) => setActiveNodeId((prev) => (prev === nodeId ? null : nodeId))}
          />
        </Grid>

        {/* Right-Hand Node Detail Panel (Inputs & Outputs Tables with Paginator) */}
        {activeNodeId && (
          <Grid
            item
            xs={12}
            lg={5.2}
            sx={{ display: "flex", flexDirection: "column", transition: "all 0.25s ease-in-out" }}
          >
            <AgentNodeDetailPanel
              selectedRun={selectedRun}
              activeNodeId={activeNodeId}
              onClose={() => setActiveNodeId(null)}
              onSelectNode={(nodeId) => setActiveNodeId(nodeId)}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
