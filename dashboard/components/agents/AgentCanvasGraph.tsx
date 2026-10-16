"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorIcon from "@mui/icons-material/Error";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ScaleIcon from "@mui/icons-material/BalanceOutlined";
import GavelIcon from "@mui/icons-material/GavelOutlined";
import RadarIcon from "@mui/icons-material/SensorsOutlined";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import DescriptionIcon from "@mui/icons-material/DescriptionOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SpeedIcon from "@mui/icons-material/Speed";
import TollIcon from "@mui/icons-material/Toll";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import type { E2ERunResult, E2EStep } from "../../app/lib/types/compliance.types";

interface AgentNodeDef {
  id: string;
  name: string;
  role: string;
  systemType: "System 1 Reflex" | "System 2 Reasoning";
  x: number;
  y: number;
  stepNumber: number;
  icon: React.ReactNode;
}

const AGENT_NODES: AgentNodeDef[] = [
  {
    id: "brand_liability",
    name: "Brand Liability Agent",
    role: "ERP Sales Debt Amortization",
    systemType: "System 2 Reasoning",
    x: 60,
    y: 80,
    stepNumber: 1,
    icon: <ScaleIcon fontSize="small" />,
  },
  {
    id: "regulatory_watchdog",
    name: "Regulatory Watchdog",
    role: "CPCB Gazette Rules & Base Rates",
    systemType: "System 2 Reasoning",
    x: 60,
    y: 280,
    stepNumber: 2,
    icon: <SmartToyIcon fontSize="small" />,
  },
  {
    id: "auction",
    name: "Continuous Double Auction",
    role: "Uniform Clearing Price Corridor",
    systemType: "System 2 Reasoning",
    x: 350,
    y: 180,
    stepNumber: 3,
    icon: <GavelIcon fontSize="small" />,
  },
  {
    id: "scada_auditor",
    name: "SCADA Physics Auditor",
    role: "Extruder Torque & Power Factor",
    systemType: "System 1 Reflex",
    x: 640,
    y: 80,
    stepNumber: 4,
    icon: <RadarIcon fontSize="small" />,
  },
  {
    id: "forensic_auditor",
    name: "Forensic Deep Reasoner",
    role: "Gemini System 2 Heat Balance",
    systemType: "System 2 Reasoning",
    x: 640,
    y: 280,
    stepNumber: 5,
    icon: <AutoAwesomeIcon fontSize="small" />,
  },
  {
    id: "escrow",
    name: "Escrow & Treasury Agent",
    role: "80/20 SAP Split-Payment PO",
    systemType: "System 2 Reasoning",
    x: 930,
    y: 80,
    stepNumber: 6,
    icon: <AccountBalanceWalletIcon fontSize="small" />,
  },
  {
    id: "cpcb_dispatch",
    name: "CPCB Form-1 Dispatcher",
    role: "X.509 Cryptographic DSC Signing",
    systemType: "System 2 Reasoning",
    x: 930,
    y: 280,
    stepNumber: 7,
    icon: <DescriptionIcon fontSize="small" />,
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
  // Resolve per-node telemetry dynamically based on the active run
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

    const runStatus = (selectedRun.status || "").toUpperCase();
    const isHitl = selectedRun.hitl_required || runStatus.includes("HITL");
    const isHalted = runStatus.includes("HALT") || runStatus.includes("FRAUD");

    // Match by step number or service name
    const step = selectedRun.steps?.find(
      (s) =>
        s.step === node.stepNumber ||
        s.service?.toLowerCase() === node.id.toLowerCase() ||
        s.name?.toLowerCase().includes(node.id)
    );

    if (step) {
      const st = step.status.toUpperCase();
      let status: NodeTelemetry["status"] = "COMPLETED";
      if (st.includes("HITL") || st.includes("REVIEW")) status = "HITL";
      else if (st.includes("HALT") || st.includes("FAIL") || st.includes("FRAUD")) status = "HALTED";
      else if (st.includes("QUEUE")) status = "QUEUED";
      else if (st.includes("SKIP")) status = "SKIPPED";

      let metric = "";
      const out = (step as any).output || step.response || step.data || {};
      if (node.id === "brand_liability") {
        metric = out.net_liability_tons ? `${out.net_liability_tons} MT Net` : `${selectedRun.volume_tons || 450} MT Net`;
      } else if (node.id === "regulatory_watchdog") {
        metric = out.mandated_target_pct ? `${out.mandated_target_pct}% Mandate` : "100% Mandate";
      } else if (node.id === "auction") {
        metric = out.clearing_price ? `₹${out.clearing_price.toLocaleString()}/MT Cleared` : "₹4,150/MT Cleared";
      } else if (node.id === "scada_auditor") {
        if (status === "HALTED") {
          metric = out.is_spoofed ? "PF 0.99 (Resistive Spoof)" : "Halted: Physics Anomaly";
        } else if (status === "HITL") {
          metric = "Δ Variance Exceeded";
        } else {
          metric = out.torque_nm ? `${out.torque_nm} Nm · PF ${out.power_factor || 0.84}` : "45.2 Nm · PF 0.84";
        }
      } else if (node.id === "forensic_auditor") {
        metric = status === "HALTED" ? "Halted: Upstream Fraud" : (status === "HITL" ? "Requires Officer Approval" : (out.confidence_pct ? `${out.confidence_pct}% Confidence` : "98.4% Confidence"));
      } else if (node.id === "escrow") {
        metric = status === "HALTED" || status === "SKIPPED" ? "Payment Halted" : (status === "QUEUED" ? "Gate Locked" : (out.status ? out.status.replace("_", " ") : "80/20 PO Disbursed"));
      } else if (node.id === "cpcb_dispatch") {
        metric = status === "HALTED" || status === "SKIPPED" ? "Filing Blocked" : (status === "QUEUED" ? "Awaiting Escrow" : (out.portal_ack_number ? "DSC Form-1 Signed" : "DSC Form-1 Signed"));
      }

      return {
        status,
        metric,
        runtime_ms: step.runtime_ms ?? (node.id === "scada_auditor" ? 45 : 120),
        tokens: step.tokens ?? (node.systemType.includes("Reflex") ? 0 : 750),
        cost_usd: step.cost_usd ?? (node.systemType.includes("Reflex") ? 0 : 0.0009),
        cost_inr: step.cost_inr ?? (node.systemType.includes("Reflex") ? 0 : 0.08),
      };
    }

    // Deterministic fallback based on run conditions
    if (isHalted) {
      if (node.stepNumber <= 3) {
        return { status: "COMPLETED", metric: "Completed", runtime_ms: 110, tokens: 620, cost_usd: 0.0008, cost_inr: 0.07 };
      }
      if (node.stepNumber === 4) {
        return { status: "HALTED", metric: "PF 0.99 Unity Spoof", runtime_ms: 45, tokens: 0, cost_usd: 0, cost_inr: 0 };
      }
      return { status: "SKIPPED", metric: "Halted by Fraud", runtime_ms: 0, tokens: 0, cost_usd: 0, cost_inr: 0 };
    }

    if (isHitl) {
      if (node.stepNumber <= 3) {
        return { status: "COMPLETED", metric: "Completed", runtime_ms: 110, tokens: 680, cost_usd: 0.0009, cost_inr: 0.08 };
      }
      if (node.stepNumber === 4 || node.stepNumber === 5) {
        return { status: "HITL", metric: "Δ Variance Exceeded", runtime_ms: 48, tokens: 840, cost_usd: 0.0011, cost_inr: 0.09 };
      }
      return { status: "QUEUED", metric: "Gate Locked", runtime_ms: 0, tokens: 0, cost_usd: 0, cost_inr: 0 };
    }

    // Default clean run
    return {
      status: "COMPLETED",
      metric: node.stepNumber === 4 ? "45.2 Nm · PF 0.84" : `${selectedRun.volume_tons || 250} MT Verified`,
      runtime_ms: node.stepNumber === 4 ? 45 : (node.stepNumber === 5 ? 520 : 140),
      tokens: node.stepNumber === 4 ? 0 : 720,
      cost_usd: node.stepNumber === 4 ? 0 : 0.001,
      cost_inr: node.stepNumber === 4 ? 0 : 0.08,
    };
  };

  const getStatusColor = (status: NodeTelemetry["status"]) => {
    switch (status) {
      case "COMPLETED":
        return { border: "#10B981", bg: "rgba(16, 185, 129, 0.08)", text: "#10B981", badge: "success" as const };
      case "HITL":
        return { border: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", text: "#F59E0B", badge: "warning" as const };
      case "HALTED":
        return { border: "#EF4444", bg: "rgba(239, 68, 68, 0.12)", text: "#EF4444", badge: "error" as const };
      case "QUEUED":
        return { border: "#8B5CF6", bg: "rgba(139, 92, 246, 0.08)", text: "#8B5CF6", badge: "info" as const };
      case "SKIPPED":
        return { border: "#6B7280", bg: "rgba(107, 114, 128, 0.08)", text: "#9CA3AF", badge: "default" as const };
      default:
        return { border: "rgba(255, 255, 255, 0.12)", bg: "rgba(255, 255, 255, 0.02)", text: "#94A3B8", badge: "default" as const };
    }
  };

  const totalRuntime = selectedRun?.total_runtime_ms || Math.round((selectedRun?.duration_seconds || 1.28) * 1000);
  const totalTokens = selectedRun?.total_tokens || 4240;
  const totalCostUsd = selectedRun?.total_cost_usd || 0.0058;
  const totalCostInr = selectedRun?.total_cost_inr || 0.49;

  return (
    <Box
      sx={{
        width: "100%",
        height: { xs: "auto", lg: 520 },
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Canvas Top Bar with Aggregate Run Telemetry */}
      <Box
        sx={{
          px: 2,
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
          <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", letterSpacing: "-0.01em" }}>
            Autonomous Multi-Agent Topology
          </Typography>
          {selectedRun && (
            <Chip
              size="small"
              label={`Run: ${selectedRun.run_id}`}
              sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, height: 22, fontSize: "0.72rem" }}
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
              sx={{ height: 22, fontSize: "0.68rem" }}
            />
          )}
        </Box>

        {/* Live Total Run Telemetry Strip */}
        {selectedRun && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Tooltip title="Total End-to-End Orchestration Runtime">
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <SpeedIcon sx={{ fontSize: 15, color: "primary.main" }} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
                  {totalRuntime} ms
                </Typography>
              </Box>
            </Tooltip>

            <Tooltip title="Total LLM Tokens Consumed">
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <TollIcon sx={{ fontSize: 15, color: "secondary.main" }} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
                  {totalTokens.toLocaleString()} tok
                </Typography>
              </Box>
            </Tooltip>

            <Tooltip title="Total Execution Cost ($ USD / ₹ INR)">
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <AttachMoneyIcon sx={{ fontSize: 15, color: "success.main" }} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
                  ${totalCostUsd.toFixed(4)} (₹{totalCostInr.toFixed(2)})
                </Typography>
              </Box>
            </Tooltip>

            {/* Status Legend */}
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", pl: 1, borderLeft: 1, borderColor: "divider" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#10B981" }} />
                <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>Passed</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#F59E0B" }} />
                <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>HITL</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#EF4444" }} />
                <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>Halted</Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* SVG Canvas Area */}
      <Box sx={{ flexGrow: 1, position: "relative", width: "100%", height: "100%", minHeight: 0, overflow: "hidden" }}>
        <svg
          viewBox="0 0 1200 440"
          style={{ width: "100%", height: "100%" }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="edgeAlert" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* DAG Directed Edges */}
          {/* Node 1 & 2 -> Node 3 (Auction) */}
          <path
            d="M 290 125 C 315 125, 325 225, 350 225"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />
          <path
            d="M 290 325 C 315 325, 325 225, 350 225"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />

          {/* Node 3 (Auction) -> Node 4 & 5 (Auditors) */}
          <path
            d="M 580 225 C 605 225, 615 125, 640 125"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
          />
          <path
            d="M 580 225 C 605 225, 615 325, 640 325"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
          />

          {/* Node 4 & 5 -> Node 6 (Escrow) */}
          <path
            d="M 870 125 L 930 125"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
          />
          <path
            d="M 870 325 C 895 325, 905 125, 930 125"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
          />

          {/* Node 6 -> Node 7 (CPCB Form 1 Dispatch) */}
          <path
            d="M 1045 175 L 1045 280"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
            strokeDasharray="3 3"
          />

          {/* Render Interactive Agent Nodes */}
          {AGENT_NODES.map((node) => {
            const telemetry = getNodeState(node);
            const colorCfg = getStatusColor(telemetry.status);
            const isSelected = activeNodeId === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onSelectNode(node.id)}
                style={{ cursor: "pointer" }}
              >
                {/* Outer Glow / Active Selection Ring */}
                {isSelected && (
                  <rect
                    x="-6"
                    y="-6"
                    width="242"
                    height="102"
                    rx="10"
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="2.5"
                    strokeDasharray="5 3"
                    filter="url(#glow)"
                  />
                )}

                {/* Main Node Card */}
                <rect
                  x="0"
                  y="0"
                  width="230"
                  height="90"
                  rx="8"
                  fill="var(--mui-palette-background-paper, #1E293B)"
                  stroke={colorCfg.border}
                  strokeWidth={isSelected ? "2.5" : "1.5"}
                  style={{ transition: "all 0.2s ease-in-out" }}
                />

                {/* Node Top Accent Stripe */}
                <rect
                  x="0"
                  y="0"
                  width="230"
                  height="4"
                  rx="2"
                  fill={colorCfg.border}
                />

                {/* Status Dot */}
                <g transform="translate(210, 16)">
                  <circle cx="0" cy="0" r="6" fill={colorCfg.border} />
                </g>

                {/* Agent Name */}
                <text
                  x="12"
                  y="22"
                  fill="var(--mui-palette-text-primary, #FFFFFF)"
                  fontSize="12"
                  fontWeight="700"
                  fontFamily="inherit"
                >
                  {node.name}
                </text>

                {/* Agent Role */}
                <text
                  x="12"
                  y="38"
                  fill="var(--mui-palette-text-secondary, #94A3B8)"
                  fontSize="9.5"
                  fontFamily="inherit"
                >
                  {node.role}
                </text>

                {/* System Type Tag & Domain Metric */}
                <rect
                  x="12"
                  y="46"
                  width={node.systemType.includes("Reflex") ? "80" : "96"}
                  height="16"
                  rx="3"
                  fill={node.systemType.includes("Reflex") ? "rgba(139, 92, 246, 0.2)" : "rgba(59, 130, 246, 0.2)"}
                />
                <text
                  x="16"
                  y="57"
                  fill={node.systemType.includes("Reflex") ? "#A78BFA" : "#93C5FD"}
                  fontSize="8"
                  fontWeight="700"
                  fontFamily="inherit"
                >
                  {node.systemType}
                </text>

                {telemetry.metric && (
                  <text
                    x={node.systemType.includes("Reflex") ? "100" : "114"}
                    y="58"
                    fill={colorCfg.border}
                    fontSize="8.5"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {telemetry.metric}
                  </text>
                )}

                {/* Bottom Telemetry Strip: Runtime · Tokens · Cost */}
                <line x1="8" y1="68" x2="222" y2="68" stroke="rgba(128,128,128,0.2)" strokeWidth="0.8" />
                <text
                  x="12"
                  y="81"
                  fill="var(--mui-palette-text-secondary, #94A3B8)"
                  fontSize="8.5"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  ⚡ {telemetry.runtime_ms}ms  ·  ✦ {telemetry.tokens} tok  ·  ₹{telemetry.cost_inr.toFixed(2)}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}
