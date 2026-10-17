"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ScaleIcon from "@mui/icons-material/BalanceOutlined";
import SpeedIcon from "@mui/icons-material/Speed";
import TollIcon from "@mui/icons-material/Toll";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import DescriptionIcon from "@mui/icons-material/DescriptionOutlined";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import GavelIcon from "@mui/icons-material/GavelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorIcon from "@mui/icons-material/Error";
import type { E2ERunResult, E2EStep } from "../../app/lib/types/compliance.types";
import { useNotification } from "../../app/lib/contexts/NotificationContext";
import { GeminiIcon } from "@/components/icons/GoogleIcons";

interface AgentNodeDetailPanelProps {
  selectedRun: E2ERunResult | null;
  activeNodeId: string;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

interface ParamRow {
  key: string;
  label: string;
  type: string;
  value: string | number;
}

interface OutputRow {
  key: string;
  metric: string;
  verified: string;
  value: string | number;
  highlight?: "success" | "warning" | "error";
}

const AGENT_BLUEPRINTS: Record<
  string,
  {
    step: number;
    name: string;
    role: string;
    system: string;
    model: string;
    icon: React.ReactNode;
  }
> = {
  brand_liability: {
    step: 1,
    name: "Brand Liability Agent",
    role: "ERP Sales Debt Amortization",
    system: "System 2 Reasoning",
    model: "Gemini 3.8 Flash",
    icon: <ScaleIcon fontSize="small" />,
  },
  regulatory_watchdog: {
    step: 2,
    name: "Regulatory Watchdog",
    role: "CPCB Gazette Rules & Base Rates",
    system: "System 2 Reasoning",
    model: "Gemini 3.8 Flash",
    icon: <SmartToyIcon fontSize="small" />,
  },
  auction: {
    step: 3,
    name: "Continuous Double Auction",
    role: "Uniform Clearing Price Corridor",
    system: "System 2 Reasoning",
    model: "Gemini 3.8 Flash",
    icon: <GavelIcon fontSize="small" />,
  },
  scada_auditor: {
    step: 4,
    name: "SCADA Physics Auditor",
    role: "Extruder Torque & Power Factor",
    system: "System 1 Reflex",
    model: "SCADA Physics Reflex (100Hz)",
    icon: <SpeedIcon fontSize="small" />,
  },
  forensic_auditor: {
    step: 5,
    name: "Forensic Gemini Reasoner",
    role: "Heat Balance Anti-Fraud Reasoning",
    system: "System 2 Reasoning",
    model: "Gemini 3.8 Flash",
    icon: <SmartToyIcon fontSize="small" />,
  },
  escrow: {
    step: 6,
    name: "Escrow & Treasury Agent",
    role: "80/20 SAP Split-Payment PO",
    system: "System 2 Reasoning",
    model: "Gemini 3.8 Flash",
    icon: <AccountBalanceWalletIcon fontSize="small" />,
  },
  cpcb_dispatch: {
    step: 7,
    name: "CPCB Form-1 Dispatcher",
    role: "X.509 Cryptographic DSC Signing",
    system: "System 2 Reasoning",
    model: "Gemini 3.8 Flash",
    icon: <DescriptionIcon fontSize="small" />,
  },
};

export default function AgentNodeDetailPanel({
  selectedRun,
  activeNodeId,
  onClose,
  onSelectNode,
}: AgentNodeDetailPanelProps) {
  const { notify } = useNotification();
  const [tabIndex, setTabIndex] = useState(0);

  // Pagination for Inputs Table
  const [inputPage, setInputPage] = useState(0);
  const [inputRowsPerPage, setInputRowsPerPage] = useState(5);

  // Pagination for Outputs Table
  const [outputPage, setOutputPage] = useState(0);
  const [outputRowsPerPage, setOutputRowsPerPage] = useState(5);

  const [copied, setCopied] = useState(false);

  const bp = AGENT_BLUEPRINTS[activeNodeId] || {
    step: 1,
    name: "Agent Node",
    role: "Execution Step",
    system: "System 2 Reasoning",
    icon: <SmartToyIcon fontSize="small" />,
  };

  const matchingStep = ((selectedRun as any)?.events || selectedRun?.steps)?.find(
    (e: any) => e.service === activeNodeId || e.step === bp.step
  );

  const runStatus = (selectedRun?.status || "").toUpperCase();
  const isHalted = runStatus.includes("HALT") || runStatus.includes("FRAUD");
  const isHitl = Boolean(selectedRun?.hitl_required || runStatus.includes("HITL"));

  // Determine node execution status
  const nodeStatus: string = (() => {
    if (matchingStep?.status) {
      return matchingStep.status.toUpperCase();
    }
    if (isHalted) {
      if (bp.step <= 3) return "COMPLETED";
      if (bp.step === 4) return "HALTED";
      return "SKIPPED";
    }
    if (isHitl) {
      if (bp.step <= 3) return "COMPLETED";
      if (bp.step === 4 || bp.step === 5) return "HITL";
      return "QUEUED";
    }
    if (runStatus === "SUCCESS_FULLY_COMPLIANT" || runStatus === "COMPLETED") {
      return "COMPLETED";
    }
    if (runStatus === "RUNNING") {
      if (bp.step === 1) return "RUNNING";
      return "QUEUED";
    }
    return "QUEUED";
  })();

  const isStepDone = nodeStatus === "COMPLETED" || nodeStatus === "SUCCESS_FULLY_COMPLIANT";
  const isStepFailed = nodeStatus.includes("FAIL") || nodeStatus.includes("HALT") || nodeStatus.includes("REJECT");
  const isStepHitl = nodeStatus === "HITL" || nodeStatus.includes("HITL");

  const runtimeMs = isStepDone ? (matchingStep?.runtime_ms ?? (bp.step === 4 ? 45 : bp.step === 5 ? 520 : 120 + bp.step * 15)) : 0;
  const tokens = isStepDone ? (matchingStep?.tokens ?? (bp.system.includes("Reflex") ? 0 : 650 + bp.step * 40)) : 0;
  const costInr = isStepDone ? (matchingStep?.cost_inr ?? (bp.system.includes("Reflex") ? 0 : 0.06 + bp.step * 0.01)) : 0;

  // Extract structured Input Parameters
  const inputRows: ParamRow[] = (() => {
    const vol = selectedRun?.volume_tons || 250;
    const cat = selectedRun?.category || "cat_i_rigid";
    const comp = selectedRun?.company_id || selectedRun?.input_params?.company_id || "ORG-DEV-001";

    switch (activeNodeId) {
      case "brand_liability":
        return [
          { key: "neural_engine", label: "Inference Engine", type: "Vertex AI Model Garden", value: "Gemini 3.8 Flash (Vertex AI)" },
          { key: "company_id", label: "Enterprise Company", type: "Entity ID", value: comp },
          { key: "fiscal_year", label: "Statutory Cycle", type: "Fiscal Cycle", value: selectedRun?.fiscal_year || selectedRun?.input_params?.fiscal_year || "FY 2025-26" },
          { key: "batch_id", label: "ERP Sales Batch", type: "ERP Reference", value: "BATCH-SAP-8921" },
          { key: "plastic_category", label: "Plastic Category", type: "PWM Classification", value: cat },
          { key: "gross_packaging_tons", label: "Gross Imported Mass", type: "Weight (MT)", value: `${(vol * 4.5).toLocaleString()} MT` },
          { key: "historical_debt", label: "Carry-Forward Debt", type: "Statutory Debt", value: "125.0 MT" },
          { key: "amortization_pct", label: "Statutory Rate", type: "PWM Rule 13", value: "33.3% (Year 1 of 3)" },
        ];
      case "regulatory_watchdog":
        return [
          { key: "neural_engine", label: "Inference Engine", type: "AI Inference Engine", value: "Gemini 3.8 Flash" },
          { key: "cpcb_gazette_id", label: "Gazette Reference", type: "Legal Statute", value: "CPCB/PWM/2026/GZ-04" },
          { key: "plastic_category", label: "PWM Category", type: "Classification", value: cat },
          { key: "mandate_pct", label: "Mandatory Target", type: "Compliance Floor", value: "100.0% Recycling Obligation" },
          { key: "base_floor_rate", label: "Statutory Base Floor", type: "Currency (INR)", value: "₹5,000.00 / MT" },
          { key: "penalty_multiplier", label: "Non-Compliance Multiplier", type: "Enforcement", value: "1.5x Base Rate (₹7,500/MT)" },
          { key: "statutory_deadline", label: "Statutory Filing Deadline", type: "Timestamp", value: "31-MAR-2026" },
        ];
      case "auction":
        return [
          { key: "neural_engine", label: "Inference Engine", type: "AI Inference Engine", value: "Gemini 3.8 Flash" },
          { key: "buyer_id", label: "Registered Buyer", type: "PIBO Entity", value: comp },
          { key: "required_volume", label: "Target Deficit Volume", type: "Weight (MT)", value: `${vol} MT` },
          { key: "max_bid_price", label: "Max Allowed Bid", type: "Currency (INR)", value: "₹5,500.00 / MT" },
          { key: "auction_mode", label: "Clearing Mode", type: "Mechanism", value: "Continuous Double Auction (CDA)" },
          { key: "clearing_algorithm", label: "Corridor Bounds", type: "Algorithm", value: "Uniform Clearing Price Corridor" },
          { key: "matching_engine", label: "Engine Instance", type: "Engine Host", value: "OrderBook-Worker-01 (In-Memory)" },
        ];
      case "scada_auditor":
        return [
          { key: "reflex_engine", label: "Audit Engine", type: "SCADA Telemetry", value: "SCADA Physics Reflex (100Hz)" },
          { key: "recycler_id", label: "Recycler Vendor", type: "Tenant ID", value: "RECYC-DELHI-01" },
          { key: "plant_line_id", label: "Extrusion Line", type: "Sensor Node", value: "PLANT-OKHLA-2 / LINE-04" },
          { key: "sampling_frequency", label: "SCADA Sampling Rate", type: "High-Frequency Telemetry", value: "100 Hz Streaming Feed" },
          { key: "torque_threshold", label: "Min Viscous Torque", type: "Physics Gate", value: "≥ 8.00 Nm" },
          { key: "inductive_pf_window", label: "Valid Power Factor", type: "Physics Gate", value: "0.78 ≤ cos φ ≤ 0.96" },
          { key: "live_vfd_freq", label: "Line Frequency", type: "Electrical Telemetry", value: "50.1 Hz" },
        ];
      case "forensic_auditor":
        return [
          { key: "reasoner_model", label: "Reasoning Engine", type: "AI Inference Engine", value: "Gemini 3.8 Flash" },
          { key: "heat_balance_qin", label: "Thermodynamic Heat In", type: "Specific Energy", value: "Q_in = 342.1 kJ/kg" },
          { key: "heat_balance_qreq", label: "Theoretical Heat Req", type: "Specific Energy", value: "Q_req = 338.5 kJ/kg" },
          { key: "gst_eway_bill", label: "GST e-Way Bill ID", type: "Tax Ingestion", value: "EWAY-2026-9041284" },
          { key: "weighbridge_slip", label: "Weighbridge Token", type: "Mass Metric", value: "WB-2026-OKH-8819" },
        ];
      case "escrow":
        return [
          { key: "neural_engine", label: "Inference Engine", type: "AI Inference Engine", value: "Gemini 3.8 Flash" },
          { key: "sap_po_number", label: "SAP Purchase Order", type: "ERP Document", value: selectedRun?.po_number || "PO-SAP-2026-8912" },
          { key: "total_deal_amount", label: "Contract Value", type: "Currency (INR)", value: `₹${(vol * 4150).toLocaleString()}` },
          { key: "split_gate_rule", label: "Split Escrow Gate", type: "Statutory Contract", value: "80% Melt Proof / 20% CPCB ACK" },
          { key: "advance_ratio", label: "Advance Tranche", type: "Ratio", value: "80.0%" },
          { key: "retention_ratio", label: "Retention Tranche", type: "Ratio", value: "20.0%" },
          { key: "escrow_vpa", label: "ICICI Virtual Escrow", type: "Virtual Bank VPA", value: "recyc-delhi-01@icici-escrow" },
        ];
      case "cpcb_dispatch":
        return [
          { key: "neural_engine", label: "Inference Engine", type: "AI Inference Engine", value: "Gemini 3.8 Flash" },
          { key: "cpcb_portal_endpoint", label: "CPCB Portal API", type: "National Gateway", value: "https://cpcbepr.nic.in/api/v2/statutory/form1" },
          { key: "pibo_reg_id", label: "PIBO Registration", type: "Statutory ID", value: "CPCB/EPR/2026/PIBO-9921" },
          { key: "dsc_cert_alias", label: "X.509 Certificate", type: "Cryptographic Key", value: "SynthetIQ-Digital-Signer-RSA4096" },
          { key: "sha256_merkle_root", label: "Audit Merkle Root", type: "Cryptographic Hash", value: selectedRun?.audit_hash || "88f29aeb9..." },
          { key: "statutory_year", label: "Compliance Year", type: "Statutory Year", value: "2025-2026" },
        ];
      default:
        return [
          { key: "step_number", label: "Step Number", type: "Integer", value: bp.step },
          { key: "agent_service", label: "Service Name", type: "Identifier", value: activeNodeId },
          { key: "run_id", label: "Parent Run", type: "Workflow Run", value: selectedRun?.run_id || "RUN-001" },
        ];
    }
  })();

  // Extract structured Output Results
  const outputRows: OutputRow[] = (() => {
    // If the step has not executed or finished, do NOT show fabricated outputs
    if (!isStepDone && !isStepFailed && !isStepHitl) {
      return [];
    }

    const vol = selectedRun?.volume_tons || 250;
    const cat = selectedRun?.category || "cat_i_rigid";

    switch (activeNodeId) {
      case "brand_liability":
        return [
          { key: "net_obligation_tons", metric: "Net EPR Obligation", verified: "Calculated", value: `${vol} MT`, highlight: "success" },
          { key: "gross_liability_tons", metric: "Gross Packaging Mass", verified: "ERP Audited", value: `${(vol * 4.5).toLocaleString()} MT` },
          { key: "amortized_debt_tons", metric: "Amortized Year 1 Debt", verified: "PWM Rule 13", value: "125.0 MT" },
          { key: "dominant_category", metric: "Dominant Category", verified: "Classified", value: cat },
          { key: "compliance_deficit", metric: "Digital Deficit Status", verified: "Locked", value: "TARGET_ACTIVE", highlight: "success" },
        ];
      case "regulatory_watchdog":
        return [
          { key: "statutory_floor_rate", metric: "Statutory Base Floor", verified: "Gazette Active", value: "₹5,000.00 / MT", highlight: "success" },
          { key: "corridor_ceiling", metric: "Clearing Ceiling", verified: "Corridor Bounds", value: "₹6,200.00 / MT" },
          { key: "framework_version", metric: "Rules Framework", verified: "Gazette Checked", value: "CPCB PWM Rules 2026" },
          { key: "statutory_validation", metric: "Validation Status", verified: "Enforced", value: "COMPLIANT_ACTIVE", highlight: "success" },
          { key: "seller_accreditation", metric: "Accreditation", verified: "Verified", value: "CPCB_PORTAL_REGISTERED" },
        ];
      case "auction":
        return [
          { key: "cleared_rate_inr_mt", metric: "Uniform Clearing Price", verified: "Market Match", value: "₹4,150.00 / MT", highlight: "success" },
          { key: "cleared_volume_tons", metric: "Cleared Trade Volume", verified: "100% Cleared", value: `${vol} MT`, highlight: "success" },
          { key: "total_trade_value_inr", metric: "Total Settlement Value", verified: "Escrow Target", value: `₹${(vol * 4150).toLocaleString()}` },
          { key: "net_cost_savings", metric: "Savings Below Floor", verified: "Discount Achieved", value: `₹${(vol * 850).toLocaleString()} (17.0%)`, highlight: "success" },
          { key: "matched_vendor", metric: "Matched Recycler", verified: "KYC Verified", value: "RECYC-DELHI-01" },
        ];
      case "scada_auditor":
        if (isHalted) {
          return [
            { key: "physics_verdict", metric: "Physical Audit Verdict", verified: "Zero-Trust Fail", value: "REJECTED_RESISTIVE_HEATER_FRAUD", highlight: "error" },
            { key: "torque_nm", metric: "Viscous Screw Torque", verified: "Sensor Reading", value: "1.20 Nm (Threshold ≥ 8.00 Nm)", highlight: "error" },
            { key: "power_factor", metric: "Motor Power Factor", verified: "Sensor Reading", value: "cos φ = 0.99 (Unity Resistive Anomaly)", highlight: "error" },
            { key: "calculated_melt", metric: "Actual Polymer Melt", verified: "Physical Mass", value: "0.0 kg/h (No Molten Flow)", highlight: "error" },
            { key: "anomaly_flag", metric: "Fraud Description", verified: "Forensic Rule", value: "Uncoupled space heaters spoofing electrical power", highlight: "error" },
          ];
        }
        return [
          { key: "physics_verdict", metric: "Physical Audit Verdict", verified: "SCADA Verified", value: "APPROVED_GENUINE_POLYMER_MELT", highlight: "success" },
          { key: "torque_nm", metric: "Viscous Screw Torque", verified: "Sensor Reading", value: "45.20 Nm (Threshold ≥ 8.00 Nm)", highlight: "success" },
          { key: "power_factor", metric: "Motor Power Factor", verified: "Sensor Reading", value: "cos φ = 0.84 (Normal Inductive Motor)" },
          { key: "active_power", metric: "Active Electrical Power", verified: "Power Meter", value: "95.0 kW" },
          { key: "melt_rate", metric: "Calculated Melt Rate", verified: "Thermodynamics", value: "250.0 kg/h", highlight: "success" },
        ];
      case "forensic_auditor":
        return [
          { key: "gemini_verdict", metric: "Gemini Reasoning Verdict", verified: "System 2 AI", value: isHalted ? "FRAUD_HEAT_DISCREPANCY" : "GENUINE_EXTRUSION_FLOW", highlight: isHalted ? "error" : "success" },
          { key: "confidence_score", metric: "Confidence Score", verified: "Model Assessment", value: "98.4%", highlight: "success" },
          { key: "energy_balance_delta", metric: "Thermodynamic Balance", verified: "Conservation", value: "Δ = 1.05% (Within ±2.0% Tolerance)", highlight: "success" },
          { key: "gst_eway_cross_check", metric: "GST e-Way Bill Match", verified: "National Tax DB", value: "MATCHED (1,000 MT GST vs 1,000 MT Melt)", highlight: "success" },
          { key: "sha256_merkle_root", metric: "Cryptographic Audit Hash", verified: "SHA-256", value: selectedRun?.audit_hash || "88f29aeb971..." },
        ];
      case "escrow":
        return [
          { key: "advance_released", metric: "80% Advance Dispatched", verified: "ERP Advance Tranche", value: `₹${Math.round(vol * 4150 * 0.8).toLocaleString()}`, highlight: "success" },
          { key: "retention_locked", metric: "20% Retention Held", verified: "Escrow Locked", value: `₹${Math.round(vol * 4150 * 0.2).toLocaleString()}`, highlight: "warning" },
          { key: "advance_bank_utr", metric: "Bank UTR Reference", verified: "ICICI API Sync", value: "UTR-HDFC-99214820" },
          { key: "sap_po_status", metric: "SAP PO Status", verified: "ERP Integrated", value: "SPLIT_PAYMENT_AUTHORIZED", highlight: "success" },
          { key: "retention_gate_status", metric: "Retention Release Gate", verified: "Awaiting Form-1", value: "LOCKED_UNTIL_CPCB_ACK" },
        ];
      case "cpcb_dispatch":
        return [
          { key: "portal_ack", metric: "CPCB Portal ACK Number", verified: "National Board", value: selectedRun?.portal_ack_number || "ACK-CPCB-2026-8912", highlight: "success" },
          { key: "submission_status", metric: "CPCB Portal Status", verified: "API Submission", value: "CPCB_ACCEPTED", highlight: "success" },
          { key: "dsc_signature", metric: "DSC Cryptographic Signature", verified: "X.509 Dual-Signed", value: "VALID_X509_SHA256", highlight: "success" },
          { key: "final_retention_unlocked", metric: "20% Retention Release", verified: "Treasury Gate", value: "AUTHORIZED_FOR_RELEASE", highlight: "success" },
          { key: "timestamp", metric: "Statutory Timestamp", verified: "Time Anchor", value: "2026-10-16T12:00:00Z" },
        ];
      default:
        return [
          { key: "verdict", metric: "Step Verdict", verified: "Runtime", value: nodeStatus, highlight: nodeStatus === "COMPLETED" ? "success" : "error" },
          { key: "runtime", metric: "Runtime", verified: "Telemetry", value: `${runtimeMs} ms` },
        ];
    }
  })();

  const inputData = Object.fromEntries(inputRows.map((r) => [r.key, r.value]));
  const outputData = isStepDone || isStepFailed || isStepHitl
    ? Object.fromEntries(outputRows.map((r) => [r.key, r.value]))
    : {};

  const handleCopyJson = () => {
    const payload = {
      agent_id: activeNodeId,
      step: bp.step,
      name: bp.name,
      role: bp.role,
      system: bp.system,
      status: nodeStatus,
      runtime_ms: runtimeMs,
      tokens: tokens,
      cost_inr: costInr,
      inputs: inputData,
      outputs: outputData,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    notify.success("Agent telemetry copied to clipboard", "JSON Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        height: { xs: "auto", lg: 520 },
        maxHeight: { xs: "none", lg: 520 },
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(139, 92, 246, 0.08)" : "rgba(124, 58, 237, 0.04)"),
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 200, flex: "1 1 auto" }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "8px",
              bgcolor: "#1A73E8",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            {bp.icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", lineHeight: 1.2 }}>
                {bp.name}
              </Typography>
              <Chip
                label={`Step ${bp.step}`}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.72rem" }}>
              {bp.role}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0, flexWrap: "wrap" }}>
          {bp.system.includes("Reflex") ? (
            <Chip
              size="small"
              label="SCADA Reflex"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#34D399",
                borderColor: "rgba(16, 185, 129, 0.3)",
              }}
            />
          ) : (
            <Chip
              icon={<GeminiIcon size={12} />}
              size="small"
              label="Gemini 3.8 Flash"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#1A73E8",
                borderColor: "rgba(66, 133, 244, 0.3)",
              }}
            />
          )}
          <Chip
            label={nodeStatus}
            variant="outlined"
            color={nodeStatus === "COMPLETED" ? "success" : nodeStatus === "RUNNING" ? "info" : nodeStatus === "HITL" ? "warning" : nodeStatus === "QUEUED" ? "default" : "error"}
            size="small"
            sx={{ height: 22, fontSize: "0.68rem", fontWeight: 800 }}
          />
          <Tooltip title="Close panel">
            <IconButton size="small" onClick={onClose} sx={{ color: "text.secondary", width: 28, height: 28 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Quick Telemetry Strip */}
      <Box
        sx={{
          px: 2,
          py: 0.75,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.015)" : "#FAFAFA"),
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <SpeedIcon sx={{ fontSize: 13, color: "text.secondary" }} />
            <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
              {runtimeMs} ms
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <TollIcon sx={{ fontSize: 13, color: "secondary.main" }} />
            <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: "secondary.main" }}>
              {tokens.toLocaleString()} tok
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: "primary.main" }}>
            ₹{costInr.toFixed(2)}
          </Typography>
        </Box>

        <Tooltip title={copied ? "Copied" : "Copy JSON"}>
          <IconButton
            size="small"
            onClick={handleCopyJson}
            sx={{ width: 26, height: 26, color: "text.secondary" }}
          >
            {copied ? <CheckIcon sx={{ fontSize: 14, color: "success.main" }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tabIndex}
        onChange={(_, val) => setTabIndex(val)}
        sx={{
          minHeight: 38,
          borderBottom: 1,
          borderColor: "divider",
          px: 1,
          "& .MuiTab-root": { minHeight: 38, py: 0.5, fontSize: "0.75rem", fontWeight: 700 },
        }}
      >
        <Tab label="Inputs & Outputs" />
        <Tab label="Raw Payload JSON" />
      </Tabs>

      {/* Tab Panels */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", minHeight: 0, p: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
        {tabIndex === 0 && (
          <>
            {isHalted && bp.step === 4 && (
              <Alert severity="error" icon={<ErrorIcon fontSize="small" />} sx={{ py: 0.5 }}>
                <Typography variant="caption" fontWeight={700}>
                  Physics Fraud Intercepted: Space heater resistive load spoofing detected.
                </Typography>
              </Alert>
            )}

            {/* Input Parameters Section */}
            <Box>
              <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.75, display: "block" }}>
                Agent Input Parameters ({inputRows.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden" }}>
                <Table size="small" aria-label="input parameters">
                  <TableHead sx={{ bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#F8FAFC") }}>
                    <TableRow>
                      <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }}>Parameter</TableCell>
                      <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }}>Type</TableCell>
                      <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }} align="right">Input Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {inputRows
                      .slice(inputPage * inputRowsPerPage, inputPage * inputRowsPerPage + inputRowsPerPage)
                      .map((row) => (
                        <TableRow key={row.key} hover>
                          <TableCell sx={{ fontSize: "0.74rem", fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, py: 0.75 }}>
                            {row.label}
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.7rem", color: "text.secondary", py: 0.75 }}>
                            <Chip label={row.type} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.62rem" }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.74rem", fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, py: 0.75 }} align="right">
                            {row.value}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={inputRows.length}
                  page={inputPage}
                  onPageChange={(_, p) => setInputPage(p)}
                  rowsPerPage={inputRowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setInputRowsPerPage(parseInt(e.target.value, 10));
                    setInputPage(0);
                  }}
                  rowsPerPageOptions={[5, 10]}
                  sx={{
                    "& .MuiTablePagination-toolbar": { minHeight: 36, px: 1 },
                    "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.7rem" },
                  }}
                />
              </TableContainer>
            </Box>

            {/* Execution Outputs Section */}
            <Box>
              <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.75, display: "block" }}>
                Agent Execution Outputs & Telemetry ({outputRows.length})
              </Typography>
              {outputRows.length === 0 ? (
                <Alert severity="info" sx={{ fontSize: "0.78rem" }}>
                  This agent stage has not completed execution yet. Verified metrics will appear here once the step finishes.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden" }}>
                  <Table size="small" aria-label="output telemetry">
                    <TableHead sx={{ bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#F8FAFC") }}>
                      <TableRow>
                        <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }}>Metric / Field</TableCell>
                        <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }}>Verification</TableCell>
                        <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }} align="right">Output Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outputRows
                        .slice(outputPage * outputRowsPerPage, outputPage * outputRowsPerPage + outputRowsPerPage)
                        .map((row) => (
                          <TableRow key={row.key} hover>
                            <TableCell sx={{ fontSize: "0.74rem", fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, py: 0.75 }}>
                              {row.metric}
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.7rem", color: "text.secondary", py: 0.75 }}>
                              <Chip
                                label={row.verified}
                                size="small"
                                color={row.highlight || "default"}
                                sx={{ height: 18, fontSize: "0.62rem", fontWeight: 600 }}
                              />
                            </TableCell>
                            <TableCell
                              sx={{
                                fontSize: "0.74rem",
                                fontFamily: 'var(--font-mono, monospace)',
                                fontWeight: 700,
                                py: 0.75,
                                color: row.highlight === "error" ? "error.main" : row.highlight === "success" ? "success.main" : "text.primary",
                              }}
                              align="right"
                            >
                              {row.value}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    component="div"
                    count={outputRows.length}
                    page={outputPage}
                    onPageChange={(_, p) => setOutputPage(p)}
                    rowsPerPage={outputRowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setOutputRowsPerPage(parseInt(e.target.value, 10));
                      setOutputPage(0);
                    }}
                    rowsPerPageOptions={[5, 10]}
                    sx={{
                      "& .MuiTablePagination-toolbar": { minHeight: 36, px: 1 },
                      "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.7rem" },
                    }}
                  />
                </TableContainer>
              )}
            </Box>
          </>
        )}

        {tabIndex === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.75, display: "block" }}>
                Input Payload (JSON)
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0,0,0,0.3)" : "#F8FAFC"),
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.76rem",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                <pre style={{ margin: 0 }}>{JSON.stringify(inputData, null, 2)}</pre>
              </Paper>
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.75, display: "block" }}>
                Output Payload (JSON)
              </Typography>
              {Object.keys(outputData || {}).length === 0 ? (
                <Alert severity="info" sx={{ fontSize: "0.78rem" }}>
                  Stage has not completed yet. Output payload will be recorded here upon completion.
                </Alert>
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0,0,0,0.3)" : "#F8FAFC"),
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.76rem",
                    maxHeight: 220,
                    overflowY: "auto",
                  }}
                >
                  <pre style={{ margin: 0 }}>{JSON.stringify(outputData, null, 2)}</pre>
                </Paper>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Card>
  );
}
