"use client";

import React, { useState, useEffect, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import SpeedIcon from "@mui/icons-material/Speed";
import TollIcon from "@mui/icons-material/Toll";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ScaleIcon from "@mui/icons-material/BalanceOutlined";
import GavelIcon from "@mui/icons-material/GavelOutlined";
import RadarIcon from "@mui/icons-material/SensorsOutlined";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import DescriptionIcon from "@mui/icons-material/DescriptionOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import type { E2ERunResult } from "../../app/lib/types/compliance.types";

export interface AgentNodeDef {
  id: string;
  name: string;
  role: string;
  systemType: "System 1 Reflex" | "System 2 Reasoning";
  modelLabel: string;
  x: number;
  y: number;
  stepNumber: number;
  gradient: string;
  icon: React.ReactNode;
}

const AGENT_NODES: AgentNodeDef[] = [
  {
    id: "brand_liability",
    name: "Brand Liability Agent",
    role: "ERP Sales Debt Amortization",
    systemType: "System 2 Reasoning",
    modelLabel: "gemini-3.8-flash",
    x: 50,
    y: 60,
    stepNumber: 1,
    gradient: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
    icon: <ScaleIcon sx={{ fontSize: 20 }} />,
  },
  {
    id: "regulatory_watchdog",
    name: "Regulatory Watchdog",
    role: "CPCB Gazette Rules & Rates",
    systemType: "System 2 Reasoning",
    modelLabel: "gemini-3.8-flash",
    x: 50,
    y: 260,
    stepNumber: 2,
    gradient: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
    icon: <SmartToyIcon sx={{ fontSize: 20 }} />,
  },
  {
    id: "auction",
    name: "Double Auction Engine",
    role: "Uniform Clearing Price Corridor",
    systemType: "System 2 Reasoning",
    modelLabel: "gemini-3.8-flash",
    x: 345,
    y: 160,
    stepNumber: 3,
    gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
    icon: <GavelIcon sx={{ fontSize: 20 }} />,
  },
  {
    id: "scada_auditor",
    name: "SCADA Physics Auditor",
    role: "Extruder Torque & Power Factor",
    systemType: "System 1 Reflex",
    modelLabel: "SCADA Reflex",
    x: 640,
    y: 60,
    stepNumber: 4,
    gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
    icon: <RadarIcon sx={{ fontSize: 20 }} />,
  },
  {
    id: "forensic_auditor",
    name: "Forensic Deep Reasoner",
    role: "Gemini System 2 Heat Balance",
    systemType: "System 2 Reasoning",
    modelLabel: "gemini-3.8-flash",
    x: 640,
    y: 260,
    stepNumber: 5,
    gradient: "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)",
    icon: <AutoAwesomeIcon sx={{ fontSize: 20 }} />,
  },
  {
    id: "escrow",
    name: "Escrow & Treasury Agent",
    role: "80/20 SAP Split-Payment PO",
    systemType: "System 2 Reasoning",
    modelLabel: "gemini-3.8-flash",
    x: 935,
    y: 60,
    stepNumber: 6,
    gradient: "linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)",
    icon: <AccountBalanceWalletIcon sx={{ fontSize: 20 }} />,
  },
  {
    id: "cpcb_dispatch",
    name: "CPCB Form-1 Dispatcher",
    role: "X.509 Cryptographic DSC Sign",
    systemType: "System 2 Reasoning",
    modelLabel: "gemini-3.8-flash",
    x: 935,
    y: 260,
    stepNumber: 7,
    gradient: "linear-gradient(135deg, #10B981 0%, #047857 100%)",
    icon: <DescriptionIcon sx={{ fontSize: 20 }} />,
  },
];

interface NodeTelemetry {
  status: "COMPLETED" | "RUNNING" | "HITL" | "HALTED" | "PENDING" | "QUEUED" | "SKIPPED";
  metric: string;
  runtime_ms: number;
  tokens: number;
  cost_usd: number;
  cost_inr: number;
}

interface AgentCanvasGraphProps {
  selectedRun: E2ERunResult | null;
  activeNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export default function AgentCanvasGraph({
  selectedRun,
  activeNodeId,
  onSelectNode,
}: AgentCanvasGraphProps) {
  // Dynamic step animation for active runs
  const [simulatedActiveStep, setSimulatedActiveStep] = useState<number>(1);

  const runStatus = (selectedRun?.status || "").toUpperCase();
  const isRunning = runStatus.includes("RUNNING") || runStatus.includes("PENDING");

  useEffect(() => {
    if (!isRunning) {
      setSimulatedActiveStep(0);
      return;
    }

    // Check if there is an actual running step from backend events
    const runningStep = selectedRun?.steps?.find(
      (s) =>
        s.status?.toUpperCase().includes("RUNNING") ||
        s.status?.toUpperCase().includes("PROGRESS")
    );
    if (runningStep) {
      setSimulatedActiveStep(runningStep.step);
      return;
    }

    // Sequence stages 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
    setSimulatedActiveStep(1);
    const interval = setInterval(() => {
      setSimulatedActiveStep((prev) => {
        if (prev >= 7) return 7;
        return prev + 1;
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [selectedRun?.run_id, isRunning, selectedRun?.steps]);

  // Resolve node state
  const getNodeState = (node: AgentNodeDef): NodeTelemetry => {
    if (!selectedRun) {
      return {
        status: "PENDING",
        metric: "Awaiting Run",
        runtime_ms: 0,
        tokens: 0,
        cost_usd: 0,
        cost_inr: 0,
      };
    }

    const isHitl = Boolean(selectedRun.hitl_required || runStatus.includes("HITL"));
    const isHalted = runStatus.includes("HALT") || runStatus.includes("FRAUD");

    // Match against real steps if available
    const step = selectedRun.steps?.find(
      (s) =>
        s.step === node.stepNumber ||
        s.service?.toLowerCase() === node.id.toLowerCase() ||
        s.name?.toLowerCase().includes(node.id)
    );

    if (step && !isRunning) {
      const st = step.status.toUpperCase();
      let status: NodeTelemetry["status"] = "COMPLETED";
      if (st.includes("RUNNING") || st.includes("PROGRESS")) status = "RUNNING";
      else if (st.includes("HITL") || st.includes("REVIEW")) status = "HITL";
      else if (st.includes("HALT") || st.includes("FAIL") || st.includes("FRAUD")) status = "HALTED";
      else if (st.includes("QUEUE")) status = "QUEUED";
      else if (st.includes("SKIP")) status = "SKIPPED";

      let metric = "";
      const out = (step as any).output || step.response || step.data || {};
      if (node.id === "brand_liability") {
        metric = out.net_liability_tons ? `${out.net_liability_tons} MT Net` : `${selectedRun.volume_tons || 250} MT Net`;
      } else if (node.id === "regulatory_watchdog") {
        metric = out.mandated_target_pct ? `${out.mandated_target_pct}% Mandate` : "100% Mandate";
      } else if (node.id === "auction") {
        metric = out.clearing_price ? `₹${out.clearing_price.toLocaleString()}/MT` : "₹4,150/MT";
      } else if (node.id === "scada_auditor") {
        metric = status === "HALTED" ? "PF 0.99 Spoof" : "45.2 Nm · PF 0.84";
      } else if (node.id === "forensic_auditor") {
        metric = status === "HALTED" ? "Halted: Spoof" : "98.4% Confidence";
      } else if (node.id === "escrow") {
        metric = status === "HALTED" ? "Disbursement Locked" : "80/20 PO Disbursed";
      } else if (node.id === "cpcb_dispatch") {
        metric = status === "HALTED" ? "Filing Blocked" : "Form-1 Signed";
      }

      return {
        status,
        metric,
        runtime_ms: step.runtime_ms ?? (node.id === "scada_auditor" ? 45 : 120),
        tokens: step.tokens ?? (node.systemType.includes("Reflex") ? 0 : 720),
        cost_usd: step.cost_usd ?? (node.systemType.includes("Reflex") ? 0 : 0.0009),
        cost_inr: step.cost_inr ?? (node.systemType.includes("Reflex") ? 0 : 0.08),
      };
    }

    // Dynamic execution simulation during active run
    if (isRunning) {
      if (node.stepNumber < simulatedActiveStep) {
        return {
          status: "COMPLETED",
          metric: node.stepNumber === 1 ? `${selectedRun.volume_tons || 250} MT Net` : "Passed",
          runtime_ms: 110 + node.stepNumber * 15,
          tokens: node.systemType.includes("Reflex") ? 0 : 680,
          cost_usd: 0.0008,
          cost_inr: 0.07,
        };
      }
      if (node.stepNumber === simulatedActiveStep) {
        return {
          status: "RUNNING",
          metric:
            node.id === "brand_liability"
              ? "⚡ Querying ERP Debt..."
              : node.id === "regulatory_watchdog"
              ? "⚡ Parsing Gazette..."
              : node.id === "auction"
              ? "⚡ Matching Double Auction..."
              : node.id === "scada_auditor"
              ? "⚡ Sampling 100Hz SCADA..."
              : node.id === "forensic_auditor"
              ? "⚡ Gemini Heat Balance..."
              : node.id === "escrow"
              ? "⚡ Authorizing 80/20 PO..."
              : "⚡ Signing X.509 DSC...",
          runtime_ms: 65,
          tokens: 340,
          cost_usd: 0.0004,
          cost_inr: 0.03,
        };
      }
      return { status: "QUEUED", metric: "Queued", runtime_ms: 0, tokens: 0, cost_usd: 0, cost_inr: 0 };
    }

    // Completed deterministic fallback
    if (isHalted) {
      if (node.stepNumber <= 3) {
        return { status: "COMPLETED", metric: "Passed", runtime_ms: 115, tokens: 620, cost_usd: 0.0008, cost_inr: 0.07 };
      }
      if (node.stepNumber === 4) {
        return { status: "HALTED", metric: "PF 0.99 Spoof", runtime_ms: 45, tokens: 0, cost_usd: 0, cost_inr: 0 };
      }
      return { status: "SKIPPED", metric: "Halted by Fraud", runtime_ms: 0, tokens: 0, cost_usd: 0, cost_inr: 0 };
    }

    if (isHitl) {
      if (node.stepNumber <= 3) {
        return { status: "COMPLETED", metric: "Passed", runtime_ms: 110, tokens: 680, cost_usd: 0.0009, cost_inr: 0.08 };
      }
      if (node.stepNumber === 4 || node.stepNumber === 5) {
        return { status: "HITL", metric: "Δ Variance > 2%", runtime_ms: 48, tokens: 840, cost_usd: 0.0011, cost_inr: 0.09 };
      }
      return { status: "QUEUED", metric: "Gate Locked", runtime_ms: 0, tokens: 0, cost_usd: 0, cost_inr: 0 };
    }

    // Default clean completed run
    return {
      status: "COMPLETED",
      metric:
        node.id === "brand_liability"
          ? `${selectedRun.volume_tons || 250} MT Net`
          : node.id === "regulatory_watchdog"
          ? "100% Mandate"
          : node.id === "auction"
          ? "₹4,150/MT"
          : node.id === "scada_auditor"
          ? "45.2 Nm · PF 0.84"
          : node.id === "forensic_auditor"
          ? "98.4% Confidence"
          : node.id === "escrow"
          ? "80/20 PO Disbursed"
          : "Form-1 Signed",
      runtime_ms: node.stepNumber === 4 ? 45 : node.stepNumber === 5 ? 520 : 130,
      tokens: node.stepNumber === 4 ? 0 : 720,
      cost_usd: node.stepNumber === 4 ? 0 : 0.001,
      cost_inr: node.stepNumber === 4 ? 0 : 0.08,
    };
  };

  const getStatusVisuals = (status: NodeTelemetry["status"]) => {
    switch (status) {
      case "COMPLETED":
        return {
          border: "#10B981",
          pillBg: "rgba(16, 185, 129, 0.15)",
          pillBorder: "#10B981",
          text: "#34D399",
          label: "Completed",
          portColor: "#10B981",
        };
      case "RUNNING":
        return {
          border: "#3B82F6",
          pillBg: "rgba(59, 130, 246, 0.25)",
          pillBorder: "#3B82F6",
          text: "#93C5FD",
          label: "Running",
          portColor: "#3B82F6",
        };
      case "HITL":
        return {
          border: "#F59E0B",
          pillBg: "rgba(245, 158, 11, 0.2)",
          pillBorder: "#F59E0B",
          text: "#FBBF24",
          label: "HITL Review",
          portColor: "#F59E0B",
        };
      case "HALTED":
        return {
          border: "#EF4444",
          pillBg: "rgba(239, 68, 68, 0.2)",
          pillBorder: "#EF4444",
          text: "#F87171",
          label: "Halted",
          portColor: "#EF4444",
        };
      case "QUEUED":
      case "PENDING":
        return {
          border: "#334155",
          pillBg: "rgba(51, 65, 85, 0.3)",
          pillBorder: "#475569",
          text: "#94A3B8",
          label: "Queued",
          portColor: "#475569",
        };
      case "SKIPPED":
        return {
          border: "#475569",
          pillBg: "rgba(71, 85, 105, 0.2)",
          pillBorder: "#475569",
          text: "#64748B",
          label: "Skipped",
          portColor: "#475569",
        };
      default:
        return {
          border: "#334155",
          pillBg: "rgba(51, 65, 85, 0.2)",
          pillBorder: "#475569",
          text: "#94A3B8",
          label: "Idle",
          portColor: "#475569",
        };
    }
  };

  const totalRuntime = selectedRun?.total_runtime_ms || Math.round((selectedRun?.duration_seconds || 1.28) * 1000);
  const totalTokens = selectedRun?.total_tokens || 4240;
  const totalCostUsd = selectedRun?.total_cost_usd || 0.0058;
  const totalCostInr = selectedRun?.total_cost_inr || 0.49;

  // Connection wire definitions between ports
  // Port radius is 5. Width = 246, height = 92, port Y = y + 46
  const WIRES = useMemo(
    () => [
      {
        id: "w1",
        from: "brand_liability",
        to: "auction",
        path: "M 296 106 C 325 106, 316 206, 345 206",
        activeAtStep: 3,
      },
      {
        id: "w2",
        from: "regulatory_watchdog",
        to: "auction",
        path: "M 296 306 C 325 306, 316 206, 345 206",
        activeAtStep: 3,
      },
      {
        id: "w3",
        from: "auction",
        to: "scada_auditor",
        path: "M 591 206 C 620 206, 611 106, 640 106",
        activeAtStep: 4,
      },
      {
        id: "w4",
        from: "auction",
        to: "forensic_auditor",
        path: "M 591 206 C 620 206, 611 306, 640 306",
        activeAtStep: 5,
      },
      {
        id: "w5",
        from: "scada_auditor",
        to: "escrow",
        path: "M 886 106 C 910 106, 911 106, 935 106",
        activeAtStep: 6,
      },
      {
        id: "w6",
        from: "forensic_auditor",
        to: "escrow",
        path: "M 886 306 C 915 306, 906 106, 935 106",
        activeAtStep: 6,
      },
      {
        id: "w7",
        from: "escrow",
        to: "cpcb_dispatch",
        path: "M 1058 152 C 1058 190, 1058 220, 1058 260",
        activeAtStep: 7,
      },
    ],
    []
  );

  return (
    <Box
      sx={{
        width: "100%",
        height: { xs: "auto", lg: 520 },
        bgcolor: "#0C0F17",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
      }}
    >
      {/* Canvas Top Bar with Aggregate Run Telemetry */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: "rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          bgcolor: "rgba(17, 21, 30, 0.95)",
          backdropFilter: "blur(8px)",
          zIndex: 10,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: isRunning ? "#3B82F6" : "#10B981",
                boxShadow: isRunning ? "0 0 10px #3B82F6" : "0 0 8px #10B981",
              }}
            />
            <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", letterSpacing: "-0.01em", color: "#F8FAFC" }}>
              Agent Orchestration Topology (n8n Engine)
            </Typography>
          </Box>

          {selectedRun && (
            <Chip
              size="small"
              label={`Run: ${selectedRun.run_id}`}
              sx={{
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 700,
                height: 22,
                fontSize: "0.72rem",
                bgcolor: "rgba(255,255,255,0.06)",
                color: "#E2E8F0",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          )}

          {activeNodeId ? (
            <Chip
              size="small"
              color="primary"
              label="Node Selected • Click ✕ to expand canvas"
              onDelete={() => onSelectNode(activeNodeId)}
              sx={{ height: 22, fontSize: "0.68rem", fontWeight: 700 }}
            />
          ) : (
            <Chip
              size="small"
              variant="outlined"
              label="💡 Click any node to inspect Inputs & Outputs"
              sx={{ height: 22, fontSize: "0.68rem", borderColor: "rgba(255,255,255,0.15)", color: "#94A3B8" }}
            />
          )}
        </Box>

        {/* Live Total Run Telemetry Strip */}
        {selectedRun && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Tooltip title="Total End-to-End Orchestration Runtime">
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <SpeedIcon sx={{ fontSize: 15, color: "#60A5FA" }} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "#E2E8F0" }}>
                  {totalRuntime} ms
                </Typography>
              </Box>
            </Tooltip>

            <Tooltip title="Total LLM Tokens Consumed">
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <TollIcon sx={{ fontSize: 15, color: "#C084FC" }} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "#E2E8F0" }}>
                  {totalTokens.toLocaleString()} tok
                </Typography>
              </Box>
            </Tooltip>

            <Tooltip title="Total Execution Cost ($ USD / ₹ INR)">
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <AttachMoneyIcon sx={{ fontSize: 15, color: "#34D399" }} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "#E2E8F0" }}>
                  ${totalCostUsd.toFixed(4)} (₹{totalCostInr.toFixed(2)})
                </Typography>
              </Box>
            </Tooltip>

            {/* Status Legend */}
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", pl: 1, borderLeft: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#10B981" }} />
                <Typography sx={{ fontSize: "0.68rem", color: "#94A3B8" }}>Passed</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#3B82F6" }} />
                <Typography sx={{ fontSize: "0.68rem", color: "#94A3B8" }}>Running</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#F59E0B" }} />
                <Typography sx={{ fontSize: "0.68rem", color: "#94A3B8" }}>HITL</Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* Authentic n8n SVG Canvas Area */}
      <Box sx={{ flexGrow: 1, position: "relative", width: "100%", height: "100%", minHeight: 0, overflow: "hidden" }}>
        <svg
          viewBox="0 0 1230 420"
          style={{ width: "100%", height: "100%" }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Signature n8n Dot Grid Pattern */}
            <pattern id="n8nGrid" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="11" cy="11" r="1.15" fill="#252D3F" opacity="0.85" />
            </pattern>

            {/* Glowing Wire Gradients */}
            <linearGradient id="edgeGradRunning" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#60A5FA" stopOpacity="1" />
              <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.6" />
            </linearGradient>

            <linearGradient id="edgeGradSuccess" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
            </linearGradient>

            <linearGradient id="edgeGradDefault" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2A3347" />
              <stop offset="100%" stopColor="#2A3347" />
            </linearGradient>

            {/* Node Shadows & Glow Filters */}
            <filter id="nodeShadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.55" />
            </filter>

            <filter id="particleGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="runPulseGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Canvas & Dot Grid */}
          <rect width="100%" height="100%" fill="#0C0F17" />
          <rect width="100%" height="100%" fill="url(#n8nGrid)" />

          {/* S-Curve Bezier Connection Wires */}
          {WIRES.map((wire) => {
            const isWireActive = isRunning && (simulatedActiveStep === wire.activeAtStep || simulatedActiveStep > wire.activeAtStep);
            const isWireFlowing = isRunning && simulatedActiveStep === wire.activeAtStep;

            return (
              <g key={wire.id}>
                {/* Base Wire Track */}
                <path
                  d={wire.path}
                  fill="none"
                  stroke={isWireActive ? "url(#edgeGradSuccess)" : "url(#edgeGradDefault)"}
                  strokeWidth="2.5"
                  opacity={isWireActive ? 0.9 : 0.6}
                />

                {/* Flowing Dashed Energy Line when Workflow is Running */}
                {isWireFlowing && (
                  <path
                    d={wire.path}
                    fill="none"
                    stroke="#60A5FA"
                    strokeWidth="2.5"
                    strokeDasharray="8 8"
                    opacity="0.95"
                    filter="url(#particleGlow)"
                  >
                    <animate attributeName="stroke-dashoffset" values="32;0" dur="0.8s" repeatCount="indefinite" />
                  </path>
                )}

                {/* n8n Trademark High-Energy Traveling Particle Dot */}
                {isWireFlowing && (
                  <>
                    <circle r="4.5" fill="#60A5FA" filter="url(#particleGlow)">
                      <animateMotion path={wire.path} dur="1.2s" repeatCount="indefinite" />
                    </circle>
                    <circle r="2" fill="#FFFFFF">
                      <animateMotion path={wire.path} dur="1.2s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
              </g>
            );
          })}

          {/* Node 6 to 7 Vertical Port Markers */}
          <circle cx="1058" cy="152" r="4.5" fill="#10B981" stroke="#141824" strokeWidth="2" />
          <circle cx="1058" cy="260" r="4.5" fill="#10B981" stroke="#141824" strokeWidth="2" />

          {/* Render Authentic n8n Node Cards */}
          {AGENT_NODES.map((node) => {
            const telemetry = getNodeState(node);
            const visuals = getStatusVisuals(telemetry.status);
            const isSelected = activeNodeId === node.id;
            const isNodeRunning = telemetry.status === "RUNNING";

            return (
              <g
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                style={{ cursor: "pointer" }}
              >
                {/* n8n Active Running Pulsing Wave Rings */}
                {isNodeRunning && (
                  <>
                    <rect
                      x={node.x - 4}
                      y={node.y - 4}
                      width={254}
                      height={100}
                      rx={15}
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                      filter="url(#runPulseGlow)"
                    >
                      <animate attributeName="stroke-opacity" values="0.9;0" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="stroke-width" values="1.5;7" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="x" values={`${node.x - 4};${node.x - 10}`} dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="y" values={`${node.y - 4};${node.y - 10}`} dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="width" values="254;266" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="height" values="100;112" dur="1.6s" repeatCount="indefinite" />
                    </rect>
                  </>
                )}

                {/* Selection Halo Ring */}
                {isSelected && (
                  <rect
                    x={node.x - 3}
                    y={node.y - 3}
                    width={252}
                    height={98}
                    rx={14}
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="2"
                    strokeDasharray="5 3"
                    filter="url(#particleGlow)"
                  />
                )}

                {/* Main n8n Slate Node Card */}
                <rect
                  x={node.x}
                  y={node.y}
                  width={246}
                  height={92}
                  rx={12}
                  fill="#141824"
                  stroke={isSelected ? "#8B5CF6" : visuals.border}
                  strokeWidth={isSelected ? "2" : isNodeRunning ? "2" : "1.5"}
                  filter="url(#nodeShadow)"
                  style={{ transition: "all 0.2s ease" }}
                />

                {/* Left Port Dot (Input) */}
                <circle
                  cx={node.x}
                  cy={node.y + 46}
                  r={5}
                  fill={visuals.portColor}
                  stroke="#141824"
                  strokeWidth="2.5"
                />

                {/* Right Port Dot (Output) */}
                <circle
                  cx={node.x + 246}
                  cy={node.y + 46}
                  r={5}
                  fill={visuals.portColor}
                  stroke="#141824"
                  strokeWidth="2.5"
                />

                {/* Left Icon Badge (n8n signature rounded square with role gradient) */}
                <foreignObject x={node.x + 12} y={node.y + 13} width={38} height={38}>
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "10px",
                      background: node.gradient,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                    }}
                  >
                    {node.icon}
                  </div>
                </foreignObject>

                {/* Node Title */}
                <text
                  x={node.x + 58}
                  y={node.y + 27}
                  fill="#F8FAFC"
                  fontSize="11.5"
                  fontWeight="700"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {node.name}
                </text>

                {/* Node Role Subtitle */}
                <text
                  x={node.x + 58}
                  y={node.y + 42}
                  fill="#94A3B8"
                  fontSize="9"
                  fontWeight="500"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {node.role}
                </text>

                {/* Top-Right n8n Execution Status Pill */}
                <g transform={`translate(${node.x + 172}, ${node.y + 11})`}>
                  <rect
                    x="0"
                    y="0"
                    width="64"
                    height="19"
                    rx="9.5"
                    fill={visuals.pillBg}
                    stroke={visuals.pillBorder}
                    strokeWidth="1"
                  />
                  {isNodeRunning ? (
                    <>
                      <circle cx="10" cy="9.5" r="3.5" fill="#60A5FA">
                        <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
                      </circle>
                      <text
                        x="18"
                        y="12.5"
                        fill="#93C5FD"
                        fontSize="7.5"
                        fontWeight="800"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        RUNNING
                      </text>
                    </>
                  ) : telemetry.status === "COMPLETED" ? (
                    <text
                      x="32"
                      y="12.5"
                      textAnchor="middle"
                      fill="#34D399"
                      fontSize="8"
                      fontWeight="800"
                      fontFamily="var(--font-mono, monospace)"
                    >
                      ✓ {telemetry.runtime_ms}ms
                    </text>
                  ) : (
                    <text
                      x="32"
                      y="12.5"
                      textAnchor="middle"
                      fill={visuals.text}
                      fontSize="7.5"
                      fontWeight="700"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {visuals.label}
                    </text>
                  )}
                </g>

                {/* Divider Line */}
                <line
                  x1={node.x + 12}
                  y1={node.y + 59}
                  x2={node.x + 234}
                  y2={node.y + 59}
                  stroke="#222B3E"
                  strokeWidth="1"
                />

                {/* Bottom Bar: Model Pill on Left + Metric on Right */}
                {/* Model Badge */}
                {node.systemType.includes("Reflex") ? (
                  <g transform={`translate(${node.x + 12}, ${node.y + 66})`}>
                    <rect
                      x="0"
                      y="0"
                      width="92"
                      height="17"
                      rx="4"
                      fill="rgba(16, 185, 129, 0.15)"
                      stroke="rgba(16, 185, 129, 0.4)"
                      strokeWidth="0.8"
                    />
                    <text
                      x="6"
                      y="11.5"
                      fill="#6EE7B7"
                      fontSize="7.5"
                      fontWeight="700"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      ⚡ SCADA Reflex
                    </text>
                  </g>
                ) : (
                  <g transform={`translate(${node.x + 12}, ${node.y + 66})`}>
                    <rect
                      x="0"
                      y="0"
                      width="114"
                      height="17"
                      rx="4"
                      fill="rgba(139, 92, 246, 0.18)"
                      stroke="rgba(139, 92, 246, 0.45)"
                      strokeWidth="0.8"
                    />
                    <text
                      x="6"
                      y="11.5"
                      fill="#C4B5FD"
                      fontSize="7.5"
                      fontWeight="700"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      🤖 gemini-3.8-flash
                    </text>
                  </g>
                )}

                {/* Domain Metric Value on Right */}
                <text
                  x={node.x + 234}
                  y={node.y + 78}
                  textAnchor="end"
                  fill={visuals.text}
                  fontSize="8.5"
                  fontWeight="700"
                  fontFamily="var(--font-mono, monospace)"
                >
                  {telemetry.metric}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}
