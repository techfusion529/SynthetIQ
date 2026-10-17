"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
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
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Switch from "@mui/material/Switch";
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
import SyncIcon from "@mui/icons-material/Sync";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { PoweredByGemini, GeminiIcon } from "@/components/icons/GoogleIcons";
import AgentCanvasGraph from "@/components/agents/AgentCanvasGraph";
import AgentEventTimeline from "@/components/agents/AgentEventTimeline";
import AgentNodeDetailPanel from "@/components/agents/AgentNodeDetailPanel";
import { useComplianceService, useConfigService, useAuditService } from "../lib/hooks/useServices";
import { useNotification } from "../lib/contexts/NotificationContext";
import { useOrganization } from "../lib/contexts/OrganizationContext";
import { useSession } from "../lib/contexts/SessionContext";
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
  const { currentOrg } = useOrganization();
  const { user } = useSession();

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

  // ── Polling & Real-Time Sync State ─────────────────────────────────────────
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const selectedRunRef = useRef<E2ERunResult | null>(null);
  selectedRunRef.current = selectedRun;

  // ── Trigger Autonomous Run Modal State ──────────────────────────────────────
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerCategory, setTriggerCategory] = useState("cat_i_rigid");
  const [triggerVolume, setTriggerVolume] = useState("250");
  const [triggerFiscalYear, setTriggerFiscalYear] = useState("2026-27");
  const [triggerSimulateSpoof, setTriggerSimulateSpoof] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);

  // ── Load Single Run Details with Events ─────────────────────────────────────
  const fetchRunDetails = useCallback(async (runId: string, fallback?: E2ERunResult | null): Promise<E2ERunResult | null> => {
    try {
      const [full, eventsData] = await Promise.all([
        complianceSvc.getRun(runId).catch(() => fallback || null),
        complianceSvc.getRunEvents(runId).catch(() => null),
      ]);
      if (full) {
        return {
          ...full,
          steps: eventsData?.events && eventsData.events.length > 0 ? eventsData.events : full.steps || [],
          total_runtime_ms: eventsData?.total_runtime_ms ?? full.total_runtime_ms,
          total_tokens: eventsData?.total_tokens ?? full.total_tokens,
          total_cost_usd: eventsData?.total_cost_usd ?? full.total_cost_usd,
          total_cost_inr: eventsData?.total_cost_inr ?? full.total_cost_inr,
        };
      }
      return fallback || null;
    } catch {
      return fallback || null;
    }
  }, [complianceSvc]);

  // ── Initial Full Load ──────────────────────────────────────────────────────
  const loadData = useCallback(async (preferredRunId?: string) => {
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

      const targetId = preferredRunId || (runsList.length > 0 ? runsList[0].run_id : null);
      if (targetId) {
        const found = runsList.find((r) => r.run_id === targetId) || (runsList.length > 0 ? runsList[0] : null);
        const detailed = await fetchRunDetails(targetId, found);
        if (detailed) {
          setSelectedRun(detailed);
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load orchestrator data");
    } finally {
      setLoading(false);
    }
  }, [complianceSvc, configSvc, auditSvc, fetchRunDetails]);

  // ── Background Polling Callback ────────────────────────────────────────────
  const pollLatestRuns = useCallback(async () => {
    if (!isPollingActive) return;
    setIsSyncing(true);
    try {
      const runsList = await complianceSvc.listRuns().catch(() => []);
      if (runsList && runsList.length > 0) {
        setRuns(runsList);

        const currentActive = selectedRunRef.current;
        const targetId = currentActive?.run_id || runsList[0].run_id;

        // Fetch fresh status and step events for the active run
        const found = runsList.find((r) => r.run_id === targetId) || currentActive;
        const detailed = await fetchRunDetails(targetId, found);
        if (detailed) {
          setSelectedRun(detailed);
        }
      }
    } catch {
      // Quiet background polling error
    } finally {
      setIsSyncing(false);
    }
  }, [isPollingActive, complianceSvc, fetchRunDetails]);

  // ── Deep-Linking Check on Mount (?run_id=...) ──────────────────────────────
  useEffect(() => {
    let deepLinkedId: string | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      deepLinkedId = params.get("run_id");
    }
    loadData(deepLinkedId || undefined);
    if (deepLinkedId) {
      notify.info(`Inspecting live multi-agent execution: ${deepLinkedId}`, "Run Selected");
    }
  }, [loadData]);

  // ── Real-Time Auto-Polling Timer ───────────────────────────────────────────
  useEffect(() => {
    if (!isPollingActive) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    const currentStatus = (selectedRun?.status || "").toUpperCase();
    const isRunActive = currentStatus === "RUNNING" || currentStatus === "PENDING" || currentStatus === "QUEUED";

    // 2.0s polling during active execution, 5.0s during idle monitoring
    const pollInterval = isRunActive ? 2000 : 5000;

    pollTimerRef.current = setInterval(() => {
      pollLatestRuns();
    }, pollInterval);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isPollingActive, selectedRun?.status, pollLatestRuns]);

  // ── Manual Run Selection ───────────────────────────────────────────────────
  const handleSelectRun = async (runId: string) => {
    const found = runs.find((r) => r.run_id === runId);
    if (!found) return;
    setSelectedRun(found);
    setActiveNodeId(null);
    const detailed = await fetchRunDetails(runId, found);
    if (detailed) {
      setSelectedRun(detailed);
    }
    notify.info(`Loaded run ${runId}`);
  };

  // ── Trigger Multi-Agent Run from Modal ──────────────────────────────────────
  const handleLaunchAgentRun = async () => {
    setTriggerLoading(true);
    try {
      const companyId = currentOrg?.id || (user as any)?.org_id || (config as any)?.company_id || "ORG-DEV-001";
      const result = await complianceSvc.runE2E({
        type: "e2e_compliance",
        params: {
          company_id: companyId,
          fiscal_year: triggerFiscalYear,
          category: triggerCategory,
          volume_tons: parseFloat(triggerVolume) || 250.0,
          simulate_spoof: triggerSimulateSpoof,
        },
      });

      notify.success(
        `Autonomous multi-agent run ${result.run_id} launched! Streaming real-time flow...`,
        "Temporal Pipeline Triggered"
      );
      setTriggerOpen(false);
      setSelectedRun(result);
      setActiveNodeId(null);
      setIsPollingActive(true);

      // Immediately poll to stream progress
      await pollLatestRuns();
    } catch (e: any) {
      notify.error(e?.message || "Failed to trigger multi-agent compliance run", "Launch Failed");
    } finally {
      setTriggerLoading(false);
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
  const totalCostInr = selectedRun?.total_cost_inr || 0.49;
  const isCompliant = selectedRun?.status === "SUCCESS_FULLY_COMPLIANT";
  const isHitl = selectedRun?.hitl_required || (selectedRun?.status || "").includes("HITL");
  const isRunning = (selectedRun?.status || "").toUpperCase() === "RUNNING" || (selectedRun?.status || "").toUpperCase() === "PENDING";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75, pb: 2 }}>
      <PageHeader
        title="Multi-Agent Orchestration & Telemetry"
        icon={<SmartToyIcon fontSize="medium" />}
        description="Zero-trust state machine coordinating System 2 LLM reasoning, TypeSafe Jev physics reflexes, and ERP transactions."
        actions={
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <PoweredByGemini variant="pill" showCloud />

            <Tooltip title="Agent Studio & Hyperparameter Playground">
              <IconButton
                size="small"
                onClick={() => router.push("/agents/config")}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1.5,
                  p: 0.75,
                  color: "text.primary",
                  bgcolor: (t: any) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#FAFAFB"),
                  "&:hover": { bgcolor: (t: any) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#F1F3F4") },
                }}
              >
                <TuneIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Refresh active runs & telemetry">
              <IconButton
                size="small"
                onClick={() => pollLatestRuns()}
                disabled={loading}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1.5,
                  p: 0.75,
                  color: "text.primary",
                  bgcolor: (t: any) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#FAFAFB"),
                  "&:hover": { bgcolor: (t: any) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#F1F3F4") },
                }}
              >
                {isSyncing ? <CircularProgress size={16} sx={{ color: "#1A73E8" }} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Button
              variant="contained"
              size="small"
              startIcon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
              onClick={() => setTriggerOpen(true)}
              sx={{
                fontWeight: 600,
                fontSize: "0.82rem",
                textTransform: "none",
                bgcolor: "#1A73E8",
                color: "#FFFFFF",
                borderRadius: 1.75,
                px: 1.75,
                py: 0.6,
                boxShadow: "none",
                "&:hover": {
                  bgcolor: "#1557B0",
                  boxShadow: "0 2px 6px rgba(26, 115, 232, 0.35)",
                },
              }}
            >
              New Run
            </Button>
          </Box>
        }
      />

      {error && <Alert severity="error">{error}</Alert>}

      {/* System Architecture Inline Badges */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Chip
          icon={<GeminiIcon size={14} />}
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
      <Card variant="outlined" sx={{ p: 1.25, bgcolor: "background.paper", borderRadius: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
          {/* Controls: Run Selector + Datetime + Search + Polling indicator */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", flex: 1, minWidth: 300 }}>
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
                  const isRunActive = r.status === "RUNNING" || r.status === "PENDING";
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
                            variant="outlined"
                            color={isRunSuccess ? "success" : isRunActive ? "info" : isRunHitl ? "warning" : "error"}
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
              placeholder="Search runs..."
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

            {/* Live Polling Status Indicator */}
            <Tooltip title={isPollingActive ? "Real-time live telemetry active. Click to pause." : "Polling paused. Click to resume."}>
              <Chip
                size="small"
                icon={
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: isPollingActive ? "#10B981" : "text.disabled",
                      boxShadow: isPollingActive ? "0 0 8px #10B981" : "none",
                      animation: isPollingActive ? "pulse 2s infinite" : "none",
                      "@keyframes pulse": {
                        "0%": { opacity: 0.6 },
                        "50%": { opacity: 1 },
                        "100%": { opacity: 0.6 },
                      },
                    }}
                  />
                }
                label={isPollingActive ? (isRunning ? "Live Polling (2s)" : "Live Polling (5s)") : "Polling Paused"}
                onClick={() => setIsPollingActive(!isPollingActive)}
                variant="outlined"
                color={isPollingActive ? "success" : "default"}
                sx={{
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  "& .MuiChip-icon": { ml: 0.5 },
                }}
              />
            </Tooltip>
          </Box>

          {/* Active Run Executive Summary Ribbon */}
          {selectedRun && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Chip
                label={selectedRun.status}
                variant="outlined"
                color={isCompliant ? "success" : isRunning ? "info" : isHitl ? "warning" : "error"}
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
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <SpeedIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                    <Typography sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: "0.78rem" }}>
                      {totalRuntime} ms
                    </Typography>
                  </Box>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ height: 14, my: "auto" }} />
                <Tooltip title="Total Tokens">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <TollIcon sx={{ fontSize: 13, color: "secondary.main" }} />
                    <Typography sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: "0.78rem", color: "secondary.main" }}>
                      {totalTokens.toLocaleString()}
                    </Typography>
                  </Box>
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
      <Grid container spacing={1.5} alignItems="stretch">
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

      {/* ── Chronological Multi-Agent Timeline & Event Stream ──────────────── */}
      <AgentEventTimeline
        selectedRun={selectedRun}
        activeNodeId={activeNodeId}
        onSelectNode={(nodeId) => setActiveNodeId((prev) => (prev === nodeId ? null : nodeId))}
      />

      {/* ── Trigger Autonomous Multi-Agent Pipeline Modal ───────────────────── */}
      <Dialog open={triggerOpen} onClose={() => setTriggerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <SmartToyIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={800} fontSize="1.05rem">
              Trigger Autonomous Multi-Agent Run
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Zero-trust orchestration: Gemini System 2 reasoning, SCADA physics reflex, and CDA matching.
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2.5 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Plastic Category"
            value={triggerCategory}
            onChange={(e) => setTriggerCategory(e.target.value)}
          >
            <MenuItem value="cat_i_rigid">Category I — Rigid Plastic</MenuItem>
            <MenuItem value="cat_ii_flexible">Category II — Flexible Plastic</MenuItem>
            <MenuItem value="cat_iii_mlp">Category III — Multi-Layered Plastic (MLP)</MenuItem>
            <MenuItem value="cat_iv_compostable">Category IV — Compostable Plastic</MenuItem>
          </TextField>

          <TextField
            fullWidth
            size="small"
            label="Target Volume (Metric Tons)"
            type="number"
            value={triggerVolume}
            onChange={(e) => setTriggerVolume(e.target.value)}
          />

          <TextField
            fullWidth
            size="small"
            label="Fiscal Year"
            value={triggerFiscalYear}
            onChange={(e) => setTriggerFiscalYear(e.target.value)}
          />

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              border: 1,
              borderColor: triggerSimulateSpoof ? "error.main" : "divider",
              bgcolor: triggerSimulateSpoof
                ? (t) => (t.palette.mode === "dark" ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2")
                : (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#F8FAFC"),
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight={700} color={triggerSimulateSpoof ? "error.main" : "text.primary"}>
                Simulate SCADA Sensor Fraud Injection
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Injects pure resistive space-heater load (PF 0.99, torque &lt; 2 Nm) to test instant halt reflex.
              </Typography>
            </Box>
            <Switch
              checked={triggerSimulateSpoof}
              onChange={(e) => setTriggerSimulateSpoof(e.target.checked)}
              color="error"
            />
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setTriggerOpen(false)} color="inherit" disabled={triggerLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={triggerSimulateSpoof ? "error" : "primary"}
            startIcon={triggerLoading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleLaunchAgentRun}
            disabled={triggerLoading}
            sx={{ fontWeight: 700 }}
          >
            {triggerLoading ? "Dispatching Temporal Run…" : "Launch Run & Watch Live Flow"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
