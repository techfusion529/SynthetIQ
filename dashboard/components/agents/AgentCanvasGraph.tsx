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
import type { E2ERunResult, E2EStep } from "../../app/lib/types/compliance.types";

interface AgentNodeDef {
  id: string;
  name: string;
  role: string;
  systemType: "System 1 Reflex" | "System 2 Reasoning";
  x: number;
  y: number;
  icon: React.ReactNode;
}

const AGENT_NODES: AgentNodeDef[] = [
  {
    id: "brand_liability",
    name: "Brand Liability Agent",
    role: "ERP Sales Debt Amortization",
    systemType: "System 2 Reasoning",
    x: 80,
    y: 110,
    icon: <ScaleIcon fontSize="small" />,
  },
  {
    id: "regulatory_watchdog",
    name: "Regulatory Watchdog",
    role: "CPCB Gazette Rules & Base Rates",
    systemType: "System 2 Reasoning",
    x: 80,
    y: 290,
    icon: <SmartToyIcon fontSize="small" />,
  },
  {
    id: "auction",
    name: "Continuous Double Auction",
    role: "Uniform Clearing Price Corridor",
    systemType: "System 2 Reasoning",
    x: 350,
    y: 200,
    icon: <GavelIcon fontSize="small" />,
  },
  {
    id: "scada_auditor",
    name: "SCADA Physics Auditor",
    role: "Extruder Torque & Power Factor",
    systemType: "System 1 Reflex",
    x: 620,
    y: 110,
    icon: <RadarIcon fontSize="small" />,
  },
  {
    id: "forensic_auditor",
    name: "Forensic Deep Reasoner",
    role: "Gemini System 2 Heat Balance",
    systemType: "System 2 Reasoning",
    x: 620,
    y: 290,
    icon: <AutoAwesomeIcon fontSize="small" />,
  },
  {
    id: "escrow",
    name: "Escrow & Treasury Agent",
    role: "80/20 SAP Split-Payment PO",
    systemType: "System 2 Reasoning",
    x: 890,
    y: 110,
    icon: <AccountBalanceWalletIcon fontSize="small" />,
  },
  {
    id: "cpcb_dispatch",
    name: "CPCB Form-1 Dispatcher",
    role: "X.509 Cryptographic DSC Signing",
    systemType: "System 2 Reasoning",
    x: 890,
    y: 290,
    icon: <DescriptionIcon fontSize="small" />,
  },
];

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
  // Determine node execution status based on selected run and steps
  const getNodeState = (nodeId: string): { status: "COMPLETED" | "RUNNING" | "HITL" | "HALTED" | "PENDING"; metric?: string } => {
    if (!selectedRun) return { status: "PENDING" };

    const runStatus = selectedRun.status.toUpperCase();
    const isHitl = selectedRun.hitl_required || runStatus.includes("HITL") || runStatus.includes("REVIEW");
    const isHalted = runStatus.includes("HALT") || runStatus.includes("FRAUD") || runStatus.includes("REJECT");
    const isSuccess = runStatus === "SUCCESS_FULLY_COMPLIANT" || runStatus === "COMPLETED";

    // Step-level match
    const step = selectedRun.steps?.find(
      (s) =>
        s.name.toLowerCase().includes(nodeId) ||
        s.service.toLowerCase().includes(nodeId) ||
        (nodeId === "brand_liability" && s.step === 1) ||
        (nodeId === "regulatory_watchdog" && s.step === 2) ||
        (nodeId === "auction" && s.step === 3) ||
        (nodeId === "scada_auditor" && s.step === 4) ||
        (nodeId === "forensic_auditor" && s.step === 5) ||
        (nodeId === "escrow" && s.step === 6) ||
        (nodeId === "cpcb_dispatch" && s.step === 7)
    );

    if (step) {
      if (step.status === "COMPLETED") return { status: "COMPLETED" };
      if (step.status === "FAILED") return { status: "HALTED" };
    }

    if (isSuccess) {
      return { status: "COMPLETED" };
    }

    if (isHitl) {
      if (nodeId === "brand_liability" || nodeId === "regulatory_watchdog" || nodeId === "auction") {
        return { status: "COMPLETED" };
      }
      if (nodeId === "scada_auditor" || nodeId === "forensic_auditor") {
        return { status: "HITL", metric: "Δ Variance Exceeded" };
      }
      return { status: "PENDING" };
    }

    if (isHalted) {
      if (nodeId === "brand_liability" || nodeId === "regulatory_watchdog") {
        return { status: "COMPLETED" };
      }
      if (nodeId === "scada_auditor") {
        return { status: "HALTED", metric: "Physics Anomaly" };
      }
      return { status: "PENDING" };
    }

    return { status: "COMPLETED" };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { border: "#10B981", bg: "rgba(16, 185, 129, 0.08)", text: "#10B981" };
      case "HITL":
        return { border: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", text: "#F59E0B" };
      case "HALTED":
        return { border: "#EF4444", bg: "rgba(239, 68, 68, 0.12)", text: "#EF4444" };
      default:
        return { border: "rgba(255, 255, 255, 0.12)", bg: "rgba(255, 255, 255, 0.02)", text: "text.secondary" };
    }
  };

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: 460,
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
      {/* Canvas Top Bar */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#FAFAFA"),
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.88rem" }}>
            Autonomous Multi-Agent Topology
          </Typography>
          {selectedRun && (
            <Chip
              size="small"
              label={`Run: ${selectedRun.run_id}`}
              sx={{ fontFamily: "monospace", fontWeight: 700, height: 22, fontSize: "0.72rem" }}
            />
          )}
        </Box>

        {/* Status Legend */}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#10B981" }} />
            <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>Completed</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#F59E0B" }} />
            <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>HITL Review</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#EF4444" }} />
            <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>Halted/Anomaly</Typography>
          </Box>
        </Box>
      </Box>

      {/* SVG Canvas Area */}
      <Box sx={{ flexGrow: 1, position: "relative", width: "100%", height: 420 }}>
        <svg
          viewBox="0 0 1150 420"
          style={{ width: "100%", height: "100%", minHeight: 400 }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="edgeAlert" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
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
            d="M 300 150 C 320 150, 330 240, 350 240"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />
          <path
            d="M 300 330 C 320 330, 330 240, 350 240"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />

          {/* Node 3 (Auction) -> Node 4 & 5 (Auditors) */}
          <path
            d="M 570 240 C 590 240, 600 150, 620 150"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
          />
          <path
            d="M 570 240 C 590 240, 600 330, 620 330"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
          />

          {/* Node 4 & 5 -> Node 6 (Escrow) */}
          <path
            d="M 840 150 L 890 150"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
          />
          <path
            d="M 840 330 C 865 330, 865 150, 890 150"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
          />

          {/* Node 6 -> Node 7 (CPCB Form 1 Dispatch) */}
          <path
            d="M 1000 190 L 1000 290"
            fill="none"
            stroke="url(#edgeGrad)"
            strokeWidth="2.5"
            strokeDasharray="3 3"
          />

          {/* Render Interactive Agent Nodes */}
          {AGENT_NODES.map((node) => {
            const { status, metric } = getNodeState(node.id);
            const colorCfg = getStatusColor(status);
            const isSelected = activeNodeId === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onSelectNode(node.id)}
                style={{ cursor: "pointer" }}
              >
                {/* Outer Glow / Active Ring */}
                {isSelected && (
                  <rect
                    x="-6"
                    y="-6"
                    width="232"
                    height="92"
                    rx="10"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2"
                    strokeDasharray="5 3"
                    filter="url(#glow)"
                  />
                )}

                {/* Main Node Card */}
                <rect
                  x="0"
                  y="0"
                  width="220"
                  height="80"
                  rx="8"
                  fill="var(--mui-palette-background-paper, #1E293B)"
                  stroke={colorCfg.border}
                  strokeWidth={isSelected ? "2.5" : "1.5"}
                  style={{
                    transition: "all 0.2s ease-in-out",
                  }}
                />

                {/* Node Top Accent Stripe */}
                <rect
                  x="0"
                  y="0"
                  width="220"
                  height="4"
                  rx="2"
                  fill={colorCfg.border}
                />

                {/* Status Indicator Icon */}
                <g transform="translate(192, 16)">
                  {status === "COMPLETED" && (
                    <circle cx="0" cy="0" r="7" fill="#10B981" />
                  )}
                  {status === "HITL" && (
                    <circle cx="0" cy="0" r="7" fill="#F59E0B" />
                  )}
                  {status === "HALTED" && (
                    <circle cx="0" cy="0" r="7" fill="#EF4444" />
                  )}
                  {status === "PENDING" && (
                    <circle cx="0" cy="0" r="7" fill="rgba(255,255,255,0.2)" />
                  )}
                </g>

                {/* Node Title & System Type */}
                <text
                  x="14"
                  y="26"
                  fill="var(--mui-palette-text-primary, #FFFFFF)"
                  fontSize="12.5"
                  fontWeight="700"
                  fontFamily="inherit"
                >
                  {node.name}
                </text>

                <text
                  x="14"
                  y="45"
                  fill="var(--mui-palette-text-secondary, #94A3B8)"
                  fontSize="10"
                  fontFamily="inherit"
                >
                  {node.role}
                </text>

                {/* Badge Tag */}
                <rect
                  x="14"
                  y="55"
                  width={node.systemType.includes("Reflex") ? "86" : "106"}
                  height="16"
                  rx="3"
                  fill={node.systemType.includes("Reflex") ? "rgba(139, 92, 246, 0.2)" : "rgba(59, 130, 246, 0.2)"}
                />
                <text
                  x="18"
                  y="67"
                  fill={node.systemType.includes("Reflex") ? "#A78BFA" : "#93C5FD"}
                  fontSize="8.5"
                  fontWeight="600"
                  fontFamily="inherit"
                >
                  {node.systemType}
                </text>

                {metric && (
                  <text
                    x="130"
                    y="67"
                    fill={colorCfg.border}
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {metric}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}
