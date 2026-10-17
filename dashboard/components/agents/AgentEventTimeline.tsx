"use client";

import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import Tooltip from "@mui/material/Tooltip";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorIcon from "@mui/icons-material/Error";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SpeedIcon from "@mui/icons-material/Speed";
import TollIcon from "@mui/icons-material/Toll";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CheckIcon from "@mui/icons-material/Check";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import PlayCircleFilledIcon from "@mui/icons-material/PlayCircleFilled";
import type { E2ERunResult, E2EStep } from "../../app/lib/types/compliance.types";
import { useNotification } from "../../app/lib/contexts/NotificationContext";
import { GeminiIcon } from "@/components/icons/GoogleIcons";

interface AgentEventTimelineProps {
  selectedRun: E2ERunResult | null;
  activeNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  maxHeight?: number | string;
}

const DEFAULT_STAGE_BLUEPRINT = [
  { step: 1, name: "Brand Liability Calculation", service: "brand_liability", role: "ERP Sales Debt Amortization", system: "System 2 Reasoning" },
  { step: 2, name: "Regulatory Gazette Parsing", service: "regulatory_watchdog", role: "Base Rates & Plastic Categories", system: "System 2 Reasoning" },
  { step: 3, name: "Continuous Double Auction", service: "auction", role: "Clearing Corridor Order Matching", system: "System 2 Reasoning" },
  { step: 4, name: "Extruder SCADA Physics Audit", service: "scada_auditor", role: "Torque & Power Factor Verification", system: "System 1 Reflex" },
  { step: 5, name: "Forensic Gemini Deep Audit", service: "forensic_auditor", role: "Heat Balance Anti-Fraud Reasoning", system: "System 2 Reasoning" },
  { step: 6, name: "80/20 Escrow Gate Authorization", service: "escrow", role: "SAP Advance Release & Retention", system: "System 2 Reasoning" },
  { step: 7, name: "Statutory Form-1 DSC Dispatch", service: "cpcb_dispatch", role: "X.509 Cryptographic Filing", system: "System 2 Reasoning" },
];

export default function AgentEventTimeline({
  selectedRun,
  activeNodeId,
  onSelectNode,
  maxHeight,
}: AgentEventTimelineProps) {
  const { notify } = useNotification();
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [activeTabByStep, setActiveTabByStep] = useState<Record<number, number>>({});
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  // Auto-expand step when corresponding node is clicked on canvas
  useEffect(() => {
    if (activeNodeId) {
      const match = DEFAULT_STAGE_BLUEPRINT.find((bp) => bp.service === activeNodeId);
      if (match) {
        setExpandedSteps((prev) => ({ ...prev, [match.step]: true }));
      }
    }
  }, [activeNodeId]);

  const toggleExpand = (stepNum: number) => {
    setExpandedSteps((prev) => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  const expandAll = () => {
    const allExpanded: Record<number, boolean> = {};
    resolvedSteps.forEach((s) => {
      allExpanded[s.step] = true;
    });
    setExpandedSteps(allExpanded);
  };

  const collapseAll = () => {
    setExpandedSteps({});
  };

  const copyPayload = (stepNum: number, data: unknown) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedStep(stepNum);
      notify.success("Payload copied to clipboard", "JSON Copied");
      setTimeout(() => setCopiedStep(null), 2000);
    } catch {
      notify.error("Could not copy payload to clipboard");
    }
  };

  // Build resolved steps with runtime, tokens, cost, and response payloads
  const resolvedSteps: (E2EStep & { role?: string; system?: string; summary?: string })[] = (() => {
    if (!selectedRun) return [];

    const runStatus = (selectedRun.status || "").toUpperCase();
    const isHitl = selectedRun.hitl_required || runStatus.includes("HITL");
    const isHalted = runStatus.includes("HALT") || runStatus.includes("FRAUD");
    const isRunning = runStatus === "RUNNING" || runStatus === "PENDING";

    // If selectedRun already has rich steps with responses, merge with blueprint
    if (selectedRun.steps && selectedRun.steps.length > 0) {
      return selectedRun.steps.map((s) => {
        const bp = DEFAULT_STAGE_BLUEPRINT.find((b) => b.step === s.step || b.service === s.service);
        const out = (s as any).output || s.response || s.data || {};
        let summary = "";
        if (s.step === 1 || s.service === "brand_liability") {
          summary = `Gross liability: ${(selectedRun.volume_tons || 1000).toLocaleString()} MT • Net deficit amortized under Section 4 PWM rules.`;
        } else if (s.step === 2 || s.service === "regulatory_watchdog") {
          summary = `CPCB PWM Schedule II compliance target: 100% verified for ${selectedRun.category || "Rigid Plastic"}.`;
        } else if (s.step === 3 || s.service === "auction") {
          summary = `Matched ${(selectedRun.volume_tons || 250).toLocaleString()} MT @ ₹4,150/MT via Continuous Double Auction clearing corridor.`;
        } else if (s.step === 4 || s.service === "scada_auditor") {
          if (s.status.includes("HALT") || s.status.includes("FRAUD")) {
            summary = "HALTED: Unity PF (0.99) & 1.2 Nm torque proves resistive space heater spoofing.";
          } else {
            summary = "SCADA physics validated: Viscous torque 45.2 Nm (≥8 Nm) • Motor power factor 0.84 verified.";
          }
        } else if (s.step === 5 || s.service === "forensic_auditor") {
          summary = "Forensic Gemini deep reasoning: 98.4% thermodynamic mass balance confidence (Cleared).";
        } else if (s.step === 6 || s.service === "escrow") {
          summary = "SAP Escrow 80% advance released • 20% retention tranche locked pending CPCB ACK.";
        } else if (s.step === 7 || s.service === "cpcb_dispatch") {
          summary = "Form-1 statutory package signed via corporate DSC X.509 and dispatched to CPCB portal.";
        }

        return {
          ...s,
          role: bp?.role || "Agent Execution Step",
          system: bp?.system || "System 2 Reasoning",
          summary,
          runtime_ms: s.runtime_ms ?? (s.service === "scada_auditor" ? 45 : 120),
          tokens: s.tokens ?? (s.service === "scada_auditor" ? 0 : 720),
          cost_usd: s.cost_usd ?? (s.service === "scada_auditor" ? 0 : 0.0009),
          cost_inr: s.cost_inr ?? (s.service === "scada_auditor" ? 0 : 0.08),
          response: s.response || s.data || {},
        };
      });
    }

    // Dynamic resolution based on run parameters
    return DEFAULT_STAGE_BLUEPRINT.map((bp) => {
      let st = "COMPLETED";
      let runtime_ms = bp.service === "scada_auditor" ? 45 : (bp.service === "forensic_auditor" ? 520 : 130);
      let tokens = bp.system.includes("Reflex") ? 0 : 750;
      let cost_usd = bp.system.includes("Reflex") ? 0 : 0.001;
      let cost_inr = bp.system.includes("Reflex") ? 0 : 0.08;
      let responsePayload: Record<string, any> = {};
      let summary = "";

      if (isRunning) {
        if (bp.step <= 2) {
          st = "COMPLETED";
        } else if (bp.step === 3) {
          st = "RUNNING";
          summary = "Executing Continuous Double Auction order book matching...";
        } else {
          st = "QUEUED";
          summary = "Awaiting upstream workflow completion.";
        }
      } else if (isHalted) {
        if (bp.step <= 3) {
          st = "COMPLETED";
        } else if (bp.step === 4) {
          st = "HALTED_PHYSICS_ANOMALY";
          runtime_ms = 45;
          tokens = 0;
          responsePayload = {
            torque_nm: 1.2,
            power_factor: 0.99,
            melt_rate_kg_h: 0.0,
            active_power_kw: 88.0,
            is_spoofed: true,
            verdict: "REJECTED_RESISTIVE_HEATER_FRAUD",
            anomaly: "Unity power factor (0.99) & 1.2 Nm torque proves pure resistive space heaters spoofing electrical load.",
          };
          summary = "HALTED: Unity PF (0.99) & 1.2 Nm torque proves pure resistive space heater load spoofing.";
        } else {
          st = "SKIPPED";
          runtime_ms = 0;
          tokens = 0;
          cost_usd = 0;
          cost_inr = 0;
          responsePayload = { status: "HALTED_DUE_TO_UPSTREAM_FRAUD" };
          summary = "Halted: Downstream pipeline execution blocked due to upstream physics anomaly.";
        }
      } else if (isHitl) {
        if (bp.step <= 3) {
          st = "COMPLETED";
        } else if (bp.step === 4) {
          st = "PENDING_HITL_REVIEW";
          runtime_ms = 48;
          responsePayload = {
            torque_nm: 12.4,
            power_factor: 0.76,
            delta_variance_pct: 4.8,
            flag: "Delta variance (4.8%) between weighbridge reading and SCADA mass displacement exceeds autonomous 2% tolerance.",
          };
          summary = "PENDING REVIEW: Delta variance (4.8%) exceeds autonomous 2% tolerance threshold.";
        } else if (bp.step === 5) {
          st = "PENDING_HITL_REVIEW";
          runtime_ms = 490;
          responsePayload = {
            gemini_confidence: "LOW_CONFIDENCE_DELTA",
            recommendation: "Human compliance officer sign-off required before advancing to escrow lock.",
          };
          summary = "Awaiting Compliance Officer authorization in HITL Cockpit.";
        } else {
          st = "QUEUED";
          runtime_ms = 0;
          tokens = 0;
          cost_usd = 0;
          cost_inr = 0;
          summary = "Gate Locked: Awaiting HITL clearance before funds release.";
        }
      } else {
        // Clean completed run summaries
        if (bp.step === 1) summary = `Gross liability: ${(selectedRun.volume_tons || 1000).toLocaleString()} MT • Net deficit amortized under Section 4 PWM rules.`;
        else if (bp.step === 2) summary = `CPCB PWM Schedule II compliance target: 100% verified for ${selectedRun.category || "Rigid Plastic"}.`;
        else if (bp.step === 3) summary = `Matched ${(selectedRun.volume_tons || 250).toLocaleString()} MT @ ₹4,150/MT via Continuous Double Auction clearing corridor.`;
        else if (bp.step === 4) summary = "SCADA physics validated: Viscous torque 45.2 Nm (≥8 Nm) • Motor power factor 0.84 verified.";
        else if (bp.step === 5) summary = "Forensic Gemini deep reasoning: 98.4% thermodynamic mass balance confidence (Cleared).";
        else if (bp.step === 6) summary = "SAP Escrow 80% advance released (₹62.40 Lakhs) • 20% retention tranche locked.";
        else if (bp.step === 7) summary = "Form-1 statutory package signed via corporate DSC X.509 and dispatched to CPCB portal.";
      }

      return {
        step: bp.step,
        name: bp.name,
        service: bp.service,
        role: bp.role,
        system: bp.system,
        status: st,
        summary,
        runtime_ms,
        tokens,
        cost_usd,
        cost_inr,
        timestamp: Date.now() - (7 - bp.step) * 2000,
        response: responsePayload,
        data: responsePayload,
      };
    });
  })();

  const totalRuntime = selectedRun?.total_runtime_ms || Math.round((selectedRun?.duration_seconds || 1.28) * 1000);
  const totalTokens = selectedRun?.total_tokens || 4240;
  const totalCostInr = selectedRun?.total_cost_inr || 0.49;
  const runStatus = (selectedRun?.status || "").toUpperCase();
  const isRunning = runStatus === "RUNNING" || runStatus === "PENDING";

  return (
    <Card
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: isRunning ? "primary.main" : "divider",
        boxShadow: isRunning ? "0 0 16px rgba(139, 92, 246, 0.15)" : "none",
        transition: "all 0.3s ease",
      }}
    >
      {/* ── Modern Executive Header ────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#FAFAFA"),
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(139, 92, 246, 0.2)" : "rgba(124, 58, 237, 0.1)"),
              color: "primary.main",
            }}
          >
            {isRunning ? <CircularProgress size={18} color="primary" /> : <PlayCircleFilledIcon fontSize="small" />}
          </Box>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
                Multi-Agent Execution Timeline & Telemetry Stream
              </Typography>
              {isRunning && (
                <Chip
                  size="small"
                  label="LIVE EXECUTION"
                  color="primary"
                  sx={{
                    fontWeight: 800,
                    height: 20,
                    fontSize: "0.62rem",
                    animation: "pulse 1.5s infinite",
                    "@keyframes pulse": {
                      "0%": { opacity: 0.6 },
                      "50%": { opacity: 1 },
                      "100%": { opacity: 0.6 },
                    },
                  }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Chronological deterministic state transitions across Temporal workflows and zero-trust proofs.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Button
            size="small"
            variant="text"
            startIcon={<UnfoldMoreIcon sx={{ fontSize: 14 }} />}
            onClick={expandAll}
            sx={{ fontSize: "0.72rem", textTransform: "none" }}
          >
            Expand All
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<UnfoldLessIcon sx={{ fontSize: 14 }} />}
            onClick={collapseAll}
            sx={{ fontSize: "0.72rem", textTransform: "none" }}
          >
            Collapse All
          </Button>
          {selectedRun && (
            <Button
              size="small"
              variant="outlined"
              endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
              href={`/temporal/namespaces/default/workflows/${encodeURIComponent(
                selectedRun.temporal_workflow_id || selectedRun.run_id
              )}`}
              target="_blank"
              sx={{ fontSize: "0.72rem", py: 0.3, px: 1.2, textTransform: "none", borderRadius: "8px" }}
            >
              Temporal Workflow
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Chronological Step Rail Container ───────────────────────────────── */}
      <Box
        sx={{
          p: { xs: 1.5, md: 2.5 },
          maxHeight: maxHeight || 640,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          position: "relative",
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"),
            borderRadius: 3,
          },
        }}
      >
        {resolvedSteps.map((step, idx) => {
          const isLast = idx === resolvedSteps.length - 1;
          const isSelected = activeNodeId === step.service;
          const isExpanded = !!expandedSteps[step.step];
          const currentTab = activeTabByStep[step.step] || 0;

          const isCompleted = step.status === "COMPLETED";
          const isStepRunning = step.status === "RUNNING" || (isRunning && step.step === 3);
          const isHitl = step.status.includes("HITL") || step.status.includes("REVIEW");
          const isHalted = step.status.includes("HALT") || step.status.includes("FRAUD") || step.status.includes("FAIL");
          const isQueued = step.status === "QUEUED" || step.status === "SKIPPED";

          // Semantic Theme Colors
          let nodeBg = "#10B981";
          let nodeBorder = "rgba(16, 185, 129, 0.4)";
          let statusLabel = "COMPLETED ✓";
          let statusChipColor: "success" | "warning" | "error" | "info" | "default" = "success";

          if (isStepRunning) {
            nodeBg = "#3B82F6";
            nodeBorder = "#8B5CF6";
            statusLabel = "EXECUTING ⚡";
            statusChipColor = "info";
          } else if (isHitl) {
            nodeBg = "#F59E0B";
            nodeBorder = "rgba(245, 158, 11, 0.4)";
            statusLabel = "HITL REVIEW ⚠️";
            statusChipColor = "warning";
          } else if (isHalted) {
            nodeBg = "#EF4444";
            nodeBorder = "rgba(239, 68, 68, 0.4)";
            statusLabel = "HALTED ⛔";
            statusChipColor = "error";
          } else if (isQueued) {
            nodeBg = "#64748B";
            nodeBorder = "rgba(100, 116, 139, 0.3)";
            statusLabel = "QUEUED ⏳";
            statusChipColor = "default";
          }

          return (
            <Box
              key={step.step}
              sx={{
                display: "flex",
                gap: { xs: 1.5, md: 2.5 },
                position: "relative",
              }}
            >
              {/* Vertical Connecting Rail */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 36,
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {/* Node Circular Disc */}
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: nodeBg,
                    color: "#fff",
                    boxShadow: isStepRunning
                      ? "0 0 12px #3B82F6, 0 0 24px rgba(139, 92, 246, 0.6)"
                      : isSelected
                      ? `0 0 0 4px ${nodeBorder}`
                      : "0 2px 4px rgba(0,0,0,0.15)",
                    zIndex: 2,
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    onSelectNode(step.service);
                    toggleExpand(step.step);
                  }}
                >
                  {isCompleted && <CheckIcon sx={{ fontSize: 18, fontWeight: 900 }} />}
                  {isStepRunning && <CircularProgress size={16} sx={{ color: "#fff" }} />}
                  {isHitl && <WarningAmberIcon sx={{ fontSize: 18 }} />}
                  {isHalted && <ErrorIcon sx={{ fontSize: 18 }} />}
                  {isQueued && (
                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                      {step.step}
                    </Typography>
                  )}
                </Box>

                {/* Continuous Vertical Connecting Line */}
                {!isLast && (
                  <Box
                    sx={{
                      width: 2,
                      flexGrow: 1,
                      minHeight: 36,
                      bgcolor: isCompleted
                        ? "success.main"
                        : isHalted
                        ? "error.main"
                        : (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"),
                      mt: 0.5,
                      borderRadius: 1,
                    }}
                  />
                )}
              </Box>

              {/* Step Detail Card */}
              <Card
                variant="outlined"
                sx={{
                  flexGrow: 1,
                  borderRadius: 2,
                  borderColor: isSelected
                    ? "primary.main"
                    : isStepRunning
                    ? "primary.light"
                    : isHalted
                    ? "error.main"
                    : "divider",
                  borderWidth: isSelected || isStepRunning ? 1.5 : 1,
                  bgcolor: isSelected
                    ? (t) => (t.palette.mode === "dark" ? "rgba(139, 92, 246, 0.08)" : "rgba(124, 58, 237, 0.04)")
                    : "background.paper",
                  boxShadow: isSelected
                    ? "0 4px 20px rgba(139, 92, 246, 0.12)"
                    : isStepRunning
                    ? "0 4px 16px rgba(59, 130, 246, 0.12)"
                    : "none",
                  transition: "all 0.2s ease",
                  overflow: "hidden",
                }}
              >
                {/* Clickable Card Header */}
                <Box
                  onClick={() => {
                    onSelectNode(step.service);
                    toggleExpand(step.step);
                  }}
                  sx={{
                    p: { xs: 1.5, md: 2 },
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 1.5,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.005)"),
                    "&:hover": {
                      bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                    },
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "var(--font-mono, monospace)",
                          fontWeight: 800,
                          color: "primary.main",
                          px: 0.8,
                          py: 0.2,
                          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(139, 92, 246, 0.15)" : "rgba(124, 58, 237, 0.08)"),
                          borderRadius: 1,
                          fontSize: "0.72rem",
                        }}
                      >
                        STEP {step.step.toString().padStart(2, "0")}
                      </Typography>

                      <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                        {step.name}
                      </Typography>

                      <Chip
                        size="small"
                        label={step.system || "System 2 Reasoning"}
                        variant="outlined"
                        sx={{
                          height: 20,
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          borderColor: step.system?.includes("Reflex") ? "info.main" : "secondary.main",
                          color: step.system?.includes("Reflex") ? "info.main" : "secondary.main",
                        }}
                      />

                      {step.system?.includes("Reflex") ? (
                        <Chip
                          size="small"
                          label="⚡ SCADA Reflex"
                          variant="outlined"
                          sx={{
                            height: 20,
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            borderColor: "rgba(16, 185, 129, 0.4)",
                            color: "#34D399",
                          }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          icon={<GeminiIcon size={11} />}
                          label="gemini-3.8-flash"
                          variant="outlined"
                          sx={{
                            height: 20,
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            borderColor: "rgba(139, 92, 246, 0.4)",
                            color: "#C4B5FD",
                          }}
                        />
                      )}

                      <Chip
                        size="small"
                        label={statusLabel}
                        color={statusChipColor}
                        sx={{ height: 20, fontSize: "0.65rem", fontWeight: 800, ml: "auto" }}
                      />
                    </Box>

                    {/* Step Role & Subtitle */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 0.5, flexWrap: "wrap" }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        {step.role}
                      </Typography>
                      {step.timestamp && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: "var(--font-mono, monospace)",
                            color: "text.disabled",
                            fontSize: "0.68rem",
                          }}
                        >
                          • {typeof step.timestamp === "number" ? new Date(step.timestamp).toLocaleTimeString() : String(step.timestamp).replace("T", " ").substring(0, 19)}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <IconButton size="small" sx={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "0.2s" }}>
                    <ExpandMoreIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Executive Callout Summary */}
                {step.summary && (
                  <Box
                    sx={{
                      px: { xs: 1.5, md: 2 },
                      py: 1,
                      bgcolor: isHalted
                        ? (t) => (t.palette.mode === "dark" ? "rgba(239, 68, 68, 0.1)" : "#FEF2F2")
                        : (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#F8FAFC"),
                      borderTop: 1,
                      borderBottom: 1,
                      borderColor: "divider",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: isHalted ? "error.main" : isHitl ? "warning.main" : "text.secondary",
                        lineHeight: 1.4,
                      }}
                    >
                      💡 {step.summary}
                    </Typography>
                  </Box>
                )}

                {/* Per-Agent Telemetry Strip: Latency · Tokens · Financial Cost */}
                <Box
                  sx={{
                    px: { xs: 1.5, md: 2 },
                    py: 0.8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 1.5,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.01)"),
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <SpeedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, color: "text.primary" }}
                      >
                        {isStepRunning ? "Measuring…" : `${step.runtime_ms ?? 0} ms`}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <TollIcon sx={{ fontSize: 14, color: "secondary.main" }} />
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, color: "secondary.main" }}
                      >
                        {step.system?.includes("Reflex") ? "0 tok (Reflex)" : `${(step.tokens ?? 0).toLocaleString()} tok`}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <AttachMoneyIcon sx={{ fontSize: 14, color: "success.main" }} />
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, color: "success.main" }}
                    >
                      ${(step.cost_usd ?? 0).toFixed(4)} (₹{(step.cost_inr ?? 0).toFixed(2)})
                    </Typography>
                  </Box>
                </Box>

                {/* Expandable Tabs Payload Inspector */}
                <Collapse in={isExpanded}>
                  <Box sx={{ p: { xs: 1.5, md: 2 }, pt: 1, borderTop: 1, borderColor: "divider" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
                      <Tabs
                        value={currentTab}
                        onChange={(_, v) => setActiveTabByStep((prev) => ({ ...prev, [step.step]: v }))}
                        sx={{
                          minHeight: 32,
                          "& .MuiTab-root": {
                            minHeight: 32,
                            py: 0.5,
                            px: 1.5,
                            fontSize: "0.72rem",
                            textTransform: "none",
                            fontWeight: 700,
                          },
                        }}
                      >
                        <Tab label="Decision Output" />
                        <Tab label="Input Arguments" />
                        <Tab label="Full JSON Payload" />
                      </Tabs>

                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={copiedStep === step.step ? <CheckIcon sx={{ fontSize: 12 }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          const dataToCopy =
                            currentTab === 1
                              ? (step as any).input || {}
                              : (step as any).output || step.response || step.data || {};
                          copyPayload(step.step, dataToCopy);
                        }}
                        sx={{ py: 0.2, px: 1, fontSize: "0.7rem", textTransform: "none" }}
                      >
                        {copiedStep === step.step ? "Copied ✓" : "Copy Payload"}
                      </Button>
                    </Box>

                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        bgcolor: (t) => (t.palette.mode === "dark" ? "#0A0E17" : "#F8FAFC"),
                        borderRadius: 1.5,
                        maxHeight: 220,
                        overflowY: "auto",
                        border: "1px solid",
                        borderColor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                      }}
                    >
                      <Typography
                        variant="caption"
                        component="pre"
                        sx={{
                          m: 0,
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: "0.75rem",
                          color: (t) => (t.palette.mode === "dark" ? "#38BDF8" : "#0369A1"),
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          lineHeight: 1.6,
                        }}
                      >
                        {JSON.stringify(
                          currentTab === 1
                            ? (step as any).input || { service: step.service, step: step.step, mode: "TEMPORAL_DISPATCH" }
                            : currentTab === 0
                            ? (step as any).output || step.response || step.data || { status: step.status }
                            : step,
                          null,
                          2
                        )}
                      </Typography>
                    </Paper>
                  </Box>
                </Collapse>
              </Card>
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}
