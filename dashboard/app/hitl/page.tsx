"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import InfoIcon from "@mui/icons-material/Info";
import PageHeader from "@/components/ui/PageHeader";

import { useHitlService } from "../lib/hooks/useServices";
import { useSession } from "../lib/contexts/SessionContext";
import { ApiError } from "../lib/services/base.service";
import type { HITLRun, HITLRunDetail } from "../lib/types/hitl.types";
import { REASON_CODES } from "../lib/types/hitl.types";

/** Format elapsed time since a given ISO timestamp. */
function elapsed(since: string | null): string {
  if (!since) return "—";
  const diffMs = Date.now() - new Date(since).getTime();
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  return `${minutes}m ago`;
}

/** Format a date string for display. */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

/** Status chip color helper. */
function statusColor(
  status: string
): "default" | "success" | "error" | "warning" | "info" {
  switch (status.toUpperCase()) {
    case "COMPLETED":
      return "success";
    case "RUNNING":
      return "info";
    case "FAILED":
      return "error";
    case "HITL_PENDING":
      return "warning";
    case "CANCELLED":
      return "default";
    default:
      return "default";
  }
}

export default function HitlPage() {
  const router = useRouter();
  const hitlSvc = useHitlService();
  const { user } = useSession();

  const [runs, setRuns] = useState<HITLRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<HITLRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Resolution form state
  const [reasonCode, setReasonCode] = useState("");
  const [overrideTons, setOverrideTons] = useState("");
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveSuccess, setResolveSuccess] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    setRunsError(null);
    try {
      const data = await hitlSvc.listHitlRuns(50);
      setRuns(data);
    } catch (e) {
      setRunsError(e instanceof ApiError ? e.message : "Failed to load HITL runs");
    } finally {
      setRunsLoading(false);
    }
  }, [hitlSvc]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    setResolveError(null);
    setResolveSuccess(null);
    setReasonCode("");
    setOverrideTons("");
    setNotes("");

    hitlSvc
      .getRun(selectedRunId)
      .then((data) => setSelectedRun(data))
      .catch((e) =>
        setDetailError(e instanceof ApiError ? e.message : "Failed to load run detail")
      )
      .finally(() => setDetailLoading(false));
  }, [selectedRunId, hitlSvc]);

  const handleResolve = async () => {
    if (!selectedRun || !user) return;
    setResolving(true);
    setResolveError(null);
    setResolveSuccess(null);

    // Extract audit_id from input_params if available
    const auditId =
      (selectedRun.input_params?.audit_id as string | undefined) ?? "";

    try {
      await hitlSvc.resolveHitl({
        run_id: selectedRun.run_id,
        audit_id: auditId,
        reason_code: reasonCode,
        override_tons: overrideTons ? parseFloat(overrideTons) : undefined,
        notes,
        resolver_id: user.user_id,
      });
      setResolveSuccess("Resolution submitted successfully.");
      // Refresh list
      loadRuns();
    } catch (e) {
      setResolveError(e instanceof ApiError ? e.message : "Resolution failed");
    } finally {
      setResolving(false);
    }
  };

  // Derived values from selected run
  const auditResult = selectedRun?.input_params?.audit_result as
    | Record<string, unknown>
    | undefined;
  const deltaPercent =
    auditResult?.delta_percent != null
      ? String(auditResult.delta_percent)
      : null;
  const secActual =
    auditResult?.sec_actual != null ? String(auditResult.sec_actual) : null;
  const secBaseline =
    auditResult?.sec_baseline != null
      ? String(auditResult.sec_baseline)
      : null;
  const chainHead =
    (selectedRun?.input_params?.chain_head as string | undefined) ?? null;
  const stageReached =
    selectedRun?.input_params?.stage_reached != null
      ? Number(selectedRun.input_params.stage_reached)
      : null;

  const stageLabel = (stage: number): string => {
    const labels: Record<number, string> = {
      1: "Data Ingestion",
      2: "SCADA Telemetry",
      3: "GST e-Way Validation",
      4: "Thermodynamic Balance",
      5: "Cryptographic Audit",
      6: "HITL Review",
    };
    return labels[stage] ?? `Stage ${stage}`;
  };

  // Four-eyes guard: form is only shown when resolver != submitter
  const isSameUser =
    user?.user_id != null &&
    selectedRun?.triggered_by != null &&
    user.user_id === selectedRun.triggered_by;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <PageHeader
        title="HITL Console"
        tags={<Chip label="Human-in-the-Loop" size="small" color="warning" sx={{ borderRadius: "2px", height: 20, fontSize: "0.68rem", fontWeight: 700 }} />}
        description="Review and resolve workflow runs that require human approval before processing can continue."
      />

      <Grid container spacing={3}>
        {/* Left pane — run list */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  HITL Pending Runs
                </Typography>
                <Button size="small" variant="outlined" onClick={loadRuns}>
                  Refresh
                </Button>
              </Box>

              {runsError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {runsError}
                </Alert>
              )}

              {runsLoading ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} variant="rounded" height={80} />
                  ))}
                </Box>
              ) : runs.length === 0 ? (
                <Alert severity="info">
                  No HITL-pending runs found. All workflows are running
                  automatically.
                </Alert>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {runs.map((run) => (
                    <Card
                      key={run.run_id}
                      variant="outlined"
                      onClick={() => setSelectedRunId(run.run_id)}
                      sx={{
                        cursor: "pointer",
                        borderColor:
                          selectedRunId === run.run_id
                            ? "primary.main"
                            : "divider",
                        bgcolor:
                          selectedRunId === run.run_id
                            ? "rgba(79,70,229,0.08)"
                            : "transparent",
                        "&:hover": { bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" },
                        transition: "border-color 0.15s, background-color 0.15s",
                      }}
                    >
                      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                        <Typography
                          variant="caption"
                          fontFamily="monospace"
                          fontWeight={700}
                          display="block"
                          sx={{ wordBreak: "break-all" }}
                        >
                          {run.run_id}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          mt={0.25}
                        >
                          {run.org_id}
                        </Typography>
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            alignItems: "center",
                            mt: 0.75,
                          }}
                        >
                          <Chip
                            label={run.status}
                            size="small"
                            color={statusColor(run.status)}
                            sx={{ fontWeight: 700, fontSize: "0.65rem" }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {fmtDate(run.started_at)}
                          </Typography>
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          mt={0.25}
                        >
                          {elapsed(run.started_at)}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right pane — run detail & resolution form */}
        <Grid item xs={12} md={8}>
          {!selectedRunId ? (
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 300,
                }}
              >
                <Typography color="text.secondary">
                  Select a pending run from the list to review and resolve it.
                </Typography>
              </CardContent>
            </Card>
          ) : detailLoading ? (
            <Card variant="outlined">
              <CardContent>
                <Skeleton variant="text" width="40%" height={32} />
                <Skeleton variant="rounded" height={120} sx={{ mt: 2 }} />
                <Skeleton variant="rounded" height={80} sx={{ mt: 2 }} />
              </CardContent>
            </Card>
          ) : detailError ? (
            <Alert severity="error">{detailError}</Alert>
          ) : selectedRun ? (
            <Card variant="outlined">
              <CardContent>
                {/* Run header */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    mb: 2,
                  }}
                >
                  <Box>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      fontFamily="monospace"
                    >
                      {selectedRun.run_id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedRun.org_id} · {selectedRun.workflow_type} ·
                      Triggered by {selectedRun.triggered_by}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                      label={selectedRun.status}
                      size="small"
                      color={statusColor(selectedRun.status)}
                      sx={{ fontWeight: 700 }}
                    />
                    {selectedRun.temporal_status && (
                      <Chip
                        label={`Temporal: ${selectedRun.temporal_status}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 600, fontSize: "0.65rem" }}
                      />
                    )}
                  </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Audit metrics */}
                {(deltaPercent || secActual || secBaseline || chainHead) && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="caption"
                      textTransform="uppercase"
                      letterSpacing="0.08em"
                      color="text.secondary"
                      fontWeight={700}
                      display="block"
                      mb={1}
                    >
                      Audit Metrics
                    </Typography>
                    <Grid container spacing={1.5}>
                      {deltaPercent && (
                        <Grid item xs={6} sm={4}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Delta %
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              fontFamily="monospace"
                            >
                              {deltaPercent}%
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                      {secActual && (
                        <Grid item xs={6} sm={4}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              SEC Actual
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              fontFamily="monospace"
                            >
                              {secActual}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                      {secBaseline && (
                        <Grid item xs={6} sm={4}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              SEC Baseline
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              fontFamily="monospace"
                            >
                              {secBaseline}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                      {chainHead && (
                        <Grid item xs={12}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Chain Head Hash
                            </Typography>
                            <Typography
                              variant="caption"
                              fontFamily="monospace"
                              display="block"
                              sx={{ wordBreak: "break-all" }}
                            >
                              {chainHead}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                )}

                {/* Stage history */}
                {stageReached != null && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="caption"
                      textTransform="uppercase"
                      letterSpacing="0.08em"
                      color="text.secondary"
                      fontWeight={700}
                      display="block"
                      mb={0.75}
                    >
                      Stage Reached
                    </Typography>
                    <Chip
                      label={`Stage ${stageReached} — ${stageLabel(stageReached)}`}
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 700 }}
                    />
                  </Box>
                )}

                {selectedRun.error_message && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="caption" fontFamily="monospace">
                      {selectedRun.error_message}
                    </Typography>
                  </Alert>
                )}

                <Divider sx={{ mb: 2 }} />

                {/* Resolution form — four-eyes guard */}
                <Typography
                  variant="caption"
                  textTransform="uppercase"
                  letterSpacing="0.08em"
                  color="text.secondary"
                  fontWeight={700}
                  display="block"
                  mb={1.5}
                >
                  Resolution Decision
                </Typography>

                {isSameUser ? (
                  <Alert severity="info" icon={<InfoIcon />}>
                    Four-eyes policy: You submitted this run and cannot resolve
                    it. Another authorised user must review and resolve.
                  </Alert>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <TextField
                      select
                      label="Reason Code"
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                      fullWidth
                      required
                    >
                      {REASON_CODES.map((code) => (
                        <MenuItem key={code} value={code}>
                          {code.replace(/_/g, " ")}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      label="Override Volume (Tons)"
                      type="number"
                      value={overrideTons}
                      onChange={(e) => setOverrideTons(e.target.value)}
                      fullWidth
                      helperText="max 10% override allowed"
                      inputProps={{ step: "0.01" }}
                    />

                    <TextField
                      label="Resolution Notes"
                      multiline
                      minRows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      fullWidth
                      placeholder="Describe the reason for this resolution decision…"
                    />

                    {resolveError && (
                      <Alert severity="error">{resolveError}</Alert>
                    )}
                    {resolveSuccess && (
                      <Alert severity="success">{resolveSuccess}</Alert>
                    )}

                    <Button
                      variant="contained"
                      color="warning"
                      onClick={handleResolve}
                      disabled={resolving || !reasonCode}
                      startIcon={
                        resolving ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : undefined
                      }
                      sx={{ py: 1.2, fontWeight: 700, alignSelf: "flex-start" }}
                    >
                      {resolving ? "Submitting Resolution…" : "Submit Resolution"}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          ) : null}
        </Grid>
      </Grid>
    </Box>
  );
}
