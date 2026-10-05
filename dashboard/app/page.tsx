"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import RefreshIcon from "@mui/icons-material/Refresh";
import ScaleIcon from "@mui/icons-material/Scale";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import SpeedIcon from "@mui/icons-material/Speed";
import SecurityIcon from "@mui/icons-material/Security";
import GavelIcon from "@mui/icons-material/Gavel";
import DescriptionIcon from "@mui/icons-material/Description";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HubIcon from "@mui/icons-material/Hub";

import { useCompany } from "./lib/contexts/CompanyContext";
import {
  useComplianceService,
  useLiabilityService,
  useAuditService,
  useConfigService,
  useAuctionService,
  useSettlementService,
} from "./lib/hooks/useServices";
import { ApiError } from "./lib/services/base.service";
import type { E2ERunResult, E2EStep } from "./lib/types/compliance.types";
import type { LiabilityReport } from "./lib/types/liability.types";
import type { AuditVerdict } from "./lib/types/audit.types";
import type { SystemConfig } from "./lib/types/config.types";
import type { Auction } from "./lib/types/auction.types";
import type { EscrowPO } from "./lib/types/settlement.types";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell } from "recharts";

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  unit,
  icon,
  color,
  loading,
  error,
  subtitle,
}: {
  label: string;
  value?: string | number | null;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  loading: boolean;
  error?: string | null;
  subtitle?: string;
}) {
  return (
    <Card sx={{ height: "100%", position: "relative", overflow: "hidden" }}>
      <CardContent sx={{ p: "20px !important" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing="0.08em" fontWeight={700}>
            {label}
          </Typography>
          <Box sx={{ color, opacity: 0.9 }}>{icon}</Box>
        </Box>
        {loading ? (
          <Skeleton variant="text" width="65%" height={48} sx={{ mt: 1 }} />
        ) : error ? (
          <Alert severity="error" sx={{ mt: 1, py: 0.5, fontSize: "0.75rem" }}>{error}</Alert>
        ) : (
          <>
            <Typography variant="h4" fontWeight={700} sx={{ mt: 1.5, color }} fontFamily="monospace">
              {value ?? "—"}
              {unit && (
                <Typography component="span" variant="body2" color="text.secondary" fontFamily="sans-serif" ml={0.75} fontWeight={500}>
                  {unit}
                </Typography>
              )}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                {subtitle}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Stage Execution Badge ───────────────────────────────────────────────────
function StageBadge({ step }: { step: E2EStep }) {
  const isCompleted = step.status === "COMPLETED";
  const isBlocked = step.status.includes("BLOCKED") || step.status.includes("HALTED") || step.status.includes("FAIL");
  const color = isCompleted ? "success" : isBlocked ? "error" : "warning";

  return (
    <Card
      variant="outlined"
      sx={{
        p: 1.5,
        height: "100%",
        bgcolor: isCompleted ? "rgba(16,185,129,0.03)" : isBlocked ? "rgba(244,63,94,0.04)" : "background.paper",
        borderColor: isCompleted ? "rgba(16,185,129,0.3)" : isBlocked ? "rgba(244,63,94,0.3)" : "divider",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
          Stage {step.step}
        </Typography>
        <Chip label={step.status} size="small" color={color} sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />
      </Box>
      <Typography variant="body2" fontWeight={700} noWrap>{step.name}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" noWrap>{step.service}</Typography>
    </Card>
  );
}

// ─── Dynamic Category Palettes ───────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  cat_i_rigid: "#4f46e5",
  cat_ii_flexible: "#06b6d4",
  cat_iii_mlp: "#10b981",
  cat_iv_compostable: "#f59e0b",
};

const CATEGORY_LABELS: Record<string, string> = {
  cat_i_rigid: "Cat I — Rigid Plastic",
  cat_ii_flexible: "Cat II — Flexible Plastic",
  cat_iii_mlp: "Cat III — Multi-Layer (MLP)",
  cat_iv_compostable: "Cat IV — Compostable",
};

export default function ExecutiveOverviewPage() {
  const router = useRouter();
  const { companyId, company } = useCompany();

  // Service hooks
  const complianceSvc = useComplianceService();
  const liabilitySvc  = useLiabilityService();
  const auditSvc      = useAuditService();
  const configSvc     = useConfigService();
  const auctionSvc    = useAuctionService();
  const settlementSvc = useSettlementService();

  // System & Engine state
  const [config, setConfig] = useState<SystemConfig | null>(null);

  // Form controls for E2E Run (Zero Hardcoding!)
  const [category, setCategory]         = useState("cat_i_rigid");
  const [volumeTons, setVolumeTons]     = useState("250");
  const [fiscalYear, setFiscalYear]     = useState("FY2026-27");
  const [simulateSpoof, setSimulateSpoof] = useState(false);

  // Runtime Orchestrator execution state
  const [running, setRunning]           = useState(false);
  const [runError, setRunError]         = useState<string | null>(null);
  const [latestRun, setLatestRun]       = useState<E2ERunResult | null>(null);
  const [runs, setRuns]                 = useState<E2ERunResult[]>([]);
  const [runsLoading, setRunsLoading]   = useState(true);

  // Liability & Marketplace state
  const [liability, setLiability]               = useState<LiabilityReport | null>(null);
  const [liabilityLoading, setLiabilityLoading] = useState(true);
  const [liabilityError, setLiabilityError]     = useState<string | null>(null);

  const [auctions, setAuctions]                 = useState<Auction[]>([]);
  const [pos, setPos]                           = useState<EscrowPO[]>([]);
  const [audits, setAudits]                     = useState<AuditVerdict[]>([]);
  const [auditsLoading, setAuditsLoading]       = useState(true);

  const auditPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 1. Fetch Engine Config ──────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    try {
      const cfg = await configSvc.getConfig();
      setConfig(cfg);
    } catch {
      // non-blocking
    }
  }, [configSvc]);

  // ── 2. Fetch Liability Report ───────────────────────────────────────────────
  const fetchLiability = useCallback(async () => {
    if (!companyId) return;
    setLiabilityLoading(true);
    setLiabilityError(null);
    try {
      const r = await liabilitySvc.getReport(companyId, fiscalYear);
      setLiability(r);
    } catch (e) {
      setLiabilityError(e instanceof ApiError ? e.message : "Failed to load corporate liability report");
    } finally {
      setLiabilityLoading(false);
    }
  }, [companyId, fiscalYear, liabilitySvc]);

  // ── 3. Fetch Compliance Runs ────────────────────────────────────────────────
  const fetchRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const runList = await complianceSvc.listRuns();
      setRuns(runList);
      if (runList.length > 0) {
        setLatestRun(runList[0]);
      }
    } catch {
      // non-blocking
    } finally {
      setRunsLoading(false);
    }
  }, [complianceSvc]);

  // ── 4. Fetch Audits, Auctions, Settlement POs ───────────────────────────────
  const fetchMarketAndAudits = useCallback(async () => {
    setAuditsLoading(true);
    try {
      const [verdictList, auctionList, poList] = await Promise.all([
        auditSvc.listVerdicts().catch(() => []),
        auctionSvc.listAuctions().catch(() => []),
        settlementSvc.listPOs().catch(() => []),
      ]);
      setAudits(verdictList);
      setAuctions(auctionList);
      setPos(poList);
    } catch {
      // non-blocking
    } finally {
      setAuditsLoading(false);
    }
  }, [auditSvc, auctionSvc, settlementSvc]);

  // Initial loads & polling
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    fetchLiability();
  }, [fetchLiability]);

  useEffect(() => {
    fetchRuns();
    fetchMarketAndAudits();
    auditPollRef.current = setInterval(fetchMarketAndAudits, 20_000);
    return () => {
      if (auditPollRef.current) clearInterval(auditPollRef.current);
    };
  }, [fetchRuns, fetchMarketAndAudits]);

  // ── Launch Full E2E Compliance Run ─────────────────────────────────────────
  const handleLaunch = async () => {
    if (!companyId) return;
    setRunning(true);
    setRunError(null);
    try {
      const result = await complianceSvc.runE2E({
        company_id: companyId,
        fiscal_year: fiscalYear,
        category,
        volume_tons: parseFloat(volumeTons) || 250.0,
        simulate_spoof: simulateSpoof,
      });
      setLatestRun(result);
      fetchRuns();
      fetchLiability();
      fetchMarketAndAudits();
    } catch (e) {
      setRunError(e instanceof ApiError ? e.message : "Compliance execution failed");
    } finally {
      setRunning(false);
    }
  };

  // ── Derived dynamic KPI values directly from live API responses ─────────────
  const grossTons       = liability?.current_year_liability_tons ?? null;
  const netDeficit      = liability?.net_liability_tons ?? null;
  const amortizedDebt   = liability?.amortized_debt_tons ?? null;

  // Escrow volume calculated from active POs
  const totalEscrowInr  = pos.reduce((sum, p) => sum + (p.total_amount_inr || 0), 0);

  // Verification confidence from actual audits
  const approvedAudits  = audits.filter((a) => a.audit_verdict === "APPROVED").length;
  const auditApprovalPct = audits.length > 0 ? Math.round((approvedAudits / audits.length) * 100) : null;

  // Dynamic Category Obligation Chart data from liability breakdown
  const categoryData = liability?.breakdown_by_category
    ? Object.entries(liability.breakdown_by_category).map(([key, tons]) => ({
        key,
        label: CATEGORY_LABELS[key] ?? key,
        tons: typeof tons === "number" ? tons : parseFloat(String(tons)) || 0,
        color: CATEGORY_COLORS[key] ?? "#6366f1",
      }))
    : [];

  const runInProgress = running || latestRun?.status === "RUNNING";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 5 }}>
      {/* ── Top System Engine Status Strip ──────────────────────────────────── */}
      <Card variant="outlined" sx={{ bgcolor: "rgba(15,23,42,0.6)", backdropFilter: "blur(8px)" }}>
        <CardContent sx={{ py: "12px !important", px: 2 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Chip
                icon={<SecurityIcon fontSize="small" />}
                label="Zero-Trust Architecture"
                size="small"
                color="primary"
                sx={{ fontWeight: 700 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                System 2: <strong style={{ color: "#f1f5f9" }}>{config?.gemini?.model ?? "Gemini 3.8 Flash"}</strong>
              </Typography>
              <Divider orientation="vertical" flexItem sx={{ height: 14, my: "auto" }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                System 1: <strong style={{ color: "#06b6d4" }}>{config?.jev_mode?.mode ?? "Physics Ensemble"}</strong>
              </Typography>
              <Divider orientation="vertical" flexItem sx={{ height: 14, my: "auto" }} />
              <Typography variant="caption" color="text.secondary">
                Torque Cutoff: ≥ {config?.jev_mode?.torque_threshold_nm ?? 8.0} Nm
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "success.main",
                  boxShadow: "0 0 6px #10b981",
                }}
              />
              <Typography variant="caption" color="success.light" fontWeight={600} fontFamily="monospace">
                Temporal: {config?.endpoints?.temporal_host ?? "Connected (localhost:7233)"}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ── Enterprise Hero & Autonomous Run Orchestration Cockpit ──────────── */}
      <Card
        sx={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,27,75,0.4) 100%)",
          border: "1px solid rgba(99,102,241,0.25)",
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Grid container spacing={3} alignItems="flex-start">
            {/* Title & Organization Info */}
            <Grid item xs={12} lg={6}>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                <Chip label={company?.name ?? "Enterprise PIBO Portal"} color="primary" size="small" sx={{ fontWeight: 700 }} />
                {company?.gstin && (
                  <Chip label={`GSTIN: ${company.gstin}`} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />
                )}
                {company?.industry_sector && (
                  <Chip label={company.industry_sector} size="small" variant="outlined" />
                )}
              </Box>

              <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em">
                Autonomous EPR Compliance & Anti-Fraud Engine
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1} sx={{ maxWidth: 560, lineHeight: 1.6 }}>
                Full-lifecycle execution: SAP sales record ingestion, 1/3 statutory debt amortization,
                continuous double auction matching, SCADA physics fraud detection, and CPCB Form-1 filing.
              </Typography>

              <Box sx={{ display: "flex", gap: 2, mt: 2.5, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    fetchLiability();
                    fetchRuns();
                    fetchMarketAndAudits();
                  }}
                >
                  Sync ERP & Ledgers
                </Button>
                <Button
                  variant="text"
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => router.push("/agents")}
                >
                  Agent Diagnostics
                </Button>
              </Box>
            </Grid>

            {/* Interactive Run Configuration & Launch Controls */}
            <Grid item xs={12} lg={6}>
              <Card
                variant="outlined"
                sx={{
                  bgcolor: "rgba(10,15,30,0.8)",
                  p: 2.5,
                  borderColor: simulateSpoof ? "rgba(244,63,94,0.4)" : "rgba(79,70,229,0.3)",
                }}
              >
                <Typography variant="subtitle2" fontWeight={700} mb={1.5} color="text.primary">
                  Launch Autonomous 5-Stage Compliance Pipeline
                </Typography>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Plastic Category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <MenuItem value="cat_i_rigid">Cat I — Rigid Plastic</MenuItem>
                      <MenuItem value="cat_ii_flexible">Cat II — Flexible Plastic</MenuItem>
                      <MenuItem value="cat_iii_mlp">Cat III — Multi-Layer Plastic</MenuItem>
                      <MenuItem value="cat_iv_compostable">Cat IV — Compostable Plastic</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Target Volume (Tons)"
                      type="number"
                      value={volumeTons}
                      onChange={(e) => setVolumeTons(e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Fiscal Year"
                      value={fiscalYear}
                      onChange={(e) => setFiscalYear(e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box
                      sx={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        px: 1.5,
                        border: "1px solid rgba(148,163,184,0.15)",
                        borderRadius: 1.5,
                        bgcolor: simulateSpoof ? "rgba(244,63,94,0.1)" : "transparent",
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={simulateSpoof}
                            onChange={(e) => setSimulateSpoof(e.target.checked)}
                            color="error"
                          />
                        }
                        label={
                          <Typography variant="caption" fontWeight={700} color={simulateSpoof ? "error.light" : "text.secondary"}>
                            {simulateSpoof ? "IoT Fraud Injected" : "Simulate SCADA Fraud"}
                          </Typography>
                        }
                        sx={{ m: 0 }}
                      />
                    </Box>
                  </Grid>
                </Grid>

                <Button
                  fullWidth
                  variant="contained"
                  color={simulateSpoof ? "error" : "primary"}
                  onClick={handleLaunch}
                  disabled={runInProgress || !companyId}
                  startIcon={runInProgress ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                  sx={{ mt: 2, py: 1.2, fontWeight: 700, fontSize: "0.9rem" }}
                >
                  {runInProgress
                    ? "Executing Multi-Agent Temporal Workflow…"
                    : simulateSpoof
                    ? "Execute E2E With Fraud Injection"
                    : "Execute E2E Autonomous Compliance Run"}
                </Button>

                {runInProgress && <LinearProgress color={simulateSpoof ? "error" : "primary"} sx={{ mt: 1.5 }} />}
                {runError && <Alert severity="error" sx={{ mt: 1.5 }}>{runError}</Alert>}
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Latest Run Execution Banner ──────────────────────────────────────── */}
      {runsLoading && !latestRun ? (
        <Skeleton variant="rounded" height={130} />
      ) : latestRun ? (
        <Card
          sx={{
            borderColor: latestRun.status === "HALTED_DUE_TO_FRAUD" ? "error.main" : "success.dark",
            borderWidth: 1,
            borderStyle: "solid",
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
              {latestRun.status === "HALTED_DUE_TO_FRAUD" ? (
                <ErrorIcon color="error" />
              ) : (
                <CheckCircleIcon color="success" />
              )}
              <Typography fontWeight={700} fontFamily="monospace" variant="subtitle1">
                {latestRun.run_id}
              </Typography>
              <Chip
                label={latestRun.status}
                size="small"
                color={latestRun.status === "HALTED_DUE_TO_FRAUD" ? "error" : "success"}
                sx={{ fontWeight: 700 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                Execution Time: {latestRun.duration_seconds}s
              </Typography>
              {latestRun.portal_ack_number && (
                <Chip
                  label={`CPCB ACK: ${latestRun.portal_ack_number}`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  sx={{ fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 700 }}
                />
              )}
              <Tooltip title="Inspect in Temporal UI">
                <IconButton size="small" href="http://localhost:8080/namespaces/default/workflows" target="_blank">
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Typography variant="body2" color="text.secondary" mb={2}>
              {latestRun.message}
            </Typography>

            {/* Stages Grid */}
            <Grid container spacing={1.5}>
              {latestRun.steps?.map((s) => (
                <Grid item xs={12} sm={6} md={12 / Math.max(latestRun.steps.length, 1)} key={s.step}>
                  <StageBadge step={s} />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      ) : null}

      {/* ── KPI Metrics Strip ─────────────────────────────────────────────────── */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="Gross Packaging Ingestion"
            value={grossTons != null ? grossTons.toLocaleString() : null}
            unit="Tons"
            subtitle={`${fiscalYear} ERP Sales Total`}
            icon={<ScaleIcon />}
            color="#4f46e5"
            loading={liabilityLoading}
            error={liabilityError}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="Net EPR Digital Deficit"
            value={netDeficit != null ? netDeficit.toLocaleString() : null}
            unit="Tons"
            subtitle="Obligation required under CPCB"
            icon={<WarningAmberIcon />}
            color="#f59e0b"
            loading={liabilityLoading}
            error={liabilityError}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="80/20 Escrow Commitments"
            value={totalEscrowInr > 0 ? `₹${(totalEscrowInr / 100000).toFixed(2)}` : "₹0"}
            unit="Lakhs"
            subtitle={`${pos.length} Escrow Purchase Orders`}
            icon={<MonetizationOnIcon />}
            color="#10b981"
            loading={false}
            error={null}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="SCADA Physics Verification"
            value={auditApprovalPct != null ? `${auditApprovalPct}%` : "—"}
            subtitle={`${approvedAudits} of ${audits.length} Audits Approved`}
            icon={<SpeedIcon />}
            color="#06b6d4"
            loading={auditsLoading}
            error={null}
          />
        </Grid>
      </Grid>

      {/* ── Category Breakdown & Live Audit Ledger ───────────────────────────── */}
      <Grid container spacing={2}>
        {/* Category Breakdown Chart */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    CPCB Obligation Breakdown by Plastic Category
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Calculated live under Plastic Waste Management Amendment Rules 2026
                  </Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => router.push("/liability")}>
                  Full Liability Model →
                </Button>
              </Box>

              {liabilityLoading ? (
                <Skeleton variant="rounded" height={220} />
              ) : liabilityError ? (
                <Alert severity="error">{liabilityError}</Alert>
              ) : categoryData.length === 0 ? (
                <Alert severity="info">No category data returned by ERP liability service.</Alert>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={categoryData} margin={{ left: -10, right: 10 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <RTooltip
                        contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: any) => [`${Number(v).toLocaleString()} Tons`, "Obligation"]}
                      />
                      <Bar dataKey="tons" radius={[4, 4, 0, 0]}>
                        {categoryData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {categoryData.map((cat) => {
                      const total = categoryData.reduce((s, c) => s + c.tons, 0) || 1;
                      const pct = Math.round((cat.tons / total) * 100);
                      return (
                        <Box key={cat.key}>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" fontWeight={600}>{cat.label}</Typography>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                              {cat.tons.toLocaleString()} Tons · {pct}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              mt: 0.5,
                              bgcolor: "rgba(255,255,255,0.06)",
                              "& .MuiLinearProgress-bar": { bgcolor: cat.color },
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Live Audit Verdicts Ledger */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    SCADA Telemetry & Forensic Audits
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Cryptographic proofs · Real-time feed
                  </Typography>
                </Box>
                <Tooltip title="Refresh ledger">
                  <IconButton size="small" onClick={fetchMarketAndAudits}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {auditsLoading && audits.length === 0 ? (
                [1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={60} sx={{ mb: 1.5 }} />)
              ) : audits.length === 0 ? (
                <Alert severity="info" sx={{ fontSize: "0.8rem" }}>
                  No forensic audits recorded yet.
                </Alert>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {audits.slice(0, 4).map((a) => {
                    const approved = a.audit_verdict === "APPROVED";
                    return (
                      <Card
                        key={a.audit_id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderColor: approved ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.25)",
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                          <Typography variant="caption" fontFamily="monospace" fontWeight={700}>
                            {a.audit_id}
                          </Typography>
                          <Chip
                            label={a.audit_verdict}
                            size="small"
                            color={approved ? "success" : "error"}
                            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {a.recycler_id} · {a.plant_id}
                        </Typography>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
                          <Typography variant="caption" color="text.secondary">
                            Confidence: {Math.round((a.confidence_score ?? 0) * 100)}%
                          </Typography>
                          <Typography variant="caption" color={approved ? "success.light" : "error.light"} fontWeight={600}>
                            {approved ? "Physical Melt Verified" : "Flagged Suspicious"}
                          </Typography>
                        </Box>
                      </Card>
                    );
                  })}
                </Box>
              )}

              <Button
                fullWidth
                size="small"
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={() => router.push("/audit")}
              >
                Open SCADA Oscilloscope Hub →
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Autonomous Workflow Gateway ──────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Autonomous EPR Workflow Infrastructure
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Durable micro-orchestrations executing through Temporal state machines
              </Typography>
            </Box>
            <Chip label="4 Core Workflows" size="small" color="primary" variant="outlined" />
          </Box>

          <Grid container spacing={2}>
            {[
              {
                id: 1,
                title: "Upstream Liability & Sourcing",
                desc: "1/3 historical debt amortization, ERP sales ingestion, and CPCB category allocation.",
                href: "/liability",
                metric: `${grossTons?.toLocaleString() ?? "—"} Tons Gross`,
                icon: <ScaleIcon color="primary" />,
              },
              {
                id: 2,
                title: "Continuous Double Auction",
                desc: "Autonomous treasury bids matching within 30%–100% statutory price corridor.",
                href: "/auction",
                metric: `${auctions.length} Active Market Auctions`,
                icon: <GavelIcon color="secondary" />,
              },
              {
                id: 3,
                title: "Quad-Core Fraud Audit",
                desc: "High-frequency SCADA/VFD torque analysis, energy enthalpy, and Jev reflex verification.",
                href: "/audit",
                metric: `${audits.length} Cryptographic Proofs`,
                icon: <SpeedIcon sx={{ color: "#10b981" }} />,
              },
              {
                id: 4,
                title: "80/20 Escrow & CPCB Form-1",
                desc: "Two-stage escrow gate: 80% advance upon audit, 20% release with CPCB ACK & DSC signature.",
                href: "/settlement",
                metric: `${pos.length} Escrow Purchase Orders`,
                icon: <DescriptionIcon sx={{ color: "#f59e0b" }} />,
              },
            ].map((wf) => (
              <Grid item xs={12} sm={6} md={3} key={wf.id}>
                <Card
                  variant="outlined"
                  onClick={() => router.push(wf.href)}
                  sx={{
                    cursor: "pointer",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      borderColor: "primary.main",
                      transform: "translateY(-2px)",
                      boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {wf.icon}
                        <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                          Workflow {wf.id}
                        </Typography>
                      </Box>
                      <ArrowForwardIcon fontSize="small" sx={{ color: "text.disabled" }} />
                    </Box>

                    <Typography variant="body2" fontWeight={700} mb={0.5}>
                      {wf.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                      {wf.desc}
                    </Typography>

                    <Chip
                      label={wf.metric}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.7rem", fontWeight: 600, width: "100%" }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
