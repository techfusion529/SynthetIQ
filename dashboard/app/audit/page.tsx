"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import CircularProgress from "@mui/material/CircularProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

import { useAuditService } from "../lib/hooks/useServices";
import { ApiError } from "../lib/services/base.service";
import type { ScadaLiveResponse, AuditVerdict } from "../lib/types/audit.types";

type SpoofMode = "GENUINE" | "RESISTIVE_SPOOF";

function GaugeCard({ label, value, unit, warning, good }: {
  label: string; value: number | null; unit: string; warning?: string; good?: boolean;
}) {
  const color = value == null ? "text.secondary" : good ? "success.main" : "error.main";
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="caption" textTransform="uppercase" letterSpacing="0.06em" color="text.secondary" fontWeight={600}>
          {label}
        </Typography>
        {value == null ? (
          <Skeleton variant="text" width="50%" height={40} sx={{ mt: 1 }} />
        ) : (
          <Typography variant="h4" fontWeight={700} fontFamily="monospace" sx={{ mt: 1, color }}>
            {value} <Typography component="span" variant="body2" color="text.secondary">{unit}</Typography>
          </Typography>
        )}
        {warning && value != null && (
          <Typography variant="caption" color={good ? "success.main" : "error.main"} fontWeight={600} display="flex" alignItems="center" gap={0.5} mt={0.5}>
            {good ? <CheckCircleIcon fontSize="inherit" /> : <WarningAmberIcon fontSize="inherit" />} {warning}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function AuditPage() {
  const router = useRouter();
  const auditSvc = useAuditService();

  const [mode, setMode]                 = useState<SpoofMode>("GENUINE");
  const [liveData, setLiveData]         = useState<ScadaLiveResponse | null>(null);
  const [streamPoints, setStreamPoints] = useState<{ t: number; nm: number }[]>([]);
  const [pollErrors, setPollErrors]     = useState(0);
  const [streamAlert, setStreamAlert]   = useState<string | null>(null);

  // Dynamic audit inputs (zero hardcoding)
  const [recyclerId, setRecyclerId]     = useState("RECYC-DELHI-01");
  const [plantId, setPlantId]           = useState("PLANT-OKHLA-2");
  const [category, setCategory]         = useState("cat_i_rigid");
  const [volumeTons, setVolumeTons]     = useState("250");

  const [auditing, setAuditing]         = useState(false);
  const [auditResult, setAuditResult]   = useState<AuditVerdict | null>(null);
  const [auditError, setAuditError]     = useState<string | null>(null);
  const [verdicts, setVerdicts]         = useState<AuditVerdict[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleIndex = useRef(0);

  const fetchVerdicts = useCallback(async () => {
    try {
      const v = await auditSvc.listVerdicts();
      setVerdicts(v);
    } catch {
      // non-critical
    }
  }, [auditSvc]);

  // Poll real SCADA telemetry directly from API
  const pollScada = useCallback(async () => {
    try {
      const data = await auditSvc.getLiveScada(mode);
      setLiveData(data);
      if (streamAlert) setStreamAlert(null);

      // True raw telemetry from API
      const torque = data.physics.torque_nm;
      sampleIndex.current += 1;
      setStreamPoints((prev) => {
        const next = [...prev, { t: sampleIndex.current, nm: Math.round(torque * 10) / 10 }];
        return next.length > 25 ? next.slice(next.length - 25) : next;
      });
    } catch {
      setPollErrors((p) => p + 1);
      setStreamAlert("SCADA telemetry stream offline or disconnected");
    }
  }, [mode, auditSvc, streamAlert]);

  useEffect(() => {
    setStreamPoints([]);
    sampleIndex.current = 0;
    setStreamAlert(null);
    setPollErrors(0);

    pollScada();
    fetchVerdicts();
    pollRef.current = setInterval(pollScada, 1200);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [mode, pollScada, fetchVerdicts]);

  const handleAudit = async () => {
    setAuditing(true);
    setAuditError(null);
    setAuditResult(null);
    try {
      const res = await auditSvc.triggerAudit({
        recycler_id: recyclerId.trim(),
        plant_id: plantId.trim(),
        category,
        volume_tons: parseFloat(volumeTons) || 250.0,
        simulate_spoof: mode === "RESISTIVE_SPOOF",
      });
      setAuditResult(res);
      fetchVerdicts();
    } catch (e) {
      setAuditError(e instanceof ApiError ? e.message : "Audit failed");
    } finally {
      setAuditing(false);
    }
  };

  const torqueNm    = liveData?.physics.torque_nm ?? null;
  const powerFactor = liveData?.physics.power_factor ?? null;
  const activePower = liveData?.physics.active_power_kw ?? null;
  const vfdFreq     = liveData?.physics.vfd_frequency_hz ?? null;

  const pfGood     = powerFactor != null ? powerFactor >= 0.78 && powerFactor <= 0.96 : undefined;
  const torqueGood = torqueNm != null ? torqueNm >= 8.0 : undefined;
  const isGenuine  = liveData ? !liveData.jev_evaluation.is_spoofed : mode === "GENUINE";
  const chartColor = isGenuine ? "#06b6d4" : "#f43f5e";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <Breadcrumbs>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/")}>
          Executive Hub
        </Link>
        <Typography color="primary.light" fontWeight={600}>
          Workflow 3 — Quad-Core Fraud Audit
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
            <Typography variant="h5" fontWeight={700}>Quad-Core Fraud Audit & Live SCADA Telemetry</Typography>
            <Chip label="Workflow 3" size="small" color="primary" />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Continuous real-time VFD telemetry inspection: VFD shaft torque, power factor physics, GST e-Way bills, and TypeSafe Jev reflexes.
          </Typography>
        </Box>

        {/* Telemetry Stream Mode Switcher */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>Telemetry Input Mode:</Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, val) => val && setMode(val)}
            size="small"
          >
            <ToggleButton value="GENUINE" sx={{ px: 2, fontSize: "0.75rem", fontWeight: 700 }}>
              Genuine Extrusion
            </ToggleButton>
            <ToggleButton value="RESISTIVE_SPOOF" sx={{ px: 2, fontSize: "0.75rem", fontWeight: 700, color: "error.main" }}>
              Resistive Spoof (Heaters)
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {streamAlert && <Alert severity="warning">{streamAlert}</Alert>}

      {mode === "RESISTIVE_SPOOF" && (
        <Alert severity="error" icon={<ErrorIcon />}>
          <strong>Fraud Injection Mode Active:</strong> Simulating uncoupled motor or space heaters attempting to generate fraudulent CPCB credits without physical polymer melting.
        </Alert>
      )}

      {/* Real-Time Physical Sensor Gauges */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <GaugeCard
            label="Viscous Screw Torque"
            value={torqueNm}
            unit="Nm"
            warning={torqueGood ? "Viscous Polymer Load Verified" : "Torque Below Threshold (≥8.0 Nm)"}
            good={torqueGood}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <GaugeCard
            label="Motor Power Factor"
            value={powerFactor}
            unit="cos φ"
            warning={pfGood ? "Inductive Motor Range (0.78–0.96)" : "Near-Unity / Resistive Spoof"}
            good={pfGood}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <GaugeCard
            label="Active Electrical Power"
            value={activePower}
            unit="kW"
            warning={activePower != null && activePower > 5 ? "Load Active" : "No Power"}
            good={activePower != null && activePower > 5}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <GaugeCard
            label="VFD Output Frequency"
            value={vfdFreq}
            unit="Hz"
            warning="Line Synchronized"
            good={true}
          />
        </Grid>
      </Grid>

      {/* Real-Time Oscilloscope */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: isGenuine ? "secondary.main" : "error.main",
                  boxShadow: `0 0 8px ${isGenuine ? "#06b6d4" : "#f43f5e"}`,
                }}
              />
              <Box>
                <Typography variant="subtitle1" fontWeight={700} fontFamily="monospace">
                  Live SCADA Extruder Screw Torque Telemetry (Nm)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  High-frequency physical load sensor feed · Minimum verification threshold: 8.0 Nm
                </Typography>
              </Box>
            </Box>
            <Chip
              label={isGenuine ? "GENUINE MECHANICAL MELT" : "SUSPICIOUS RESISTIVE LOAD"}
              size="small"
              color={isGenuine ? "success" : "error"}
              sx={{ fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 700 }}
            />
          </Box>

          <Box sx={{ height: 220, bgcolor: "#030712", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 2, p: 1 }}>
            {streamPoints.length === 0 ? (
              <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size={24} color="secondary" />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={streamPoints}>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={[0, 100]} tick={{ fill: "#475569", fontSize: 10 }} width={32} />
                  <RTooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 6, fontSize: 11 }}
                    formatter={(v: any) => [`${v} Nm`, "Torque"]}
                    labelFormatter={() => ""}
                  />
                  <ReferenceLine y={8} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "Min Threshold (8 Nm)", fill: "#f43f5e", fontSize: 10, position: "insideTopRight" }} />
                  <Line type="monotone" dataKey="nm" stroke={chartColor} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Audit Trigger & Verdicts */}
      <Grid container spacing={3}>
        {/* Trigger Panel */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Trigger Quad-Core Fraud Audit
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Run instantaneous zero-trust validation across SCADA, GST e-Way, and thermodynamic energy balance.
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  label="Recycler ID"
                  value={recyclerId}
                  onChange={(e) => setRecyclerId(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Plant ID / Extrusion Line"
                  value={plantId}
                  onChange={(e) => setPlantId(e.target.value)}
                  fullWidth
                />
                <TextField
                  select
                  label="Plastic Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  fullWidth
                >
                  <MenuItem value="cat_i_rigid">Category I — Rigid Plastic</MenuItem>
                  <MenuItem value="cat_ii_flexible">Category II — Flexible Plastic</MenuItem>
                  <MenuItem value="cat_iii_mlp">Category III — Multi-Layer Plastic</MenuItem>
                  <MenuItem value="cat_iv_compostable">Category IV — Compostable</MenuItem>
                </TextField>
                <TextField
                  label="Claimed Melt Volume (Tons)"
                  type="number"
                  value={volumeTons}
                  onChange={(e) => setVolumeTons(e.target.value)}
                  fullWidth
                />

                <Button
                  variant="contained"
                  color={mode === "RESISTIVE_SPOOF" ? "error" : "primary"}
                  startIcon={auditing ? <CircularProgress size={14} color="inherit" /> : <FlashOnIcon />}
                  onClick={handleAudit}
                  disabled={auditing}
                  sx={{ py: 1.2, fontWeight: 700 }}
                >
                  {auditing ? "Executing Quad-Core Forensic Audit…" : "Trigger Forensic Audit"}
                </Button>
              </Box>

              {auditError && <Alert severity="error" sx={{ mt: 2 }}>{auditError}</Alert>}
              {auditResult && (
                <Alert
                  severity={auditResult.audit_verdict === "APPROVED" ? "success" : "error"}
                  sx={{ mt: 2 }}
                >
                  <Typography variant="subtitle2" fontWeight={700}>
                    Verdict: {auditResult.audit_verdict}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Audit ID: {auditResult.audit_id} · Confidence: {Math.round((auditResult.confidence_score ?? 0) * 100)}%
                  </Typography>
                  {auditResult.audit_hash && (
                    <Typography variant="caption" display="block" fontFamily="monospace" sx={{ wordBreak: "break-all", mt: 0.5 }}>
                      SHA-256: {auditResult.audit_hash}
                    </Typography>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Audit Verdicts History */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Cryptographic Audit Verdict Ledger ({verdicts.length})
                </Typography>
                <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={fetchVerdicts}>
                  Refresh
                </Button>
              </Box>

              {verdicts.length === 0 ? (
                <Alert severity="info">No forensic audits recorded yet. Trigger an audit to create a verifiable record.</Alert>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {verdicts.map((v) => {
                    const approved = v.audit_verdict === "APPROVED";
                    return (
                      <Card
                        key={v.audit_id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderColor: approved ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)",
                          bgcolor: approved ? "rgba(16,185,129,0.03)" : "rgba(244,63,94,0.03)",
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {approved ? <CheckCircleIcon color="success" fontSize="small" /> : <ErrorIcon color="error" fontSize="small" />}
                              <Typography variant="subtitle2" fontWeight={700} fontFamily="monospace">
                                {v.audit_id}
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                              {v.recycler_id} · {v.plant_id} · {v.plastic_category} ({v.reported_volume_tons} T)
                            </Typography>
                          </Box>
                          <Chip
                            label={v.audit_verdict}
                            size="small"
                            color={approved ? "success" : "error"}
                            sx={{ fontWeight: 700 }}
                          />
                        </Box>
                        {v.audit_hash && (
                          <Typography variant="caption" fontFamily="monospace" color="text.secondary" display="block" sx={{ wordBreak: "break-all", mt: 1 }}>
                            Hash: {v.audit_hash}
                          </Typography>
                        )}
                      </Card>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
