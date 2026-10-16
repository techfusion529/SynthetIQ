"use client";

import React, { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import LinearProgress from "@mui/material/LinearProgress";

import SmartToyIcon from "@mui/icons-material/SmartToy";
import TuneIcon from "@mui/icons-material/Tune";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import StorageIcon from "@mui/icons-material/Storage";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorIcon from "@mui/icons-material/Error";
import SpeedIcon from "@mui/icons-material/Speed";
import CodeIcon from "@mui/icons-material/Code";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckIcon from "@mui/icons-material/Check";
import BoltIcon from "@mui/icons-material/Bolt";
import KeyIcon from "@mui/icons-material/Key";
import TerminalIcon from "@mui/icons-material/Terminal";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { useSession } from "../../lib/contexts/SessionContext";
import { useNotification } from "../../lib/contexts/NotificationContext";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1` : "/api/v1")
    : typeof window !== "undefined"
    ? "/api/v1"
    : "http://localhost:8000/api/v1";

interface AgentConfig {
  config_id: string;
  org_id: string;
  agent_name: string;
  data_source_id: string | null;
  data_source_name: string | null;
  model_name: string;
  temperature: number;
  system_prompt: string | null;
  parameters: Record<string, any>;
  is_active: boolean;
}

interface DataSource {
  source_id: string;
  name: string;
  source_type: string;
  purpose: string;
}

interface AgentScenario {
  id: string;
  name: string;
  badge: string;
  badgeColor: "success" | "warning" | "error" | "info" | "primary" | "secondary";
  description: string;
  payload: Record<string, any>;
}

const AGENT_LABELS: Record<string, { label: string; role: string; defaultPurpose: string }> = {
  brand_liability: {
    label: "Brand Liability Agent",
    role: "System 2 Reasoning — Ingests ERP packaging data & applies 1/3 debt amortization",
    defaultPurpose: "erp_sales",
  },
  regulatory_watchdog: {
    label: "Regulatory Watchdog",
    role: "System 2 Reasoning — Parses CPCB Gazette rules & base clearing rates",
    defaultPurpose: "regulatory",
  },
  treasury: {
    label: "Treasury Agent",
    role: "System 2 Optimization — Executes continuous double auction & clearing corridors",
    defaultPurpose: "auction",
  },
  logistics: {
    label: "Logistics Agent",
    role: "System 2 Verification — Validates GST E-Way bills & weighbridge waypoints",
    defaultPurpose: "logistics",
  },
  auditor: {
    label: "Auditor Agent (Nimble/Jev)",
    role: "System 1 Reflex — Extruder SCADA physics audit for resistive heater spoofing",
    defaultPurpose: "scada_telemetry",
  },
  erp: {
    label: "ERP Agent",
    role: "System 2 Transaction — Manages 80/20 split escrow purchase orders",
    defaultPurpose: "erp_po",
  },
  legal: {
    label: "Legal Agent",
    role: "System 2 Attestation — Signs CPCB Form-1 filing packets with DSC keys",
    defaultPurpose: "cpcb_portal",
  },
  recycler_scoring: {
    label: "Recycler Scoring Agent",
    role: "System 1 Quality — Scores recyclers on moisture, contamination & uptime",
    defaultPurpose: "quality_control",
  },
  dispute: {
    label: "Dispute & Arbitration Agent",
    role: "System 2 Arbitration — Arbitrates yield discrepancies & moisture penalties",
    defaultPurpose: "arbitration",
  },
};

const AGENT_SCENARIOS: Record<string, AgentScenario[]> = {
  brand_liability: [
    {
      id: "std_packaging",
      name: "Multi-Category ERP Invoices",
      badge: "Standard ERP",
      badgeColor: "info",
      description: "Aggregates 4 polymer streams across sales invoices with statutory 1/3 debt amortization.",
      payload: {
        fiscal_year: "FY2026-27",
        sales_records: [
          { category: "cat_i_rigid", units_sold: 450000, plastic_weight_kg: 0.045 },
          { category: "cat_ii_flexible", units_sold: 820000, plastic_weight_kg: 0.018 },
          { category: "cat_iii_mlp", units_sold: 310000, plastic_weight_kg: 0.012 },
          { category: "cat_iv_compostable", units_sold: 120000, plastic_weight_kg: 0.022 },
        ],
      },
    },
    {
      id: "surge_volume",
      name: "High-Volume Beverage Surge",
      badge: "Surge Peak",
      badgeColor: "primary",
      description: "Peak festival season packaging sales dominated by Category I Rigid PET containers.",
      payload: {
        fiscal_year: "FY2026-27",
        sales_records: [
          { category: "cat_i_rigid", units_sold: 2800000, plastic_weight_kg: 0.038 },
          { category: "cat_ii_flexible", units_sold: 950000, plastic_weight_kg: 0.015 },
        ],
      },
    },
    {
      id: "zero_historic_debt",
      name: "Greenfield Baseline (Zero Debt)",
      badge: "Zero Debt",
      badgeColor: "success",
      description: "Clean FY2026-27 baseline without past unfulfilled carry-forward liability.",
      payload: {
        fiscal_year: "FY2026-27",
        sales_records: [
          { category: "cat_i_rigid", units_sold: 150000, plastic_weight_kg: 0.035 },
          { category: "cat_ii_flexible", units_sold: 180000, plastic_weight_kg: 0.020 },
        ],
      },
    },
  ],
  auditor: [
    {
      id: "genuine_extrusion",
      name: "Genuine High-Viscosity Extrusion",
      badge: "Legit Physics",
      badgeColor: "success",
      description: "Induction motor drawing 45.2 Nm torque at 0.84 power factor with 250 kg/h melt rate.",
      payload: {
        plant_id: "PLANT-OKHLA-EXTRUDER-02",
        torque_nm: 45.2,
        power_factor: 0.84,
        active_power_kw: 95.0,
        melt_rate_kg_h: 250.0,
        barrel_temp_c: 220.0,
      },
    },
    {
      id: "heater_fraud",
      name: "Resistive Space Heater Fraud Attack",
      badge: "Heater Spoof",
      badgeColor: "error",
      description: "Spoofed run with pure resistive heating coils (PF 0.99) and 1.2 Nm torque (no viscous polymer shear).",
      payload: {
        plant_id: "PLANT-SHAMSHABAD-01",
        torque_nm: 1.2,
        power_factor: 0.99,
        active_power_kw: 88.0,
        melt_rate_kg_h: 0.0,
        barrel_temp_c: 280.0,
      },
    },
    {
      id: "slip_anomaly",
      name: "VFD Mechanical Slip / Belt Shear",
      badge: "Torque Anomaly",
      badgeColor: "warning",
      description: "Motor torque (4.5 Nm) falls below calibrated threshold (8.0 Nm) despite electrical draw.",
      payload: {
        plant_id: "PLANT-VAPI-04",
        torque_nm: 4.5,
        power_factor: 0.89,
        active_power_kw: 55.0,
        melt_rate_kg_h: 60.0,
        barrel_temp_c: 195.0,
      },
    },
  ],
  treasury: [
    {
      id: "balanced_clearing",
      name: "Competitive Reverse Auction",
      badge: "Multi-Bid",
      badgeColor: "success",
      description: "Clearing 450 MT target volume against 3 accredited recyclers under statutory ceiling.",
      payload: {
        target_tons: 450.0,
        bids: [
          { bidder: "EcoPlast Recyclers Okhla", tons: 200.0, rate_inr: 3850.0 },
          { bidder: "Narmada Circular Polymers", tons: 180.0, rate_inr: 4120.0 },
          { bidder: "GreenTech Granules Gujarat", tons: 150.0, rate_inr: 4450.0 },
        ],
      },
    },
    {
      id: "high_volume_crunch",
      name: "Tight Supply Quota Clearing",
      badge: "Supply Crunch",
      badgeColor: "warning",
      description: "Target volume (750 MT) demands partial allocation of the marginal bidder.",
      payload: {
        target_tons: 750.0,
        bids: [
          { bidder: "EcoPlast Recyclers Okhla", tons: 250.0, rate_inr: 3900.0 },
          { bidder: "MahaPolymer Aggregators", tons: 300.0, rate_inr: 4250.0 },
          { bidder: "GreenTech Granules Gujarat", tons: 300.0, rate_inr: 4700.0 },
        ],
      },
    },
  ],
  logistics: [
    {
      id: "valid_transit",
      name: "Compliant E-Way Bill Corridor",
      badge: "Verified Route",
      badgeColor: "success",
      description: "142.5 km journey covered in 4.2 h (33.9 km/h) with 16.3 MT net payload verified at weighbridge.",
      payload: {
        eway_bill_no: "EWB-2026-981248",
        vehicle_no: "DL-1GB-4029",
        distance_km: 142.5,
        transit_hours: 4.2,
        gross_weight_kg: 28400.0,
        tare_weight_kg: 12100.0,
      },
    },
    {
      id: "velocity_fraud",
      name: "GPS Spoofing (Speed > 95 km/h)",
      badge: "Speed Anomaly",
      badgeColor: "error",
      description: "Freight tracking indicates impossible commercial truck velocity (185 km/h), flagging synthetic telematics.",
      payload: {
        eway_bill_no: "EWB-2026-110294",
        vehicle_no: "MH-04-AZ-8831",
        distance_km: 370.0,
        transit_hours: 2.0,
        gross_weight_kg: 24500.0,
        tare_weight_kg: 11000.0,
      },
    },
  ],
  recycler_scoring: [
    {
      id: "tier1_facility",
      name: "Tier-1 Accredited Recycler",
      badge: "Grade A+",
      badgeColor: "success",
      description: "Low moisture (1.2%), minimal contamination (0.8%), and high SCADA uptime (98%).",
      payload: {
        recycler_name: "EcoPlast High-Purity Polymers",
        moisture_content_pct: 1.2,
        contamination_rate_pct: 0.8,
        mass_deviation_pct: 1.5,
        uptime_pct: 98.0,
      },
    },
    {
      id: "high_moisture_facility",
      name: "Moisture & Contamination Penalty",
      badge: "Penalty Deduction",
      badgeColor: "warning",
      description: "Wet baled flakes with 4.5% moisture and 4.2% organic contaminants triggering grade downgrades.",
      payload: {
        recycler_name: "Substandard Reclaimers Unit 3",
        moisture_content_pct: 4.5,
        contamination_rate_pct: 4.2,
        mass_deviation_pct: 6.8,
        uptime_pct: 74.0,
      },
    },
  ],
  erp: [
    {
      id: "standard_escrow",
      name: "80/20 Escrow Split Remittance",
      badge: "Split Settlement",
      badgeColor: "primary",
      description: "Disburses 80% immediate advance on SCADA audit approval and locks 20% in retention escrow.",
      payload: {
        po_number: "PO-SAP-2026-8819",
        fulfilled_tons: 250.0,
        clearing_rate_inr: 4200.0,
        tax_rate_gst: 0.18,
        escrow_deposit_inr: 1500000.0,
      },
    },
    {
      id: "insufficient_escrow",
      name: "Insolvent Escrow Top-Up Alert",
      badge: "Insolvent Escrow",
      badgeColor: "error",
      description: "Remittance required exceeds available escrow balance, halting auto-disbursement.",
      payload: {
        po_number: "PO-SAP-2026-9920",
        fulfilled_tons: 450.0,
        clearing_rate_inr: 4400.0,
        tax_rate_gst: 0.18,
        escrow_deposit_inr: 800000.0,
      },
    },
  ],
  dispute: [
    {
      id: "excess_moisture_arbitration",
      name: "Yield Discrepancy & Moisture Deductions",
      badge: "Arbitrated",
      badgeColor: "warning",
      description: "Claimed 100 MT vs 93.5 MT verified SCADA mass with 4.2% moisture penalty deduction.",
      payload: {
        claimed_tons: 100.0,
        verified_tons: 93.5,
        moisture_pct: 4.2,
        tolerance_pct: 2.0,
      },
    },
    {
      id: "within_tolerance",
      name: "Yield Within Statutory Tolerance",
      badge: "Certified",
      badgeColor: "success",
      description: "Sensor delta within 1.2% allowable error margin, certifying full delivered credits.",
      payload: {
        claimed_tons: 100.0,
        verified_tons: 99.2,
        moisture_pct: 1.4,
        tolerance_pct: 2.0,
      },
    },
  ],
  regulatory_watchdog: [
    {
      id: "cpcb_pwm_2026",
      name: "CPCB PWM Rules 2026 Mandate",
      badge: "Statutory Gazette",
      badgeColor: "info",
      description: "Extracts 100% recycling targets and ₹5,000/MT environmental compensation floor.",
      payload: {
        jurisdiction: "IN-CPCB",
        active_framework: "CPCB PWM Rules 2026 Schedule II",
        statutory_mandate_pct: 100.0,
        environmental_compensation_floor_inr_mt: 5000.0,
        filing_deadline: "30-JUN-2027",
        targets: {
          cat_i_rigid_pct: 100.0,
          cat_ii_flexible_pct: 100.0,
          cat_iii_mlp_pct: 100.0,
          cat_iv_compostable_pct: 100.0,
        },
      },
    },
  ],
  legal: [
    {
      id: "form1_filing",
      name: "Statutory Form-1 DSC Stamping",
      badge: "DSC Signed",
      badgeColor: "success",
      description: "Generates cryptographic SHA-256 manifest hash and attaches Class-3 DSC digital certificate.",
      payload: {
        producer_name: "Acme Consumer Brands India Ltd",
        cpcb_reg_no: "CPCB-EPR-2026-IND-001",
        period: "FY 2026-27",
        total_certified_tons: 1249.88,
      },
    },
  ],
};

const DEFAULT_FALLBACK_CONFIGS: AgentConfig[] = [
  {
    config_id: "default-brand_liability",
    org_id: "ORG-DEV-001",
    agent_name: "brand_liability",
    data_source_id: "DS-DEV-SALES-001",
    data_source_name: "Google BigQuery ERP Sales Connection",
    model_name: "gemini-3.8-flash",
    temperature: 0.2,
    system_prompt:
      "You are the Brand Liability Agent. Query ERP sales data, calculate plastic category weights, apply statutory 1/3 historic debt amortization, and compute net EPR obligation.",
    parameters: {
      amortization_fraction: 0.333,
      categories: ["cat_i_rigid", "cat_ii_flexible", "cat_iii_mlp", "cat_iv_compostable"],
    },
    is_active: true,
  },
  {
    config_id: "default-regulatory_watchdog",
    org_id: "ORG-DEV-001",
    agent_name: "regulatory_watchdog",
    data_source_id: null,
    data_source_name: null,
    model_name: "gemini-3.8-flash",
    temperature: 0.1,
    system_prompt:
      "You are the Regulatory Watchdog Agent. Parse CPCB Gazette notifications, extract plastic waste management rules, and identify statutory base clearing rates and compliance deadlines.",
    parameters: {
      jurisdiction: "IN",
      active_framework: "CPCB Plastic Waste Management Amendment Rules 2026",
    },
    is_active: true,
  },
  {
    config_id: "default-treasury",
    org_id: "ORG-DEV-001",
    agent_name: "treasury",
    data_source_id: null,
    data_source_name: null,
    model_name: "gemini-3.8-flash",
    temperature: 0.2,
    system_prompt:
      "You are the Treasury Agent. Run a continuous double auction matching EPR liability bids with verified recycler offers within the 30%-100% price corridor.",
    parameters: {
      price_corridor_min_pct: 30.0,
      price_corridor_max_pct: 100.0,
      clearing_algorithm: "uniform_price",
    },
    is_active: true,
  },
  {
    config_id: "default-logistics",
    org_id: "ORG-DEV-001",
    agent_name: "logistics",
    data_source_id: null,
    data_source_name: null,
    model_name: "gemini-3.8-flash",
    temperature: 0.1,
    system_prompt:
      "You are the Logistics Agent. Validate GST E-Way bills, match RFID weighbridge timestamps, and compute waypoint telemetry distance vectors to verify plastic batch movements.",
    parameters: {
      gps_max_drift_km: 15.0,
      eway_bill_tolerance_pct: 2.0,
    },
    is_active: true,
  },
  {
    config_id: "default-auditor",
    org_id: "ORG-DEV-001",
    agent_name: "auditor",
    data_source_id: "DS-DEV-SCADA-001",
    data_source_name: "Extruder SCADA Live Telemetry",
    model_name: "gemini-3.8-flash",
    temperature: 0.05,
    system_prompt:
      "You are the Auditor Agent (Nimble/Jev). Execute real-time VFD physics auditing on extruder motor torque and power factor to detect resistive heater spoofing.",
    parameters: {
      torque_threshold_nm: 8.0,
      power_factor_min: 0.78,
      power_factor_max: 0.96,
      audit_mode: "hybrid_ensemble",
    },
    is_active: true,
  },
  {
    config_id: "default-erp",
    org_id: "ORG-DEV-001",
    agent_name: "erp",
    data_source_id: null,
    data_source_name: null,
    model_name: "gemini-3.8-flash",
    temperature: 0.1,
    system_prompt:
      "You are the ERP Agent. Post structured Purchase Orders for verified plastic recycling credits with an automated 80/20 escrow payment split.",
    parameters: {
      escrow_primary_ratio: 0.8,
      escrow_retention_ratio: 0.2,
      erp_system: "sap_s4hana",
    },
    is_active: true,
  },
  {
    config_id: "default-legal",
    org_id: "ORG-DEV-001",
    agent_name: "legal",
    data_source_id: null,
    data_source_name: null,
    model_name: "gemini-3.8-flash",
    temperature: 0.1,
    system_prompt:
      "You are the Legal Agent. Generate statutory CPCB Form-1 filing packets, apply cryptographic Digital Signature Certificates (DSC), and compute SHA-256 audit manifest hashes.",
    parameters: {
      dsc_key_id: "DSC-IN-2026-COMPLIANCE",
      form_template: "CPCB_EPR_ANNUAL_FORM_1",
    },
    is_active: true,
  },
  {
    config_id: "default-recycler_scoring",
    org_id: "ORG-DEV-001",
    agent_name: "recycler_scoring",
    data_source_id: null,
    data_source_name: null,
    model_name: "gemini-3.8-flash",
    temperature: 0.1,
    system_prompt:
      "You are the Recycler Scoring Agent. Evaluate moisture, contamination, and mass deviations to rate recycler credibility.",
    parameters: {
      max_moisture_tolerance_pct: 2.0,
      max_contamination_tolerance_pct: 3.0,
    },
    is_active: true,
  },
  {
    config_id: "default-dispute",
    org_id: "ORG-DEV-001",
    agent_name: "dispute",
    data_source_id: null,
    data_source_name: null,
    model_name: "gemini-3.8-flash",
    temperature: 0.1,
    system_prompt:
      "You are the Dispute & Arbitration Agent. Arbitrate discrepancies between claimed recycler tons and sensor-verified yield.",
    parameters: {
      statutory_discrepancy_tolerance_pct: 2.0,
    },
    is_active: true,
  },
];

export default function AgentConfigStudioPage() {
  const router = useRouter();
  const { user, token } = useSession();
  const orgId = user?.org_id || "ORG-DEV-001";

  const [configs, setConfigs] = useState<AgentConfig[]>(DEFAULT_FALLBACK_CONFIGS);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active selected agent editing state
  const [currentConfig, setCurrentConfig] = useState<AgentConfig | null>(DEFAULT_FALLBACK_CONFIGS[0]);

  // Real-time Playground state
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [playgroundPayload, setPlaygroundPayload] = useState<string>("");
  const [playgroundTab, setPlaygroundTab] = useState<number>(0); // 0: Visual Analysis, 1: Raw Output JSON
  const [copied, setCopied] = useState<boolean>(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [provider, setProvider] = useState<"auto" | "ollama" | "gemini">("auto");

  // Custom API key override & prompt inspector
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(false);
  const [showPromptInspector, setShowPromptInspector] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const fetchWithFallback = async (pathSlash: string, pathNoSlash: string) => {
        let r = await fetch(pathSlash, { headers }).catch((err) => {
          console.warn("Fetch with slash error:", err);
          return null;
        });
        if (!r || !r.ok) {
          const r2 = await fetch(pathNoSlash, { headers }).catch((err) => {
            console.warn("Fetch without slash error:", err);
            return null;
          });
          if (r2 && r2.ok) return r2;
        }
        return r;
      };

      const [cfgResp, dsResp] = await Promise.all([
        fetchWithFallback(
          `${API_BASE}/organizations/${encodeURIComponent(orgId)}/agents/`,
          `${API_BASE}/organizations/${encodeURIComponent(orgId)}/agents`
        ),
        fetchWithFallback(
          `${API_BASE}/organizations/${encodeURIComponent(orgId)}/data-sources`,
          `${API_BASE}/organizations/${encodeURIComponent(orgId)}/data-sources/`
        ),
      ]);

      let cfgData: AgentConfig[] = [];
      let dsData: DataSource[] = [];

      if (cfgResp && cfgResp.ok) {
        cfgData = await cfgResp.json();
      }
      if (dsResp && dsResp.ok) {
        dsData = await dsResp.json();
      }

      if (cfgData.length > 0) {
        // Merge with full presets list so all 9 agents are accessible
        const mergedConfigs = [...cfgData];
        for (const fb of DEFAULT_FALLBACK_CONFIGS) {
          if (!mergedConfigs.some((c) => c.agent_name === fb.agent_name)) {
            mergedConfigs.push({ ...fb, org_id: orgId });
          }
        }
        setConfigs(mergedConfigs);
        setCurrentConfig((prev) =>
          prev ? mergedConfigs.find((c) => c.agent_name === prev.agent_name) || mergedConfigs[0] : mergedConfigs[0]
        );
      } else {
        const tenantDefaults = DEFAULT_FALLBACK_CONFIGS.map((c) => ({ ...c, org_id: orgId }));
        setConfigs(tenantDefaults);
        setCurrentConfig((prev) =>
          prev ? tenantDefaults.find((c) => c.agent_name === prev.agent_name) || tenantDefaults[0] : tenantDefaults[0]
        );
        if (!cfgResp || !cfgResp.ok) {
          const statusText = cfgResp ? `status ${cfgResp.status}` : "connection refused";
          setError(
            `Backend API (${API_BASE}) returned ${statusText}. Showing multi-agent configuration templates.`
          );
        }
      }

      setDataSources(dsData);
    } catch (e: any) {
      console.warn("Agent studio load error:", e);
      const tenantDefaults = DEFAULT_FALLBACK_CONFIGS.map((c) => ({ ...c, org_id: orgId }));
      setConfigs(tenantDefaults);
      setCurrentConfig((prev) => prev || tenantDefaults[0]);
      setError(`Notice: Using default agent templates (${e?.message || "Offline"}).`);
    } finally {
      setLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync initial scenario whenever currentConfig changes
  useEffect(() => {
    if (currentConfig) {
      const scenarios = AGENT_SCENARIOS[currentConfig.agent_name] || [
        {
          id: "default",
          name: "Standard Parameters",
          badge: "Default",
          badgeColor: "info" as const,
          description: `Default execution payload for ${currentConfig.agent_name}`,
          payload: { fiscal_year: "FY2026-27", org_id: orgId },
        },
      ];
      setSelectedScenarioId(scenarios[0].id);
      setPlaygroundPayload(JSON.stringify(scenarios[0].payload, null, 2));
      setTestResult(null);
    }
  }, [currentConfig?.agent_name, orgId]);

  const handleTabChange = (_: any, newIdx: number) => {
    setActiveTab(newIdx);
    setCurrentConfig(configs[newIdx] || null);
    setSaveSuccess(false);
  };

  const handleSelectScenario = (scenario: AgentScenario) => {
    setSelectedScenarioId(scenario.id);
    setPlaygroundPayload(JSON.stringify(scenario.payload, null, 2));
  };

  const handleResetPayload = () => {
    if (!currentConfig) return;
    const scenarios = AGENT_SCENARIOS[currentConfig.agent_name] || [];
    const active = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];
    if (active) {
      setPlaygroundPayload(JSON.stringify(active.payload, null, 2));
      notify.info(`Reset playground payload to "${active.name}"`);
    }
  };

  const { notify } = useNotification();

  const handleSave = async () => {
    if (!currentConfig) return;
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const resp = await fetch(
        `${API_BASE}/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(currentConfig.agent_name)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            data_source_id: currentConfig.data_source_id,
            model_name: currentConfig.model_name,
            temperature: currentConfig.temperature,
            system_prompt: currentConfig.system_prompt,
            parameters: currentConfig.parameters,
            is_active: currentConfig.is_active,
          }),
        }
      );

      if (!resp.ok) throw new Error("Failed to save agent configuration");
      setSaveSuccess(true);
      notify.success(`Configuration saved for ${currentConfig.agent_name}`, "Agent Config Updated");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message);
      notify.error(e.message, "Save Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRunPlayground = async () => {
    if (!currentConfig) return;
    setTesting(true);
    setTestResult(null);

    let parsedPayload: Record<string, any> = {};
    try {
      parsedPayload = playgroundPayload.trim() ? JSON.parse(playgroundPayload) : {};
    } catch (e: any) {
      notify.error(`Invalid JSON in playground: ${e.message}`, "Payload Syntax Error");
      setTesting(false);
      return;
    }

    const sampleInput = {
      ...parsedPayload,
      provider: provider,
      ...(customApiKey.trim() ? { gemini_api_key: customApiKey.trim() } : {}),
    };

    try {
      const resp = await fetch(
        `${API_BASE}/organizations/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(currentConfig.agent_name)}/test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ sample_input: sampleInput }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || data.detail) {
        const errMsg = data.detail || "Playground execution failed";
        setTestResult({ status: "ERROR", error: errMsg });
        notify.error(errMsg, "Playground Execution Failed");
      } else {
        setTestResult(data);
        notify.success(
          `Agent simulated in ${data.latency_ms || 0}ms (${data.records_analyzed ?? 1} records)`,
          "Playground Recalculated"
        );
      }
    } catch (e: any) {
      setTestResult({ status: "ERROR", error: e.message });
      notify.error(e.message, "Network Error");
    } finally {
      setTesting(false);
    }
  };

  const handleCopyResult = () => {
    if (!testResult) return;
    navigator.clipboard.writeText(JSON.stringify(testResult, null, 2));
    setCopied(true);
    notify.success("Output JSON copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const agentMeta = currentConfig ? AGENT_LABELS[currentConfig.agent_name] : null;
  const currentScenarios = currentConfig ? AGENT_SCENARIOS[currentConfig.agent_name] || [] : [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <PageHeader
        title="Agent Studio & Real-Time Playground"
        icon={<SmartToyIcon fontSize="medium" />}
        description="Tune Gemini prompts & domain hyperparameters on the left, then run dynamic physics simulations and reverse auctions in the real-time playground on the right."
        actions={
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !currentConfig}
          >
            {saving ? "Saving Changes..." : "Save Configuration"}
          </Button>
        }
      />

      {saveSuccess && (
        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
          Agent configuration saved successfully for tenant {orgId}.
        </Alert>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {/* Agent Selector Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.9rem" },
        }}
      >
        {configs.map((c) => (
          <Tab key={c.agent_name} label={AGENT_LABELS[c.agent_name]?.label || c.agent_name} />
        ))}
      </Tabs>

      {currentConfig && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "5fr 7fr" }, gap: 3, alignItems: "start" }}>
          {/* ========================================================= */}
          {/* LEFT COLUMN: Configuration + Simulation Controls (Inputs) */}
          {/* ========================================================= */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* 1. Agent Architecture & Parameter Card */}
            <Card variant="outlined" sx={{ bgcolor: "background.paper", borderColor: "divider", borderRadius: 2 }}>
              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {agentMeta?.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {agentMeta?.role}
                  </Typography>
                </Box>

                <Divider />

                {/* Data Source Binding */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75 }}>
                    <StorageIcon fontSize="small" /> BOUND DATA SOURCE
                  </Typography>
                  <TextField
                    select
                    size="small"
                    value={currentConfig.data_source_id || ""}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, data_source_id: e.target.value || null })}
                    fullWidth
                  >
                    <MenuItem value="">— Use Default Engine Simulator —</MenuItem>
                    {dataSources.map((ds) => (
                      <MenuItem key={ds.source_id} value={ds.source_id}>
                        {ds.name} ({ds.source_type.toUpperCase()} • {ds.purpose})
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                {/* LLM Model Selection & Temperature */}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                  <TextField
                    select
                    label="Target LLM"
                    size="small"
                    value={currentConfig.model_name || "gemini-3.8-flash"}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, model_name: e.target.value })}
                  >
                    <MenuItem value="gemini-3.8-flash">Gemini 3.8 Flash</MenuItem>
                    <MenuItem value="gemini-4-argon">Gemini 4 Argon</MenuItem>
                    <MenuItem value="gemini-2.5-flash">Gemini 2.5 Flash</MenuItem>
                    <MenuItem value="gemini-1.5-pro">Gemini 1.5 Pro</MenuItem>
                    <MenuItem value="gpt-oss:20b-cloud">gpt-oss:20b (Ollama)</MenuItem>
                  </TextField>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                      Temperature: {currentConfig.temperature}
                    </Typography>
                    <Slider
                      size="small"
                      value={currentConfig.temperature}
                      min={0.0}
                      max={1.0}
                      step={0.05}
                      onChange={(_, val) => setCurrentConfig({ ...currentConfig, temperature: val as number })}
                    />
                  </Box>
                </Box>

                {/* Custom System Prompt */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700 }}>
                    SYSTEM INSTRUCTIONS / PROMPT
                  </Typography>
                  <TextField
                    multiline
                    rows={3}
                    size="small"
                    fullWidth
                    value={currentConfig.system_prompt || ""}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, system_prompt: e.target.value })}
                    placeholder="Enter custom instructions to tailor agent reasoning..."
                  />
                </Box>

                {/* Agent Hyperparameters */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75 }}>
                    <TuneIcon fontSize="small" /> DOMAIN HYPERPARAMETERS (JSON)
                  </Typography>
                  <TextField
                    multiline
                    rows={3}
                    size="small"
                    fullWidth
                    value={JSON.stringify(currentConfig.parameters, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setCurrentConfig({ ...currentConfig, parameters: parsed });
                      } catch {
                        // Allow typing in JSON
                      }
                    }}
                    sx={{ "& textarea": { fontFamily: 'var(--font-mono, monospace)', fontSize: "0.8rem" } }}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* 2. Simulation Input & Execution Engine Card */}
            <Card variant="outlined" sx={{ bgcolor: "background.paper", borderColor: "divider", borderRadius: 2 }}>
              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <BoltIcon sx={{ color: "warning.main", fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Playground Simulation Inputs
                    </Typography>
                  </Box>
                  <Chip label="Live Engine" size="small" color="primary" sx={{ fontWeight: 700, height: 22, fontSize: "0.7rem" }} />
                </Box>

                {/* Preset Scenario Selector */}
                {currentScenarios.length > 0 && (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                      SELECT PRESET SCENARIO
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                      {currentScenarios.map((sc) => {
                        const isSelected = selectedScenarioId === sc.id;
                        return (
                          <Chip
                            key={sc.id}
                            label={`${sc.name}`}
                            color={isSelected ? sc.badgeColor : "default"}
                            variant={isSelected ? "filled" : "outlined"}
                            onClick={() => handleSelectScenario(sc)}
                            size="small"
                            sx={{ fontWeight: isSelected ? 700 : 500, cursor: "pointer" }}
                          />
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {/* Editable Payload JSON */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}>
                      <CodeIcon sx={{ fontSize: 15 }} /> SIMULATION PAYLOAD (JSON)
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<RefreshIcon sx={{ fontSize: 13 }} />}
                      onClick={handleResetPayload}
                      sx={{ textTransform: "none", py: 0, fontSize: "0.72rem" }}
                    >
                      Reset Payload
                    </Button>
                  </Box>
                  <TextField
                    multiline
                    rows={5}
                    size="small"
                    fullWidth
                    value={playgroundPayload}
                    onChange={(e) => setPlaygroundPayload(e.target.value)}
                    placeholder="Enter JSON simulation payload..."
                    sx={{
                      "& textarea": {
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: "0.8rem",
                        lineHeight: 1.35,
                      },
                      bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0, 0, 0, 0.25)" : "rgba(0, 0, 0, 0.02)"),
                    }}
                  />
                </Box>

                {/* Execution Provider Selector */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                    INFERENCE BACKEND PROVIDER
                  </Typography>
                  <TextField
                    select
                    size="small"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as any)}
                    fullWidth
                  >
                    <MenuItem value="auto">
                      ⚡ Auto (Google Gemini Cloud → Fallback to Local Ollama)
                    </MenuItem>
                    <MenuItem value="ollama">
                      💻 Local Ollama (gpt-oss:20b-cloud - Free & Unlimited)
                    </MenuItem>
                    <MenuItem value="gemini">
                      ☁️ Google Gemini Cloud (gemini-3.8-flash)
                    </MenuItem>
                  </TextField>
                </Box>

                {/* Custom Gemini API Key Override (Optional) */}
                <Box>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<KeyIcon sx={{ fontSize: 14 }} />}
                    onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                    sx={{ textTransform: "none", fontSize: "0.72rem", p: 0.5, color: "text.secondary" }}
                  >
                    {showApiKeyInput ? "Hide Custom API Key" : "Add Personal Gemini API Key (Optional)"}
                  </Button>
                  {showApiKeyInput && (
                    <Box
                      sx={{
                        mt: 0.75,
                        p: 1.25,
                        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0, 0, 0, 0.25)" : "rgba(0, 0, 0, 0.02)"),
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <TextField
                        size="small"
                        fullWidth
                        type="password"
                        placeholder="Paste AIzaSy... API key"
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        InputProps={{
                          startAdornment: <KeyIcon sx={{ fontSize: 15, mr: 1, color: "text.secondary" }} />,
                        }}
                      />
                    </Box>
                  )}
                </Box>

                {/* Execution Run Trigger Button */}
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="medium"
                  startIcon={testing ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                  onClick={handleRunPlayground}
                  disabled={testing}
                  sx={{ fontWeight: 700, py: 1.2, textTransform: "none", fontSize: "0.92rem" }}
                >
                  {testing ? "Simulating Live Agent Reasoning..." : `Run ${agentMeta?.label || "Agent"} Simulation`}
                </Button>
              </CardContent>
            </Card>
          </Box>

          {/* ========================================================== */}
          {/* RIGHT COLUMN: Simulation Results & Telemetry Output        */}
          {/* ========================================================== */}
          <Card
            variant="outlined"
            sx={{
              bgcolor: "background.paper",
              borderColor: "divider",
              borderRadius: 2,
              minHeight: 560,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
              {/* Header with Subtabs & Export */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: 1, borderColor: "divider", pb: 1 }}>
                <Tabs
                  value={playgroundTab}
                  onChange={(_, val) => setPlaygroundTab(val)}
                  sx={{
                    minHeight: 34,
                    "& .MuiTab-root": { minHeight: 34, py: 0.25, textTransform: "none", fontWeight: 700, fontSize: "0.85rem" },
                  }}
                >
                  <Tab icon={<AssessmentIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Interactive Analysis" />
                  <Tab icon={<CodeIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Raw Output JSON" />
                </Tabs>

                {testResult && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                    onClick={handleCopyResult}
                    sx={{ textTransform: "none", fontSize: "0.72rem", py: 0.25 }}
                  >
                    {copied ? "Copied" : "Copy Output"}
                  </Button>
                )}
              </Box>

              {/* State 1: In Progress Loading State */}
              {testing && (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 12, gap: 2, my: "auto" }}>
                  <CircularProgress size={36} />
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Executing Live Agent Reasoning
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Invoking {provider === "ollama" ? "Local Ollama (gpt-oss:20b-cloud)" : "Google Gemini Cloud"} & verifying statutory equations...
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* State 2: Ready / Empty Initial State */}
              {!testing && !testResult && (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 10, gap: 2, my: "auto", textAlign: "center", px: 4 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: "50%",
                      bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(139, 92, 246, 0.12)" : "rgba(124, 58, 237, 0.08)"),
                      color: "primary.main",
                    }}
                  >
                    <SmartToyIcon sx={{ fontSize: 44 }} />
                  </Paper>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {agentMeta?.label} Ready for Simulation
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mt: 0.5 }}>
                      Select a preset scenario on the left, adjust parameters or the inference provider, and click <b>Run Agent Simulation</b> to observe live neural decision-making, SCADA physics audits, and financial ledger outputs.
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* State 3: Results Display */}
              {!testing && testResult && (
                <>
                  {/* TAB 0: Visual Interactive Analysis */}
                  {playgroundTab === 0 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {/* Verdict Banner */}
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Chip
                            label={testResult.verdict || testResult.status}
                            color={
                              testResult.status === "ERROR" ||
                              testResult.verdict === "REJECTED_FRAUD" ||
                              testResult.status === "FRAUD_DETECTED" ||
                              testResult.status === "INSUFFICIENT_ESCROW"
                                ? "error"
                                : testResult.verdict?.includes("SUSPICIOUS") ||
                                  testResult.verdict?.includes("ADJUSTMENT") ||
                                  testResult.verdict?.includes("ANOMALY")
                                ? "warning"
                                : "success"
                            }
                            sx={{ fontWeight: 700, fontSize: "0.85rem", letterSpacing: 0.5 }}
                          />
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}
                          >
                            <SpeedIcon sx={{ fontSize: 15 }} /> {testResult.latency_ms ?? 0} ms
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            • {testResult.records_analyzed ?? 1} records analyzed
                          </Typography>
                        </Box>
                        <Chip
                          label={testResult.data_source_used || "Dynamic Simulator"}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: "0.75rem", borderColor: "divider" }}
                        />
                      </Box>

                      {/* LLM Model Call & Telemetry Inspector Banner */}
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(15, 23, 42, 0.6)" : "rgba(248, 250, 252, 0.9)"),
                          border: "1px solid",
                          borderColor: testResult.live_inference ? "success.dark" : "warning.dark",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                            {testResult.live_inference ? (
                              <Chip
                                icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                                label={testResult.llm_telemetry?.provider || `Live LLM API Connected • ${testResult.model_used || "gemini-3.8-flash"}`}
                                color="success"
                                size="small"
                                sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                              />
                            ) : (
                              <Chip
                                icon={<TuneIcon sx={{ fontSize: 14 }} />}
                                label={`Deterministic System 2 Engine • ${testResult.model_used || "gemini-3.8-flash"}`}
                                color="warning"
                                size="small"
                                variant="outlined"
                                sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                              />
                            )}

                            <Chip
                              label={`${testResult.tokens || testResult.llm_telemetry?.total_tokens || 0} tokens`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.72rem", height: 22 }}
                            />
                            <Chip
                              label={`$${Number(testResult.cost_usd || 0).toFixed(4)} (~₹${Number(testResult.cost_inr || 0).toFixed(2)})`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.72rem", height: 22 }}
                            />
                          </Box>

                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<TerminalIcon sx={{ fontSize: 14 }} />}
                            onClick={() => setShowPromptInspector(!showPromptInspector)}
                            sx={{ textTransform: "none", fontSize: "0.75rem", py: 0.25 }}
                          >
                            {showPromptInspector ? "Hide Dispatched Prompt" : "Inspect Model Call & Dispatched Prompt"}
                          </Button>
                        </Box>

                        {/* Model Diagnostic Context when running in fallback */}
                        {!testResult.live_inference && (
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
                            ℹ️ <b>Why Fallback Engine?</b> The default Google AI Studio project credits are depleted ({testResult.api_status || "HTTP 402/429 Quota Exhausted"}). Select <b>Local Ollama</b> in the inference backend dropdown to run free, unconstrained local neural reasoning.
                          </Typography>
                        )}

                        {/* Expandable Dispatched Prompt Inspector */}
                        {showPromptInspector && (
                          <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                            <Divider />
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
                                DISPATCHED PROMPT SENT TO MODEL:
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>
                                Model: {testResult.model_used || "gemini-3.8-flash"} | Temp: {testResult.temperature ?? 0.2}
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.04)"),
                                border: "1px solid",
                                borderColor: "divider",
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: "0.78rem",
                                whiteSpace: "pre-wrap",
                                maxHeight: 220,
                                overflowY: "auto",
                                color: (t) => (t.palette.mode === "dark" ? "#93c5fd" : "#1e40af"),
                              }}
                            >
                              {testResult.prompt_sent || (testResult.raw_input_evaluated ? JSON.stringify(testResult.raw_input_evaluated, null, 2) : "No raw prompt captured.")}
                            </Box>

                            {testResult.system_instruction && (
                              <>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                                  SYSTEM INSTRUCTION:
                                </Typography>
                                <Typography variant="caption" sx={{ fontStyle: "italic", color: "text.secondary" }}>
                                  {testResult.system_instruction}
                                </Typography>
                              </>
                            )}

                            {testResult.raw_api_error && (
                              <Alert severity="warning" sx={{ mt: 1, py: 0.5, fontSize: "0.75rem" }}>
                                <b>Google Gemini API Diagnostic:</b> {testResult.raw_api_error}
                              </Alert>
                            )}
                          </Box>
                        )}
                      </Paper>

                      {/* AI Reasoning Narrative */}
                      {testResult.reasoning_narrative && (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            bgcolor: (t) =>
                              t.palette.mode === "dark" ? "rgba(139, 92, 246, 0.08)" : "rgba(124, 58, 237, 0.04)",
                            borderColor: (t) =>
                              t.palette.mode === "dark" ? "rgba(139, 92, 246, 0.25)" : "rgba(124, 58, 237, 0.2)",
                            borderRadius: 1.5,
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                            <AutoAwesomeIcon sx={{ fontSize: 18, color: "primary.main" }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main" }}>
                              Agent Reasoning & Analysis Narrative
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>
                            {testResult.reasoning_narrative}
                          </Typography>
                        </Paper>
                      )}

                      {/* Detected Anomalies Alert (Auditor / Logistics / Dispute) */}
                      {testResult.anomalies_detected && testResult.anomalies_detected.length > 0 && (
                        <Alert severity="error" icon={<WarningAmberIcon />}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                            Critical Physics & Telemetry Anomalies Flagged:
                          </Typography>
                          <Box component="ul" sx={{ m: 0, pl: 2 }}>
                            {testResult.anomalies_detected.map((anom: string, i: number) => (
                              <li key={i}>
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                  {anom}
                                </Typography>
                              </li>
                            ))}
                          </Box>
                        </Alert>
                      )}

                      {/* KPI Metrics Grid */}
                      {testResult.kpis && typeof testResult.kpis === "object" && (
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1.5 }}>
                          {Object.entries(testResult.kpis)
                            .slice(0, 4)
                            .map(([key, val]) => (
                              <Paper
                                key={key}
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  bgcolor: (t) =>
                                    t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
                                  borderColor: "divider",
                                  borderRadius: 1.5,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{ color: "text.secondary", textTransform: "capitalize", display: "block" }}
                                >
                                  {key.replace(/_/g, " ")}
                                </Typography>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 0.5 }}>
                                  {typeof val === "number"
                                    ? val.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                    : String(val)}
                                </Typography>
                              </Paper>
                            ))}
                        </Box>
                      )}

                      {/* Execution Trace Timeline */}
                      {testResult.execution_trace && Array.isArray(testResult.execution_trace) && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 0.5 }}>
                            EXECUTION PIPELINE TRACE
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                            {testResult.execution_trace.map((step: any, idx: number) => {
                              const isFailed = step.status === "FAILED" || step.status === "FLAGGED";
                              return (
                                <Box
                                  key={idx}
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    p: 1,
                                    borderRadius: 1,
                                    bgcolor: (t) =>
                                      t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.01)",
                                    border: "1px solid",
                                    borderColor: isFailed ? "error.main" : "divider",
                                  }}
                                >
                                  {isFailed ? (
                                    <ErrorIcon sx={{ fontSize: 18, color: "error.main" }} />
                                  ) : (
                                    <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
                                  )}
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                                      {step.step}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                                      {step.details}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={step.status}
                                    size="small"
                                    color={isFailed ? "error" : step.status === "DYNAMIC_SYNTHESIS" ? "warning" : "success"}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
                                  />
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      )}

                      {/* Domain Breakdown: Category Packaging Tons (Brand Liability) */}
                      {testResult.category_breakdown_tons && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 0.5 }}>
                            POLYMER CATEGORY BREAKDOWN (METRIC TONS)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 700 }}>Polymer Category</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700 }}>Calculated Volume (MT)</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {Object.entries(testResult.category_breakdown_tons).map(([cat, tons]: [string, any]) => (
                                  <TableRow key={cat}>
                                    <TableCell sx={{ textTransform: "capitalize" }}>{cat.replace(/_/g, " ")}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>{Number(tons).toLocaleString()} MT</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      )}

                      {/* Domain Breakdown: Reverse Auction Allocated Bids (Treasury) */}
                      {testResult.clearing_summary?.allocated_bids && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 0.5 }}>
                            ALLOCATED RECYCLER BIDS (CLEARING SUMMARY)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 700 }}>Bidder / Recycler</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700 }}>Allocated (MT)</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700 }}>Clearing Rate (₹/MT)</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {testResult.clearing_summary.allocated_bids.map((b: any, i: number) => (
                                  <TableRow key={i}>
                                    <TableCell sx={{ fontWeight: 600 }}>{b.bidder}</TableCell>
                                    <TableCell align="right">{b.allocated_tons} MT</TableCell>
                                    <TableCell align="right">₹{b.rate_inr.toLocaleString()}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      )}

                      {/* Domain Breakdown: Escrow Split (ERP / Settlement) */}
                      {testResult.escrow_split && (
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                          <Paper variant="outlined" sx={{ p: 1.5, borderColor: "primary.main" }}>
                            <Typography variant="caption" color="text.secondary">
                              80% Advance Disbursed (Immediate)
                            </Typography>
                            <Typography variant="h6" fontWeight={700} color="primary.main">
                              ₹{testResult.escrow_split.advance_payable_inr?.toLocaleString()}
                            </Typography>
                          </Paper>
                          <Paper variant="outlined" sx={{ p: 1.5, borderColor: "warning.main" }}>
                            <Typography variant="caption" color="text.secondary">
                              20% Retention Escrow (Held in Trust)
                            </Typography>
                            <Typography variant="h6" fontWeight={700} color="warning.main">
                              ₹{testResult.escrow_split.retention_payable_inr?.toLocaleString()}
                            </Typography>
                          </Paper>
                        </Box>
                      )}

                      {/* Domain Breakdown: CPCB Form-1 Filing (Legal) */}
                      {testResult.filing_manifest && (
                        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "background.default" }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            CPCB Form-1 Manifest SHA-256 Digest:
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontFamily: 'var(--font-mono, monospace)', wordBreak: "break-all", fontWeight: 700 }}
                          >
                            {testResult.filing_manifest.sha256_audit_digest}
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="caption" color="text.secondary" display="block">
                            Digital Signature Certificate (DSC): {testResult.filing_manifest.digital_signature_certificate}
                          </Typography>
                        </Paper>
                      )}
                    </Box>
                  )}

                  {/* TAB 1: Raw Output JSON */}
                  {playgroundTab === 1 && (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: (t) => (t.palette.mode === "dark" ? "#0D1117" : "#F8FAFC"),
                        borderRadius: "2px",
                        borderColor: "divider",
                        maxHeight: 520,
                        overflow: "auto",
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontFamily='var(--font-mono, monospace)'
                        component="pre"
                        sx={{
                          m: 0,
                          color: (t) => (t.palette.mode === "dark" ? "#86EFAC" : "#15803d"),
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                        }}
                      >
                        {JSON.stringify(testResult, null, 2)}
                      </Typography>
                    </Paper>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}
