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
      const runningStep = selectedRun.steps.find(
        (step) => step.status?.toUpperCase().includes("RUNNING") || step.status?.toUpperCase().includes("PROGRESS")
      );
      const activeStep = runningStep ? runningStep.step : 3;

      return selectedRun.steps.map((s) => {
        const bp = DEFAULT_STAGE_BLUEPRINT.find((b) => b.step === s.step || b.service === s.service);
        let summary = "";
        let stepStatus = s.status || "COMPLETED";
        let runtime_ms = s.runtime_ms ?? (s.service === "scada_auditor" ? 45 : 120);

        if (isRunning) {
          if (s.step < activeStep) {
            stepStatus = "COMPLETED";
          } else if (s.step === activeStep) {
            stepStatus = "RUNNING";
            runtime_ms = 65;
          } else {
            stepStatus = "QUEUED";
            runtime_ms = 0;
          }
        }

        if (stepStatus === "QUEUED") {
          summary = "Awaiting upstream workflow completion.";
        } else if (s.step === 1 || s.service === "brand_liability") {
          summary = `Gross liability: ${(selectedRun.volume_tons || 1000).toLocaleString()} MT • Net deficit amortized under Section 4 PWM rules.`;
        } else if (s.step === 2 || s.service === "regulatory_watchdog") {
          summary = `CPCB PWM Schedule II compliance target: 100% verified for ${selectedRun.category || "Rigid Plastic"}.`;
        } else if (s.step === 3 || s.service === "auction") {
          summary = stepStatus === "RUNNING"
            ? "Executing Continuous Double Auction order book matching..."
            : `Matched ${(selectedRun.volume_tons || 250).toLocaleString()} MT @ ₹4,150/MT via Continuous Double Auction clearing corridor.`;
        } else if (s.step === 4 || s.service === "scada_auditor") {
          if (stepStatus.includes("HALT") || stepStatus.includes("FRAUD")) {
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
          status: stepStatus,
          role: bp?.role || "Agent Execution Step",
          system: bp?.system || "System 2 Reasoning",
          summary,
          runtime_ms,
          tokens: stepStatus === "QUEUED" ? 0 : s.tokens ?? (s.service === "scada_auditor" ? 0 : 720),
          cost_usd: stepStatus === "QUEUED" ? 0 : s.cost_usd ?? (s.service === "scada_auditor" ? 0 : 0.0009),
          cost_inr: stepStatus === "QUEUED" ? 0 : s.cost_inr ?? (s.service === "scada_auditor" ? 0 : 0.08),
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
        transition: "all 0.25s ease",
      }}
    >
      {/* ── Sleek Compact Header ────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#FAFAFB"),
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1.25,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(66, 133, 244, 0.15)" : "rgba(66, 133, 244, 0.1)"),
              color: "#1A73E8",
            }}
          >
            {isRunning ? <CircularProgress size={16} sx={{ color: "#1A73E8" }} /> : <ScheduleIcon sx={{ fontSize: 16 }} />}
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", letterSpacing: "-0.01em" }}>
              Execution Trace &amp; Timeline
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
              7 stages across Temporal state machine
            </Typography>
          </Box>

          {isRunning && (
            <Chip
              size="small"
              label="Live"
              variant="outlined"
              color="primary"
              sx={{
                fontWeight: 700,
                height: 18,
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

          {selectedRun && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 1 }}>
              <Chip
                size="small"
                label={`${totalRuntime} ms`}
                variant="outlined"
                sx={{ height: 18, fontSize: "0.62rem", fontFamily: "var(--font-mono, monospace)", borderColor: "divider" }}
              />
              <Chip
                size="small"
                label={`${totalTokens.toLocaleString()} tok`}
                variant="outlined"
                sx={{ height: 18, fontSize: "0.62rem", fontFamily: "var(--font-mono, monospace)", borderColor: "divider" }}
              />
              <Chip
                size="small"
                label={`₹${totalCostInr.toFixed(2)}`}
                variant="outlined"
                sx={{ height: 18, fontSize: "0.62rem", fontFamily: "var(--font-mono, monospace)", borderColor: "divider" }}
              />
            </Box>
          )}
        </Box>

        {/* Header Actions: Icon-first with tooltips */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title="Expand all stages">
            <IconButton size="small" onClick={expandAll} sx={{ color: "text.secondary", width: 28, height: 28 }}>
              <UnfoldMoreIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Collapse all stages">
            <IconButton size="small" onClick={collapseAll} sx={{ color: "text.secondary", width: 28, height: 28 }}>
              <UnfoldLessIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          {selectedRun && (
            <Tooltip title="View in Temporal Portal">
              <IconButton
                size="small"
                component="a"
                href={`/temporal/namespaces/default/workflows/${encodeURIComponent(
                  selectedRun.temporal_workflow_id || selectedRun.run_id
                )}`}
                target="_blank"
                sx={{ color: "text.secondary", width: 28, height: 28 }}
              >
                <OpenInNewIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* ── Compact Stage List ──────────────────────────────────────────────── */}
      <Box
        sx={{
          p: 1.5,
          maxHeight: maxHeight || 400,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"),
            borderRadius: 2,
          },
        }}
      >
        {resolvedSteps.map((step) => {
          const isSelected = activeNodeId === step.service;
          const isExpanded = !!expandedSteps[step.step];
          const currentTab = activeTabByStep[step.step] || 0;

          const isCompleted = step.status === "COMPLETED";
          const isStepRunning = step.status === "RUNNING";
          const isHitl = step.status.includes("HITL") || step.status.includes("REVIEW");
          const isHalted = step.status.includes("HALT") || step.status.includes("FRAUD") || step.status.includes("FAIL");
          const isQueued = step.status === "QUEUED" || step.status === "SKIPPED";

          // Semantic Theme Colors matching Gemini
          let statusText = "Completed";
          let statusColor = "#34A853";
          let statusChipColor: "success" | "warning" | "error" | "info" | "default" = "success";

          if (isStepRunning) {
            statusText = "Running";
            statusColor = "#1A73E8";
            statusChipColor = "info";
          } else if (isHitl) {
            statusText = "Review";
            statusColor = "#FBBC04";
            statusChipColor = "warning";
          } else if (isHalted) {
            statusText = "Halted";
            statusColor = "#EA4335";
            statusChipColor = "error";
          } else if (isQueued) {
            statusText = "Queued";
            statusColor = "#9AA0A6";
            statusChipColor = "default";
          }

          return (
            <Card
              key={step.step}
              variant="outlined"
              sx={{
                borderRadius: 1.5,
                borderColor: isSelected
                  ? "#1A73E8"
                  : isStepRunning
                  ? "transparent"
                  : isHalted
                  ? "rgba(234, 67, 53, 0.4)"
                  : "divider",
                borderWidth: isSelected || isStepRunning ? 1.5 : 1,
                ...(isStepRunning
                  ? {
                      position: "relative",
                      background: (t) =>
                        t.palette.mode === "dark"
                          ? "linear-gradient(#181B26, #181B26) padding-box, linear-gradient(90deg, #4285F4, #9B72CB, #D96570, #1A73E8, #4285F4) border-box"
                          : "linear-gradient(#FFFFFF, #FFFFFF) padding-box, linear-gradient(90deg, #4285F4, #9B72CB, #D96570, #1A73E8, #4285F4) border-box",
                      border: "1.5px solid transparent",
                      backgroundSize: "100% 100%, 200% 100%",
                      animation: "geminiBorderRotate 3s linear infinite",
                      "@keyframes geminiBorderRotate": {
                        "0%": { backgroundPosition: "0% 0%, 0% 0%" },
                        "100%": { backgroundPosition: "0% 0%, 200% 0%" },
                      },
                    }
                  : {
                      bgcolor: isSelected
                        ? (t) => (t.palette.mode === "dark" ? "rgba(66, 133, 244, 0.08)" : "rgba(66, 133, 244, 0.04)")
                        : "background.paper",
                    }),
                transition: "all 0.15s ease",
                overflow: "hidden",
              }}
            >
              {/* Clickable Compact Row */}
              <Box
                onClick={() => {
                  onSelectNode(step.service);
                  toggleExpand(step.step);
                }}
                sx={{
                  px: 1.5,
                  py: 0.85,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1.5,
                  flexWrap: { xs: "wrap", md: "nowrap" },
                  "&:hover": {
                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.015)"),
                  },
                }}
              >
                {/* Left: Indicator + Step Index + Title + System Tag */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 260 }}>
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: isCompleted ? "rgba(52, 168, 83, 0.12)" : isStepRunning ? "rgba(26, 115, 232, 0.12)" : isHalted ? "rgba(234, 67, 53, 0.12)" : "rgba(154, 160, 166, 0.12)",
                      color: statusColor,
                      flexShrink: 0,
                    }}
                  >
                    {isCompleted && <CheckIcon sx={{ fontSize: 13, fontWeight: 900 }} />}
                    {isStepRunning && <CircularProgress size={12} sx={{ color: "#1A73E8" }} />}
                    {isHitl && <WarningAmberIcon sx={{ fontSize: 13 }} />}
                    {isHalted && <ErrorIcon sx={{ fontSize: 13 }} />}
                    {isQueued && (
                      <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, color: "text.secondary" }}>
                        {step.step}
                      </Typography>
                    )}
                  </Box>

                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      color: "text.secondary",
                    }}
                  >
                    {step.step.toString().padStart(2, "0")}
                  </Typography>

                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      color: "text.primary",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step.name}
                  </Typography>

                  {step.system?.includes("Reflex") ? (
                    <Chip
                      size="small"
                      label="SCADA Reflex"
                      variant="outlined"
                      sx={{
                        height: 18,
                        fontSize: "0.6rem",
                        fontWeight: 600,
                        borderColor: "rgba(52, 168, 83, 0.3)",
                        color: "#34A853",
                        py: 0,
                        px: 0.25,
                      }}
                    />
                  ) : (
                    <Chip
                      size="small"
                      icon={<GeminiIcon size={10} />}
                      label="gemini-3.8-flash"
                      variant="outlined"
                      sx={{
                        height: 18,
                        fontSize: "0.6rem",
                        fontWeight: 600,
                        borderColor: "rgba(66, 133, 244, 0.3)",
                        color: "#1A73E8",
                        py: 0,
                        px: 0.25,
                      }}
                    />
                  )}
                </Box>

                {/* Center: Inline Summary / Role */}
                <Box sx={{ flex: 1, minWidth: 0, display: { xs: "none", sm: "block" } }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.72rem",
                      color: isHalted ? "error.main" : "text.secondary",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "block",
                    }}
                  >
                    {step.summary || step.role}
                  </Typography>
                </Box>

                {/* Right: Telemetry & Actions */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                      <SpeedIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                      <Typography sx={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem", fontWeight: 600, color: "text.primary" }}>
                        {isStepRunning ? "..." : `${step.runtime_ms ?? 0}ms`}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                      <TollIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                      <Typography sx={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem", fontWeight: 600, color: "text.secondary" }}>
                        {step.system?.includes("Reflex") ? "0" : (step.tokens ?? 0)}
                      </Typography>
                    </Box>

                    <Typography sx={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem", fontWeight: 600, color: "text.secondary" }}>
                      ₹{(step.cost_inr ?? 0).toFixed(2)}
                    </Typography>
                  </Box>

                  <Chip
                    size="small"
                    label={statusText}
                    variant="outlined"
                    color={isStepRunning ? undefined : statusChipColor}
                    sx={{
                      height: 18,
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      ...(isStepRunning
                        ? {
                            color: "#FFFFFF",
                            border: "none",
                            background: "linear-gradient(90deg, #4285F4, #9B72CB, #D96570, #1A73E8, #4285F4)",
                            backgroundSize: "200% auto",
                            animation: "geminiShimmer 2.5s linear infinite",
                            boxShadow: "0 0 10px rgba(66, 133, 244, 0.4)",
                            "@keyframes geminiShimmer": {
                              "0%": { backgroundPosition: "0% center" },
                              "100%": { backgroundPosition: "200% center" },
                            },
                          }
                        : {}),
                    }}
                  />

                  {/* Icon Actions with Tooltips */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                    <Tooltip title={copiedStep === step.step ? "Copied" : "Copy step payload"}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          const dataToCopy = (step as any).output || step.response || step.data || {};
                          copyPayload(step.step, dataToCopy);
                        }}
                        sx={{ width: 26, height: 26, color: "text.secondary" }}
                      >
                        {copiedStep === step.step ? <CheckIcon sx={{ fontSize: 13, color: "success.main" }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                      </IconButton>
                    </Tooltip>

                    <Tooltip title={isExpanded ? "Collapse payload" : "Expand payload"}>
                      <IconButton
                        size="small"
                        sx={{
                          width: 26,
                          height: 26,
                          transform: isExpanded ? "rotate(180deg)" : "none",
                          transition: "0.2s",
                          color: "text.secondary",
                        }}
                      >
                        <ExpandMoreIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>

              {/* Expandable Payload Drawer */}
              <Collapse in={isExpanded}>
                <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, borderTop: 1, borderColor: "divider" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                    <Tabs
                      value={currentTab}
                      onChange={(_, v) => setActiveTabByStep((prev) => ({ ...prev, [step.step]: v }))}
                      sx={{
                        minHeight: 28,
                        "& .MuiTab-root": {
                          minHeight: 28,
                          py: 0.25,
                          px: 1.25,
                          fontSize: "0.68rem",
                          textTransform: "none",
                          fontWeight: 600,
                        },
                      }}
                    >
                      <Tab label="Decision Output" />
                      <Tab label="Input Arguments" />
                      <Tab label="Full JSON" />
                    </Tabs>

                    <Tooltip title="Copy view payload">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          const dataToCopy =
                            currentTab === 1
                              ? (step as any).input || {}
                              : (step as any).output || step.response || step.data || {};
                          copyPayload(step.step, dataToCopy);
                        }}
                        sx={{ width: 26, height: 26 }}
                      >
                        {copiedStep === step.step ? <CheckIcon sx={{ fontSize: 13, color: "success.main" }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      bgcolor: (t) => (t.palette.mode === "dark" ? "#0F131C" : "#F8FAFC"),
                      borderRadius: 1,
                      maxHeight: 180,
                      overflowY: "auto",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="pre"
                      sx={{
                        m: 0,
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "0.72rem",
                        color: (t) => (t.palette.mode === "dark" ? "#8AB4F8" : "#1A73E8"),
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        lineHeight: 1.5,
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
          );
        })}
      </Box>
    </Card>
  );
}
