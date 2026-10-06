"use client";

import React, { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import MemoryIcon from "@mui/icons-material/Memory";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import HubIcon from "@mui/icons-material/Hub";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useRouter } from "next/navigation";
import { useComplianceService, useConfigService, useAuditService } from "../lib/hooks/useServices";
import { ApiError } from "../lib/services/base.service";
import type { E2ERunResult, E2EStep } from "../lib/types/compliance.types";
import type { SystemConfig } from "../lib/types/config.types";
import type { AuditVerdict } from "../lib/types/audit.types";

export default function AgentsPage() {
  const router = useRouter();
  const complianceSvc = useComplianceService();
  const configSvc     = useConfigService();
  const auditSvc      = useAuditService();

  const [runs, setRuns]           = useState<E2ERunResult[]>([]);
  const [config, setConfig]       = useState<SystemConfig | null>(null);
  const [verdicts, setVerdicts]   = useState<AuditVerdict[]>([]);
  const [selectedRun, setSelectedRun] = useState<E2ERunResult | null>(null);

  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

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
      if (runsList.length > 0 && !selectedRun) {
        setSelectedRun(runsList[0]);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load orchestrator data");
    } finally {
      setLoading(false);
    }
  }, [complianceSvc, configSvc, auditSvc, selectedRun]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <Breadcrumbs>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/")}>
          Executive Hub
        </Link>
        <Typography color="primary.light" fontWeight={600}>
          Agent Orchestration & Temporal Engine
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SmartToyIcon color="primary" /> Multi-Agent Orchestration & Temporal Telemetry
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Zero-trust state machine coordinating System 2 LLM reasoning, TypeSafe Jev physics reflexes, and ERP transactions.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
          disabled={loading}
        >
          Refresh State
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Engine Architecture Grid */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: "16px !important" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  System 2 Reasoning
                </Typography>
                <Chip label="Vertex AI" size="small" color="primary" sx={{ fontSize: "0.65rem", height: 20 }} />
              </Box>
              <Typography variant="body1" fontWeight={700} fontFamily="monospace">
                {config?.gemini?.model || "Gemini 3.8 Flash"}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Key: {config?.gemini?.api_key_masked || "Configured via ADC/Env"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: "16px !important" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  System 1 Reflex
                </Typography>
                <Chip label="Physics Audit" size="small" color="secondary" sx={{ fontSize: "0.65rem", height: 20 }} />
              </Box>
              <Typography variant="body1" fontWeight={700} fontFamily="monospace">
                {config?.jev_mode?.mode || "NIMBLE_PRIMARY"}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Torque ≥ {config?.jev_mode?.torque_threshold_nm ?? 8.0} Nm · PF {config?.jev_mode?.power_factor_range?.join("–") ?? "0.78–0.96"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: "16px !important" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
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
              <Typography variant="body1" fontWeight={700} fontFamily="monospace">
                {config?.endpoints?.temporal_host || "localhost:7233"}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Durable Workflow Queue: epr-compliance
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: "16px !important" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
                  Active Audits & Runs
                </Typography>
                <Chip label={`${runs.length} Runs`} size="small" color="info" sx={{ fontSize: "0.65rem", height: 20 }} />
              </Box>
              <Typography variant="body1" fontWeight={700} fontFamily="monospace">
                {verdicts.length} Verdicts Logged
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Continuous zero-trust attestation
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Runs & Steps Section */}
      <Grid container spacing={3}>
        {/* Runs List */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Autonomous Compliance Runs
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Executed multi-agent workflow instances
              </Typography>

              {loading ? (
                <CircularProgress size={24} />
              ) : runs.length === 0 ? (
                <Alert severity="info">No compliance runs executed yet. Launch a run from the Executive Hub.</Alert>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {runs.map((r) => {
                    const isSelected = selectedRun?.run_id === r.run_id;
                    const isSuccess = r.status === "SUCCESS_FULLY_COMPLIANT";
                    return (
                      <Card
                        key={r.run_id}
                        variant="outlined"
                        onClick={() => setSelectedRun(r)}
                        sx={{
                          cursor: "pointer",
                          p: 1.5,
                          borderColor: isSelected ? "primary.main" : "divider",
                          bgcolor: isSelected ? "rgba(79,70,229,0.08)" : undefined,
                          "&:hover": { borderColor: "primary.light" },
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                            {r.run_id}
                          </Typography>
                          <Chip
                            label={r.status}
                            size="small"
                            color={isSuccess ? "success" : "error"}
                            sx={{ height: 18, fontSize: "0.65rem" }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {r.company_id} · {r.category || "cat_i_rigid"} ({r.volume_tons || 250} T)
                        </Typography>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Duration: {r.duration_seconds}s
                          </Typography>
                          <Typography variant="caption" color="primary.light" fontWeight={600}>
                            {r.steps?.length ?? 0} Steps →
                          </Typography>
                        </Box>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Selected Run Details & Stage Execution */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              {selectedRun ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="h6" fontWeight={700} fontFamily="monospace">
                          {selectedRun.run_id}
                        </Typography>
                        <Chip
                          label={selectedRun.status}
                          size="small"
                          color={selectedRun.status === "SUCCESS_FULLY_COMPLIANT" ? "success" : "error"}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" mt={0.5}>
                        {selectedRun.message}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      href="/temporal/namespaces/default/workflows"
                      target="_blank"
                    >
                      Temporal UI
                    </Button>
                  </Box>

                  <Divider />

                  {/* Stage-by-Stage Agent Execution Pipeline */}
                  <Typography variant="subtitle2" fontWeight={700}>
                    Durable Workflow Execution Stages ({selectedRun.steps?.length || 0})
                  </Typography>

                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {selectedRun.steps?.map((step: E2EStep) => (
                      <Card
                        key={step.step}
                        variant="outlined"
                        sx={{
                          p: 2,
                          bgcolor: "rgba(255,255,255,0.02)",
                          borderColor: step.status === "COMPLETED" ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)",
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            {step.status === "COMPLETED" ? (
                              <CheckCircleIcon color="success" fontSize="small" />
                            ) : (
                              <ErrorIcon color="error" fontSize="small" />
                            )}
                            <Typography variant="body2" fontWeight={700}>
                              Stage {step.step}: {step.name}
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                            <Chip label={step.service} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 20 }} />
                            <Chip
                              label={step.status}
                              size="small"
                              color={step.status === "COMPLETED" ? "success" : "error"}
                              sx={{ fontSize: "0.65rem", height: 20 }}
                            />
                          </Box>
                        </Box>

                        {/* Live Step Payload Data */}
                        <Box sx={{ mt: 1, p: 1.5, bgcolor: "rgba(0,0,0,0.3)", borderRadius: 1.5 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mb={0.5}>
                            Verified Agent Output:
                          </Typography>
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              fontSize: "0.75rem",
                              fontFamily: "monospace",
                              color: "#38bdf8",
                              overflowX: "auto",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                            }}
                          >
                            {JSON.stringify(step.data, null, 2)}
                          </Box>
                        </Box>
                      </Card>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Alert severity="info">Select a compliance run on the left to inspect its multi-agent telemetry.</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
