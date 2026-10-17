"use client";

import React, { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
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
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepButton from "@mui/material/StepButton";
import StepLabel from "@mui/material/StepLabel";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";

import { PoweredByGemini, GeminiIcon, GoogleCloudIcon } from "@/components/icons/GoogleIcons";
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

  // Multi-step Wizard state
  const [wizardStep, setWizardStep] = useState<number>(0);

  // Real-time Playground state
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [playgroundPayload, setPlaygroundPayload] = useState<string>("");
  const [playgroundTab, setPlaygroundTab] = useState<number>(0); // 0: Visual Analysis, 1: Raw Output JSON
  const [copied, setCopied] = useState<boolean>(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Custom API key override
  const [customApiKey, setCustomApiKey] = useState<string>("");

  // Toggle for raw JSON vs interactive form for hyperparameters
  const [showRawJsonParams, setShowRawJsonParams] = useState<boolean>(false);

  // Toggle for raw JSON vs interactive form for simulation payload
  const [showRawJsonPayload, setShowRawJsonPayload] = useState<boolean>(false);

  const updateParameter = (key: string, value: any) => {
    if (!currentConfig) return;
    const updated = { ...(currentConfig.parameters || {}), [key]: value };
    setCurrentConfig({ ...currentConfig, parameters: updated });
  };

  const updatePayloadField = (key: string, value: any) => {
    try {
      const current = playgroundPayload.trim() ? JSON.parse(playgroundPayload) : {};
      const updated = { ...current, [key]: value };
      setPlaygroundPayload(JSON.stringify(updated, null, 2));
    } catch {
      // ignore
    }
  };

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
    setWizardStep(2);

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
      provider: "gemini",
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
  const activeScenario = currentScenarios.find((s) => s.id === selectedScenarioId) || currentScenarios[0];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: 2 }}>
      <PageHeader
        title="Agent Studio & Real-Time Playground"
        icon={<SmartToyIcon fontSize="medium" />}
        description="Tune Gemini prompts & domain hyperparameters, then execute dynamic simulations and reverse auctions in the real-time playground."
        actions={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <PoweredByGemini variant="pill" showCloud />
            <Button
              variant="contained"
              size="small"
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon sx={{ fontSize: 15 }} />}
              onClick={handleSave}
              disabled={saving || !currentConfig}
              sx={{
                fontWeight: 600,
                fontSize: "0.8rem",
                textTransform: "none",
                px: 1.75,
                py: 0.5,
                borderRadius: 1.5,
                bgcolor: "#1A73E8",
                color: "#FFFFFF",
                boxShadow: "none",
                "&:hover": {
                  bgcolor: "#1557B0",
                },
              }}
            >
              {saving ? "Saving..." : "Save Config"}
            </Button>
          </Box>
        }
      />

      {saveSuccess && (
        <Alert
          severity="success"
          variant="outlined"
          icon={<CheckCircleOutlineIcon fontSize="small" />}
          sx={{
            py: 0.25,
            px: 1.5,
            fontSize: "0.8rem",
            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.04)"),
            borderColor: (t) => (t.palette.mode === "dark" ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.25)"),
          }}
        >
          Agent configuration saved successfully for tenant {orgId}.
        </Alert>
      )}

      {error && (
        <Alert severity="error" variant="outlined" sx={{ py: 0.25, px: 1.5, fontSize: "0.8rem" }}>
          {error}
        </Alert>
      )}

      {/* Agent Selector Tabs Ribbon */}
      <Box
        sx={{
          p: 0.5,
          borderRadius: 1.75,
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)"),
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 34,
            "& .MuiTabs-indicator": {
              height: 2.5,
              borderRadius: "2px 2px 0 0",
              bgcolor: "primary.main",
            },
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.8rem",
              minHeight: 32,
              py: 0.4,
              px: 1.25,
              borderRadius: 1.25,
              mr: 0.5,
              transition: "all 0.15s ease",
              "&.Mui-selected": {
                color: "primary.main",
                fontWeight: 700,
                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(139, 92, 246, 0.12)" : "rgba(124, 58, 237, 0.08)"),
              },
            },
          }}
        >
          {configs.map((c) => (
            <Tab
              key={c.agent_name}
              icon={<SmartToyIcon sx={{ fontSize: 15 }} />}
              iconPosition="start"
              label={AGENT_LABELS[c.agent_name]?.label || c.agent_name}
            />
          ))}
        </Tabs>
      </Box>

      {currentConfig && (
        <>
          {/* ── Agent Studio Multi-Step Wizard Navigation ─────────────────────────── */}
          <Card
            variant="outlined"
            sx={{
              py: 1,
              px: 2,
              borderRadius: 1.75,
              bgcolor: "background.paper",
              borderColor: "divider",
            }}
          >
            <Stepper nonLinear activeStep={wizardStep}>
              <Step completed={wizardStep > 0}>
                <StepButton onClick={() => setWizardStep(0)}>
                  <StepLabel
                    StepIconProps={{
                      sx: {
                        "&.Mui-active": { color: "#1A73E8" },
                        "&.Mui-completed": { color: "#1A73E8" },
                      },
                    }}
                  >
                    <Box sx={{ textAlign: "left" }}>
                      <Typography variant="body2" sx={{ fontWeight: wizardStep === 0 ? 700 : 600, fontSize: "0.8rem" }}>
                        1. Agent Intelligence
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                        Model &amp; Instructions
                      </Typography>
                    </Box>
                  </StepLabel>
                </StepButton>
              </Step>

              <Step completed={wizardStep > 1}>
                <StepButton onClick={() => setWizardStep(1)}>
                  <StepLabel
                    StepIconProps={{
                      sx: {
                        "&.Mui-active": { color: "#1A73E8" },
                        "&.Mui-completed": { color: "#1A73E8" },
                      },
                    }}
                  >
                    <Box sx={{ textAlign: "left" }}>
                      <Typography variant="body2" sx={{ fontWeight: wizardStep === 1 ? 700 : 600, fontSize: "0.8rem" }}>
                        2. Simulation Staging
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                        Scenarios &amp; Payloads
                      </Typography>
                    </Box>
                  </StepLabel>
                </StepButton>
              </Step>

              <Step completed={!!testResult}>
                <StepButton onClick={() => setWizardStep(2)}>
                  <StepLabel
                    StepIconProps={{
                      sx: {
                        "&.Mui-active": { color: "#1A73E8" },
                        "&.Mui-completed": { color: "#1A73E8" },
                      },
                    }}
                  >
                    <Box sx={{ textAlign: "left" }}>
                      <Typography variant="body2" sx={{ fontWeight: wizardStep === 2 ? 700 : 600, fontSize: "0.8rem" }}>
                        3. Verification &amp; Telemetry
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                        Real-Time Analysis
                      </Typography>
                    </Box>
                  </StepLabel>
                </StepButton>
              </Step>
            </Stepper>
          </Card>

          {/* ── STEP 0: AGENT INTELLIGENCE & HYPERPARAMETERS ───────────────────────── */}
          {wizardStep === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Card variant="outlined" sx={{ bgcolor: "background.paper", borderColor: "divider", borderRadius: 2 }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: { xs: 1.5, sm: 2 } }}>
                  {/* Agent Header */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1.25,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(26, 115, 232, 0.15)" : "rgba(26, 115, 232, 0.1)"),
                          color: "#1A73E8",
                          border: "1px solid",
                          borderColor: (t) => (t.palette.mode === "dark" ? "rgba(26, 115, 232, 0.3)" : "rgba(26, 115, 232, 0.2)"),
                        }}
                      >
                        <SmartToyIcon fontSize="small" />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: "0.95rem" }}>
                            {agentMeta?.label || currentConfig.agent_name}
                          </Typography>
                          <Chip
                            label={agentMeta?.role?.includes("System 1") ? "System 1 Reflex" : "System 2 Reasoning"}
                            size="small"
                            variant="outlined"
                            color={agentMeta?.role?.includes("System 1") ? "warning" : "primary"}
                            sx={{ fontWeight: 700, height: 20, fontSize: "0.68rem" }}
                          />
                          <Chip
                            label="Active in Saga"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ fontWeight: 700, height: 20, fontSize: "0.68rem" }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.74rem" }}>
                          {agentMeta?.role}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 0.25 }} />

                  {/* 2-Column Split: Inference & Source (Left) vs Instructions & Hyperparameters (Right) */}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1.15fr" }, gap: 2, alignItems: "start" }}>
                    {/* Left Column: Inference Engine, Temp Slider, Data Source */}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {/* Neural Inference Engine */}
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{ color: "#1A73E8", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.72rem" }}
                        >
                          <GeminiIcon size={13} /> NEURAL INFERENCE ENGINE
                        </Typography>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            p: 1.25,
                            borderRadius: 1.25,
                            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.025)" : "rgba(0, 0, 0, 0.02)"),
                            border: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <GeminiIcon size={18} />
                            <Box>
                              <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.85rem" }}>
                                Gemini 3.8 Flash
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                                Google Cloud structured JSON with deterministic sub-second reasoning
                              </Typography>
                            </Box>
                          </Box>
                          <Chip
                            label="Production"
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 700, height: 20, fontSize: "0.68rem" }}
                          />
                        </Box>
                      </Box>

                      {/* Temperature Control with Quick Presets */}
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.72rem" }}>
                            REASONING TEMPERATURE: <strong>{currentConfig.temperature}</strong>
                          </Typography>
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            <Chip
                              label="Strict (0.1)"
                              size="small"
                              clickable
                              onClick={() => setCurrentConfig({ ...currentConfig, temperature: 0.1 })}
                              color={currentConfig.temperature <= 0.2 ? "primary" : "default"}
                              variant="outlined"
                              sx={{
                                height: 20,
                                fontSize: "0.66rem",
                                fontWeight: 600,
                                bgcolor: currentConfig.temperature <= 0.2 ? "rgba(26, 115, 232, 0.1)" : "transparent",
                              }}
                            />
                            <Chip
                              label="Balanced (0.4)"
                              size="small"
                              clickable
                              onClick={() => setCurrentConfig({ ...currentConfig, temperature: 0.4 })}
                              color={currentConfig.temperature > 0.2 && currentConfig.temperature <= 0.6 ? "primary" : "default"}
                              variant="outlined"
                              sx={{
                                height: 20,
                                fontSize: "0.66rem",
                                fontWeight: 600,
                                bgcolor: currentConfig.temperature > 0.2 && currentConfig.temperature <= 0.6 ? "rgba(26, 115, 232, 0.1)" : "transparent",
                              }}
                            />
                            <Chip
                              label="Exploratory (0.85)"
                              size="small"
                              clickable
                              onClick={() => setCurrentConfig({ ...currentConfig, temperature: 0.85 })}
                              color={currentConfig.temperature > 0.6 ? "primary" : "default"}
                              variant="outlined"
                              sx={{
                                height: 20,
                                fontSize: "0.66rem",
                                fontWeight: 600,
                                bgcolor: currentConfig.temperature > 0.6 ? "rgba(26, 115, 232, 0.1)" : "transparent",
                              }}
                            />
                          </Box>
                        </Box>
                        <Slider
                          size="small"
                          value={currentConfig.temperature}
                          min={0.0}
                          max={1.0}
                          step={0.05}
                          onChange={(_, val) => setCurrentConfig({ ...currentConfig, temperature: val as number })}
                          sx={{
                            color: "#1A73E8",
                            my: 0.5,
                            "& .MuiSlider-thumb": {
                              boxShadow: "0 0 8px rgba(26, 115, 232, 0.4)",
                            },
                          }}
                        />
                      </Box>

                      {/* Bound Enterprise Data Source */}
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{ color: "#1A73E8", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.72rem" }}
                        >
                          <StorageIcon sx={{ fontSize: 13 }} /> BOUND ENTERPRISE DATA SOURCE
                        </Typography>
                        <TextField
                          select
                          size="small"
                          value={currentConfig.data_source_id || ""}
                          onChange={(e) => setCurrentConfig({ ...currentConfig, data_source_id: e.target.value || null })}
                          fullWidth
                        >
                          <MenuItem value="">
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <StorageIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                              <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>— Default In-Memory Simulator —</Typography>
                            </Box>
                          </MenuItem>
                          {dataSources.map((ds) => {
                            const isBq = ds.source_type?.toLowerCase().includes("bigquery");
                            return (
                              <MenuItem key={ds.source_id} value={ds.source_id}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                                  {isBq ? <GoogleCloudIcon size={15} /> : <StorageIcon sx={{ fontSize: 15 }} />}
                                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>
                                    {ds.name}
                                  </Typography>
                                  <Chip
                                    label={isBq ? "Google BigQuery" : ds.source_type.toUpperCase()}
                                    size="small"
                                    color={isBq ? "primary" : "default"}
                                    variant="outlined"
                                    sx={{ ml: "auto", height: 18, fontSize: "0.62rem", fontWeight: 700 }}
                                  />
                                </Box>
                              </MenuItem>
                            );
                          })}
                        </TextField>
                      </Box>
                    </Box>

                    {/* Right Column: Instructions & Hyperparameters */}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                      {/* System Reasoning Instructions */}
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography variant="caption" sx={{ color: "#1A73E8", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.72rem" }}>
                            <TerminalIcon sx={{ fontSize: 13 }} /> SYSTEM REASONING INSTRUCTIONS &amp; PROMPT
                          </Typography>
                          <Chip
                            label={`${(currentConfig.system_prompt || "").length} chars`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: "0.62rem" }}
                          />
                        </Box>
                        <TextField
                          multiline
                          rows={3}
                          size="small"
                          fullWidth
                          value={currentConfig.system_prompt || ""}
                          onChange={(e) => setCurrentConfig({ ...currentConfig, system_prompt: e.target.value })}
                          placeholder="Enter custom instructions to tailor agent reasoning..."
                          sx={{
                            "& textarea": {
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: "0.78rem",
                              lineHeight: 1.4,
                            },
                            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0, 0, 0, 0.25)" : "rgba(0, 0, 0, 0.02)"),
                          }}
                        />
                      </Box>

                      {/* Domain Hyperparameters */}
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography variant="caption" sx={{ color: "#1A73E8", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.72rem" }}>
                            <TuneIcon sx={{ fontSize: 13 }} /> DOMAIN HYPERPARAMETERS
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setShowRawJsonParams(!showRawJsonParams)}
                            sx={{ height: 20, fontSize: "0.62rem", fontWeight: 700, textTransform: "none", px: 1, py: 0 }}
                          >
                            {showRawJsonParams ? "Form Controls" : "Edit as JSON"}
                          </Button>
                        </Box>

                        {showRawJsonParams ? (
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
                                // Allow typing
                              }
                            }}
                            sx={{
                              "& textarea": {
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: "0.78rem",
                                lineHeight: 1.4,
                              },
                              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0, 0, 0, 0.25)" : "rgba(0, 0, 0, 0.02)"),
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 1.5,
                              border: "1px solid",
                              borderColor: "divider",
                              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "#FAFAFB"),
                              display: "flex",
                              flexDirection: "column",
                              gap: 1.5,
                            }}
                          >
                            {currentConfig.agent_name === "brand_liability" && (
                              <Grid container spacing={1.5}>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Historic Deficit Amortization"
                                    value={currentConfig.parameters?.amortization_fraction ?? 0.333}
                                    onChange={(e) => updateParameter("amortization_fraction", parseFloat(e.target.value))}
                                    helperText="CPCB Rule 13(2) statutory amortization formula"
                                  >
                                    <MenuItem value={0.333}>Rule 13(2) — 1/3 Deficit (0.333)</MenuItem>
                                    <MenuItem value={0.5}>50% Deficit Carry-Forward (0.500)</MenuItem>
                                    <MenuItem value={1.0}>100% Immediate Settlement (1.000)</MenuItem>
                                  </TextField>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, display: "block", mb: 0.5 }}>
                                    Polymer Categories In Scope
                                  </Typography>
                                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                    {[
                                      { id: "cat_i_rigid", label: "Cat I (Rigid)" },
                                      { id: "cat_ii_flexible", label: "Cat II (Flexible)" },
                                      { id: "cat_iii_mlp", label: "Cat III (MLP)" },
                                      { id: "cat_iv_compostable", label: "Cat IV (Compostable)" },
                                    ].map((cat) => {
                                      const activeCats: string[] = currentConfig.parameters?.categories || [];
                                      const isSelected = activeCats.includes(cat.id);
                                      return (
                                        <Chip
                                          key={cat.id}
                                          size="small"
                                          label={cat.label}
                                          color={isSelected ? "primary" : "default"}
                                          variant={isSelected ? "filled" : "outlined"}
                                          onClick={() => {
                                            const updated = isSelected
                                              ? activeCats.filter((c) => c !== cat.id)
                                              : [...activeCats, cat.id];
                                            updateParameter("categories", updated);
                                          }}
                                          sx={{ height: 22, fontSize: "0.68rem", fontWeight: 600, cursor: "pointer" }}
                                        />
                                      );
                                    })}
                                  </Box>
                                </Grid>
                              </Grid>
                            )}

                            {currentConfig.agent_name === "treasury" && (
                              <Grid container spacing={1.5}>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label="Min Price Corridor (%)"
                                    value={currentConfig.parameters?.price_corridor_min_pct ?? 30.0}
                                    onChange={(e) => updateParameter("price_corridor_min_pct", parseFloat(e.target.value) || 0)}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label="Max Price Corridor (%)"
                                    value={currentConfig.parameters?.price_corridor_max_pct ?? 100.0}
                                    onChange={(e) => updateParameter("price_corridor_max_pct", parseFloat(e.target.value) || 0)}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Clearing Algorithm"
                                    value={currentConfig.parameters?.clearing_algorithm || "uniform_price"}
                                    onChange={(e) => updateParameter("clearing_algorithm", e.target.value)}
                                  >
                                    <MenuItem value="uniform_price">Uniform Price Corridor</MenuItem>
                                    <MenuItem value="continuous_double_auction">Continuous Double Auction</MenuItem>
                                    <MenuItem value="sealed_bid">Sealed Bid Discriminatory</MenuItem>
                                  </TextField>
                                </Grid>
                              </Grid>
                            )}

                            {currentConfig.agent_name === "auditor" && (
                              <Grid container spacing={1.5}>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label="Min Viscous Torque (Nm)"
                                    value={currentConfig.parameters?.torque_threshold_nm ?? 8.0}
                                    onChange={(e) => updateParameter("torque_threshold_nm", parseFloat(e.target.value) || 0)}
                                    helperText="Threshold for polymer shear"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label="Min Power Factor"
                                    value={currentConfig.parameters?.power_factor_min ?? 0.78}
                                    onChange={(e) => updateParameter("power_factor_min", parseFloat(e.target.value) || 0)}
                                    helperText="Inductive motor threshold"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Audit Evaluation Mode"
                                    value={currentConfig.parameters?.audit_mode || "hybrid_ensemble"}
                                    onChange={(e) => updateParameter("audit_mode", e.target.value)}
                                  >
                                    <MenuItem value="hybrid_ensemble">Hybrid Physics + Gemini</MenuItem>
                                    <MenuItem value="strict_physics">Strict Nimble Reflex Only</MenuItem>
                                  </TextField>
                                </Grid>
                              </Grid>
                            )}

                            {currentConfig.agent_name === "regulatory_watchdog" && (
                              <Grid container spacing={1.5}>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Jurisdiction"
                                    value={currentConfig.parameters?.jurisdiction || "IN"}
                                    onChange={(e) => updateParameter("jurisdiction", e.target.value)}
                                  >
                                    <MenuItem value="IN">IN — India (CPCB)</MenuItem>
                                    <MenuItem value="EU">EU — European Union</MenuItem>
                                  </TextField>
                                </Grid>
                                <Grid item xs={12} sm={8}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Statutory Framework"
                                    value={currentConfig.parameters?.active_framework || "CPCB Plastic Waste Management Amendment Rules 2026"}
                                    onChange={(e) => updateParameter("active_framework", e.target.value)}
                                  />
                                </Grid>
                              </Grid>
                            )}

                            {currentConfig.agent_name !== "brand_liability" &&
                             currentConfig.agent_name !== "treasury" &&
                             currentConfig.agent_name !== "auditor" &&
                             currentConfig.agent_name !== "regulatory_watchdog" && (
                              <Grid container spacing={1.5}>
                                {Object.entries(currentConfig.parameters || {}).map(([k, v]) => (
                                  <Grid item xs={12} sm={6} key={k}>
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label={k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                      value={typeof v === "object" ? JSON.stringify(v) : v}
                                      onChange={(e) => {
                                        let val: any = e.target.value;
                                        if (!isNaN(Number(val)) && val.trim() !== "") val = Number(val);
                                        updateParameter(k, val);
                                      }}
                                    />
                                  </Grid>
                                ))}
                              </Grid>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* Step 0 Navigation Actions */}
                  <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", pt: 0.5 }}>
                    <Button
                      variant="contained"
                      size="small"
                      endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                      onClick={() => setWizardStep(1)}
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        textTransform: "none",
                        px: 2,
                        py: 0.6,
                        borderRadius: 1.75,
                        bgcolor: "#1A73E8",
                        color: "#FFFFFF",
                        boxShadow: "none",
                        "&:hover": { bgcolor: "#1557B0" },
                      }}
                    >
                      Proceed to Simulation Staging
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* ── STEP 1: SIMULATION STAGING ────────────────────────────────────────── */}
          {wizardStep === 1 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Card variant="outlined" sx={{ bgcolor: "background.paper", borderColor: "divider", borderRadius: 2 }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: { xs: 1.5, sm: 2 } }}>
                  {/* Header */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <BoltIcon sx={{ color: "#1A73E8", fontSize: 20 }} />
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: "0.95rem" }}>
                          Simulator Command Centre
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.74rem" }}>
                          Stage simulation parameters and test scenario for {agentMeta?.label || currentConfig.agent_name}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label="Gemini 3.8 Flash"
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 700, height: 20, fontSize: "0.68rem" }}
                    />
                  </Box>

                  <Divider sx={{ my: 0.25 }} />

                  {/* 2-Column Split: Preset Scenarios (Left) vs Payload JSON & Overrides (Right) */}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1.15fr" }, gap: 2, alignItems: "start" }}>
                    {/* Left Column: Preset Scenario Picker & Context */}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.72rem" }}>
                        SELECT SIMULATION PRESET SCENARIO
                      </Typography>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Preset Scenario"
                        value={selectedScenarioId}
                        onChange={(e) => {
                          const sc = currentScenarios.find((s) => s.id === e.target.value);
                          if (sc) handleSelectScenario(sc);
                        }}
                      >
                        {currentScenarios.map((sc) => (
                          <MenuItem key={sc.id} value={sc.id}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 1.5, py: 0.25 }}>
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.82rem" }}>
                                {sc.name}
                              </Typography>
                              <Chip
                                label={sc.badge}
                                size="small"
                                color={sc.badgeColor}
                                variant="outlined"
                                sx={{ fontWeight: 700, height: 18, fontSize: "0.65rem" }}
                              />
                            </Box>
                          </MenuItem>
                        ))}
                      </TextField>

                      {/* Active Scenario Context Banner */}
                      {activeScenario && (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.25,
                            borderRadius: 1.5,
                            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)"),
                            borderColor: "divider",
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.75,
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Chip
                              label={activeScenario.badge}
                              size="small"
                              color={activeScenario.badgeColor}
                              variant="outlined"
                              sx={{ fontWeight: 700, height: 18, fontSize: "0.65rem" }}
                            />
                            <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
                              {activeScenario.name}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem", lineHeight: 1.4 }}>
                            {activeScenario.description}
                          </Typography>
                        </Paper>
                      )}

                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.25,
                          borderRadius: 1.5,
                          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(26, 115, 232, 0.04)" : "rgba(26, 115, 232, 0.02)"),
                          borderColor: (t) => (t.palette.mode === "dark" ? "rgba(26, 115, 232, 0.2)" : "rgba(26, 115, 232, 0.15)"),
                        }}
                      >
                        <Typography variant="caption" sx={{ color: "#1A73E8", fontWeight: 700, display: "block", mb: 0.5, fontSize: "0.72rem" }}>
                          STAGING SUMMARY
                        </Typography>
                        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "text.secondary", mb: 0.25 }}>
                          <span>Target Agent:</span>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>{agentMeta?.label}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "text.secondary" }}>
                          <span>Data Source:</span>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
                            {currentConfig.data_source_id ? "Bound Data Connector" : "In-Memory Simulator"}
                          </Typography>
                        </Box>
                      </Paper>
                    </Box>

                    {/* Right Column: Structured Simulation Payload & Overrides */}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "#1A73E8", display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.72rem" }}>
                          <TuneIcon sx={{ fontSize: 13 }} /> SIMULATION PAYLOAD PARAMETERS
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => setShowRawJsonPayload(!showRawJsonPayload)}
                            sx={{ fontSize: "0.68rem", textTransform: "none", py: 0.1, px: 0.75, fontWeight: 600 }}
                          >
                            {showRawJsonPayload ? "Switch to Form Inputs" : "Edit Raw JSON"}
                          </Button>
                          <Tooltip title="Reset to preset">
                            <Button
                              size="small"
                              onClick={handleResetPayload}
                              startIcon={<RefreshIcon sx={{ fontSize: 13 }} />}
                              sx={{ fontSize: "0.68rem", textTransform: "none", py: 0.1, px: 0.75 }}
                            >
                              Reset
                            </Button>
                          </Tooltip>
                        </Box>
                      </Box>

                      {!showRawJsonPayload ? (
                        (() => {
                          let parsed: Record<string, any> = {};
                          let parseErr = false;
                          try {
                            parsed = playgroundPayload.trim() ? JSON.parse(playgroundPayload) : {};
                          } catch {
                            parseErr = true;
                          }
                          if (parseErr) {
                            return (
                              <Alert severity="warning" sx={{ fontSize: "0.78rem" }}>
                                Invalid JSON detected. Switch to Raw JSON view to fix syntax.
                              </Alert>
                            );
                          }
                          const entries = Object.entries(parsed);
                          if (entries.length === 0) {
                            return (
                              <Typography variant="caption" color="text.secondary">
                                No payload parameters configured for this scenario.
                              </Typography>
                            );
                          }
                          return (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
                              <Grid container spacing={1.25}>
                                {entries.map(([k, v]) => {
                                  if (Array.isArray(v)) {
                                    return (
                                      <Grid item xs={12} key={k}>
                                        <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.5, bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }}>
                                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.5 }}>
                                            {k.replace(/_/g, " ").toUpperCase()} ({v.length} items)
                                          </Typography>
                                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                                            {v.map((item, idx) => (
                                              <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1, p: 0.75, borderRadius: 1, border: "1px dashed", borderColor: "divider" }}>
                                                {typeof item === "object" && item !== null ? (
                                                  Object.entries(item).map(([subK, subV]) => (
                                                    <TextField
                                                      key={subK}
                                                      size="small"
                                                      label={subK.replace(/_/g, " ")}
                                                      value={subV}
                                                      onChange={(e) => {
                                                        let newVal: any = e.target.value;
                                                        if (!isNaN(Number(newVal)) && newVal.trim() !== "") newVal = Number(newVal);
                                                        const updatedArray = [...v];
                                                        updatedArray[idx] = { ...updatedArray[idx], [subK]: newVal };
                                                        updatePayloadField(k, updatedArray);
                                                      }}
                                                      sx={{ flex: 1, "& input": { fontSize: "0.75rem", py: 0.5 } }}
                                                    />
                                                  ))
                                                ) : (
                                                  <TextField
                                                    size="small"
                                                    value={item}
                                                    onChange={(e) => {
                                                      const updatedArray = [...v];
                                                      updatedArray[idx] = e.target.value;
                                                      updatePayloadField(k, updatedArray);
                                                    }}
                                                    sx={{ flex: 1, "& input": { fontSize: "0.75rem", py: 0.5 } }}
                                                  />
                                                )}
                                              </Box>
                                            ))}
                                          </Box>
                                        </Paper>
                                      </Grid>
                                    );
                                  }
                                  if (k === "fiscal_year") {
                                    return (
                                      <Grid item xs={12} sm={6} key={k}>
                                        <TextField
                                          select
                                          fullWidth
                                          size="small"
                                          label="Fiscal Year"
                                          value={v}
                                          onChange={(e) => updatePayloadField(k, e.target.value)}
                                          sx={{ "& .MuiSelect-select": { fontSize: "0.78rem" } }}
                                        >
                                          <MenuItem value="FY2026-27">FY2026-27 (Current)</MenuItem>
                                          <MenuItem value="FY2025-26">FY2025-26 (Past Year)</MenuItem>
                                          <MenuItem value="FY2027-28">FY2027-28 (Forecast)</MenuItem>
                                        </TextField>
                                      </Grid>
                                    );
                                  }
                                  if (k === "plant_id") {
                                    return (
                                      <Grid item xs={12} sm={6} key={k}>
                                        <TextField
                                          select
                                          fullWidth
                                          size="small"
                                          label="Recycler Extruder Plant"
                                          value={v}
                                          onChange={(e) => updatePayloadField(k, e.target.value)}
                                          sx={{ "& .MuiSelect-select": { fontSize: "0.78rem" } }}
                                        >
                                          <MenuItem value="PLANT-OKHLA-EXTRUDER-02">PLANT-OKHLA-EXTRUDER-02 (Delhi)</MenuItem>
                                          <MenuItem value="PLANT-SHAMSHABAD-01">PLANT-SHAMSHABAD-01 (Hyderabad)</MenuItem>
                                          <MenuItem value="PLANT-VAPI-04">PLANT-VAPI-04 (Gujarat)</MenuItem>
                                          <MenuItem value="PLANT-MANESAR-01">PLANT-MANESAR-01 (Haryana)</MenuItem>
                                        </TextField>
                                      </Grid>
                                    );
                                  }
                                  return (
                                    <Grid item xs={12} sm={6} key={k}>
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label={k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                        value={v}
                                        type={typeof v === "number" ? "number" : "text"}
                                        onChange={(e) => {
                                          let val: any = e.target.value;
                                          if (typeof v === "number" && !isNaN(Number(val)) && val.trim() !== "") {
                                            val = Number(val);
                                          }
                                          updatePayloadField(k, val);
                                        }}
                                        sx={{ "& input": { fontSize: "0.78rem" } }}
                                      />
                                    </Grid>
                                  );
                                })}
                              </Grid>
                            </Box>
                          );
                        })()
                      ) : (
                        <TextField
                          multiline
                          rows={6}
                          size="small"
                          fullWidth
                          value={playgroundPayload}
                          onChange={(e) => setPlaygroundPayload(e.target.value)}
                          sx={{
                            "& textarea": {
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: "0.76rem",
                              lineHeight: 1.4,
                            },
                            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0, 0, 0, 0.25)" : "rgba(0, 0, 0, 0.02)"),
                          }}
                        />
                      )}

                      {/* Optional API Key Override (Collapsed Accordion) */}
                      <Accordion
                        variant="outlined"
                        sx={{
                          borderRadius: 1.25,
                          border: "1px solid",
                          borderColor: "divider",
                          "&:before": { display: "none" },
                        }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 32, py: 0.5 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <KeyIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                            <Typography variant="caption" fontWeight={600} color="text.secondary">
                              Custom Gemini API Key Override (Optional)
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0, pb: 1 }}>
                          <TextField
                            size="small"
                            type="password"
                            fullWidth
                            placeholder="AIzaSy... (leave blank to use system key)"
                            value={customApiKey}
                            onChange={(e) => setCustomApiKey(e.target.value)}
                            sx={{
                              "& input": { fontSize: "0.78rem" },
                              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0, 0, 0, 0.25)" : "rgba(0, 0, 0, 0.02)"),
                            }}
                          />
                        </AccordionDetails>
                      </Accordion>
                    </Box>
                  </Box>

                  {/* Step 1 Actions */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 0.5 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                      onClick={() => setWizardStep(0)}
                      sx={{ fontWeight: 600, textTransform: "none", borderRadius: 1.75, fontSize: "0.82rem" }}
                    >
                      Back
                    </Button>
                    <Box sx={{ display: "flex", gap: 1.25 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={testing ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
                        onClick={handleRunPlayground}
                        disabled={testing}
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.82rem",
                          textTransform: "none",
                          px: 2,
                          py: 0.6,
                          borderRadius: 1.75,
                          bgcolor: "#1A73E8",
                          color: "#FFFFFF",
                          "&:hover": { bgcolor: "#1557B0" },
                        }}
                      >
                        {testing ? "Running Simulation..." : "Run Simulation Now"}
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* ── STEP 2: VERIFICATION & TELEMETRY ──────────────────────────────────── */}
          {wizardStep === 2 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Card variant="outlined" sx={{ bgcolor: "background.paper", borderColor: "divider", borderRadius: 2 }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: { xs: 1.5, sm: 2 } }}>
                  {/* Header with Subtabs & Export & Back button */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <AssessmentIcon sx={{ color: "#1A73E8", fontSize: 20 }} />
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: "0.95rem" }}>
                          Verification &amp; Telemetry Studio
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.74rem" }}>
                          Real-time reasoning verification &amp; simulation analytics for {agentMeta?.label}
                        </Typography>
                      </Box>
                    </Box>

                    {testResult && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Tabs
                          value={playgroundTab}
                          onChange={(_, v) => setPlaygroundTab(v)}
                          sx={{
                            minHeight: 28,
                            "& .MuiTab-root": {
                              minHeight: 28,
                              py: 0.2,
                              px: 1.25,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textTransform: "none",
                              borderRadius: 1,
                            },
                          }}
                        >
                          <Tab label="Analysis & Narrative" />
                          <Tab label="Raw JSON Output" />
                        </Tabs>

                        <Tooltip title={copied ? "Copied!" : "Copy Raw JSON"}>
                          <IconButton size="small" onClick={handleCopyResult} sx={{ border: "1px solid", borderColor: "divider", p: 0.5 }}>
                            {copied ? <CheckIcon sx={{ fontSize: 15, color: "success.main" }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>

                  <Divider sx={{ my: 0.25 }} />

                  {/* State 1: In Progress Loading with Animated Gemini Icon */}
                  {testing && (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 5, gap: 2 }}>
                      <Box
                        sx={{
                          position: "relative",
                          width: 58,
                          height: 58,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          background: (t) =>
                            t.palette.mode === "dark"
                              ? "radial-gradient(circle, rgba(66, 133, 244, 0.25) 0%, rgba(155, 114, 203, 0.12) 60%, transparent 100%)"
                              : "radial-gradient(circle, rgba(66, 133, 244, 0.18) 0%, rgba(155, 114, 203, 0.08) 60%, transparent 100%)",
                          animation: "geminiPulse 2s ease-in-out infinite",
                          "@keyframes geminiPulse": {
                            "0%": { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(66, 133, 244, 0.35)" },
                            "50%": { transform: "scale(1.08)", boxShadow: "0 0 18px 4px rgba(155, 114, 203, 0.3)" },
                            "100%": { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(66, 133, 244, 0)" },
                          },
                        }}
                      >
                        <Box
                          sx={{
                            animation: "geminiIconRotate 6s ease-in-out infinite",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            "@keyframes geminiIconRotate": {
                              "0%": { transform: "rotate(0deg) scale(1)" },
                              "50%": { transform: "rotate(180deg) scale(1.1)" },
                              "100%": { transform: "rotate(360deg) scale(1)" },
                            },
                          }}
                        >
                          <GeminiIcon size={36} />
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: "center", maxWidth: 440 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.9rem" }}>
                          Dispatched Neural Inference to Gemini 3.8 Flash...
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                          Evaluating statutory rules, cross-referencing ledger tables &amp; telemetry streams
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* State 2: Simulation Not Yet Run */}
                  {!testing && !testResult && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 1 }}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(26, 115, 232, 0.04)" : "rgba(26, 115, 232, 0.02)"),
                          borderColor: (t) => (t.palette.mode === "dark" ? "rgba(26, 115, 232, 0.2)" : "rgba(26, 115, 232, 0.15)"),
                          display: "flex",
                          flexDirection: "column",
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 1.25,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: "#1A73E8",
                                color: "#FFFFFF",
                              }}
                            >
                              <BoltIcon fontSize="small" />
                            </Box>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: "0.92rem" }}>
                                Simulation Staging: {activeScenario?.name || "Ready to Run"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                                Prepared for execution against {agentMeta?.label}
                              </Typography>
                            </Box>
                          </Box>
                          <Chip
                            label={activeScenario?.badge || "Ready"}
                            size="small"
                            variant="outlined"
                            color={activeScenario?.badgeColor || "primary"}
                            sx={{ fontWeight: 700, height: 20, fontSize: "0.68rem" }}
                          />
                        </Box>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.25 }}>
                          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25 }}>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.7rem" }}>
                              Data Connector
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
                              <GoogleCloudIcon size={14} />
                              <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
                                Google BigQuery
                              </Typography>
                            </Box>
                          </Paper>

                          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25 }}>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.7rem" }}>
                              Reasoning Engine
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
                              <GeminiIcon size={14} />
                              <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
                                Gemini 3.8 Flash
                              </Typography>
                            </Box>
                          </Paper>

                          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25 }}>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.7rem" }}>
                              Verification Mode
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
                              <CheckCircleIcon sx={{ fontSize: 14, color: "primary.main" }} />
                              <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.82rem" }}>
                                CPCB Statutory Audit
                              </Typography>
                            </Box>
                          </Paper>
                        </Box>

                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 0.5, flexWrap: "wrap", gap: 1 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                            Launch live neural reasoning to evaluate payloads, calculate debt amortization, and verify physics anomalies.
                          </Typography>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
                            onClick={handleRunPlayground}
                            sx={{
                              fontWeight: 600,
                              textTransform: "none",
                              px: 2,
                              py: 0.5,
                              borderRadius: 1.5,
                              bgcolor: "#1A73E8",
                              color: "#FFFFFF",
                              "&:hover": { bgcolor: "#1557B0" },
                            }}
                          >
                            Run Simulation
                          </Button>
                        </Box>
                      </Paper>
                    </Box>
                  )}

                  {/* State 3: Results Display */}
                  {!testing && testResult && (
                    <>
                      {playgroundTab === 0 && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                          {/* Unified High-Density Telemetry & Verdict Strip (Replaces separate heavy banners) */}
                          <Box
                            sx={{
                              p: 1.25,
                              borderRadius: 1.5,
                              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)"),
                              border: "1px solid",
                              borderColor: "divider",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: 1,
                            }}
                          >
                            {/* Left: Verdict Chip (Outlined) + Latency + Records */}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                              <Chip
                                label={testResult.verdict || testResult.status}
                                variant="outlined"
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
                                sx={{ fontWeight: 700, fontSize: "0.78rem", height: 24 }}
                              />
                              <Typography
                                variant="caption"
                                sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.74rem" }}
                              >
                                <SpeedIcon sx={{ fontSize: 14 }} /> {testResult.latency_ms ?? 0} ms
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.74rem" }}>
                                • {testResult.records_analyzed ?? 1} records
                              </Typography>
                            </Box>

                            {/* Right: Model (Outlined) + Tokens + Cost + Data Connector */}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                              <Chip
                                icon={<GeminiIcon size={13} />}
                                label="Gemini 3.8 Flash"
                                size="small"
                                variant="outlined"
                                color="primary"
                                sx={{ fontWeight: 700, fontSize: "0.72rem", height: 22 }}
                              />
                              <Chip
                                label={`${testResult.tokens || testResult.llm_telemetry?.total_tokens || 0} tokens`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: "0.7rem", height: 20 }}
                              />
                              <Chip
                                label={`$${Number(testResult.cost_usd || 0).toFixed(4)}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: "0.7rem", height: 20 }}
                              />
                              <Chip
                                icon={
                                  testResult.data_source_used?.toLowerCase().includes("bigquery") ||
                                  testResult.data_source_used?.toLowerCase().includes("erp_sales") ? (
                                    <GoogleCloudIcon size={13} />
                                  ) : undefined
                                }
                                label={testResult.data_source_used || "Simulator"}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: "0.7rem", height: 20 }}
                              />
                            </Box>
                          </Box>

                          {/* Main Results Split: Reasoning Narrative & Diagnostics (Left) vs KPIs & Trace (Right) */}
                          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" }, gap: 1.75, alignItems: "start" }}>
                            {/* Left Column: AI Reasoning Narrative (Cleaned & Markdown Rendered) + Anomalies + Prompt Inspection */}
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                              {/* AI Reasoning Narrative Paper with MarkdownRenderer */}
                              {testResult.reasoning_narrative && (
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 1.5,
                                    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(26, 115, 232, 0.05)" : "rgba(26, 115, 232, 0.03)"),
                                    borderColor: (t) => (t.palette.mode === "dark" ? "rgba(26, 115, 232, 0.25)" : "rgba(26, 115, 232, 0.2)"),
                                    borderRadius: 1.5,
                                    maxHeight: 280,
                                    overflowY: "auto",
                                  }}
                                >
                                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                      <AutoAwesomeIcon sx={{ fontSize: 16, color: "#1A73E8" }} />
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1A73E8", fontSize: "0.85rem" }}>
                                        Agent Reasoning &amp; Analysis Narrative
                                      </Typography>
                                    </Box>
                                    <Chip
                                      label="Gemini 3.8 Flash"
                                      size="small"
                                      variant="outlined"
                                      color="primary"
                                      sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }}
                                    />
                                  </Box>
                                  {/* Formatted Markdown Report with Raw Debug Headers Stripped */}
                                  <MarkdownRenderer content={testResult.reasoning_narrative} />
                                </Paper>
                              )}

                              {/* Detected Anomalies Alert (Outlined) */}
                              {testResult.anomalies_detected && testResult.anomalies_detected.length > 0 && (
                                <Alert
                                  severity="error"
                                  variant="outlined"
                                  icon={<WarningAmberIcon fontSize="small" />}
                                  sx={{ py: 0.5, px: 1.5, fontSize: "0.8rem" }}
                                >
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25, fontSize: "0.82rem" }}>
                                    Critical Physics &amp; Telemetry Anomalies Flagged:
                                  </Typography>
                                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                    {testResult.anomalies_detected.map((anom: string, i: number) => (
                                      <li key={i}>
                                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                                          {anom}
                                        </Typography>
                                      </li>
                                    ))}
                                  </Box>
                                </Alert>
                              )}

                              {/* Collapsible Panel: Dispatched Prompt & Diagnostics (Collapsed by default to save height) */}
                              <Accordion
                                variant="outlined"
                                sx={{
                                  borderRadius: 1.25,
                                  border: "1px solid",
                                  borderColor: "divider",
                                  "&:before": { display: "none" },
                                }}
                              >
                                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 32, py: 0.5 }}>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <TerminalIcon sx={{ fontSize: 15, color: "#1A73E8" }} />
                                    <Typography variant="caption" fontWeight={700}>
                                      Model Inspection &amp; Dispatched Prompt
                                    </Typography>
                                  </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 0, pb: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
                                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.7rem" }}>
                                      PROMPT SENT:
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.68rem" }}>
                                      Model: Gemini 3.8 Flash | Temp: {testResult.temperature ?? 0.2}
                                    </Typography>
                                  </Box>
                                  <Box
                                    sx={{
                                      p: 1.25,
                                      borderRadius: 1,
                                      bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.04)"),
                                      border: "1px solid",
                                      borderColor: "divider",
                                      fontFamily: 'var(--font-mono, monospace)',
                                      fontSize: "0.74rem",
                                      whiteSpace: "pre-wrap",
                                      maxHeight: 180,
                                      overflowY: "auto",
                                      color: (t) => (t.palette.mode === "dark" ? "#93c5fd" : "#1e40af"),
                                    }}
                                  >
                                    {testResult.prompt_sent || (testResult.raw_input_evaluated ? JSON.stringify(testResult.raw_input_evaluated, null, 2) : "No raw prompt captured.")}
                                  </Box>
                                  {testResult.system_instruction && (
                                    <>
                                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.68rem", mt: 0.25 }}>
                                        SYSTEM INSTRUCTION:
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontStyle: "italic", color: "text.secondary", fontSize: "0.72rem" }}>
                                        {testResult.system_instruction}
                                      </Typography>
                                    </>
                                  )}
                                  {testResult.raw_api_error && (
                                    <Alert severity="warning" variant="outlined" sx={{ mt: 0.5, py: 0.25, fontSize: "0.72rem" }}>
                                      <b>Google Gemini Diagnostic:</b> {testResult.raw_api_error}
                                    </Alert>
                                  )}
                                </AccordionDetails>
                              </Accordion>
                            </Box>

                            {/* Right Column: KPI Metrics Grid + Pipeline Execution Trace & Domain Breakdown */}
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                              {/* KPI Metrics Grid (2x2 Compact) */}
                              {testResult.kpis && typeof testResult.kpis === "object" && (
                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                                  {Object.entries(testResult.kpis)
                                    .slice(0, 4)
                                    .map(([key, val]) => (
                                      <Paper
                                        key={key}
                                        variant="outlined"
                                        sx={{
                                          p: 1,
                                          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)"),
                                          borderColor: "divider",
                                          borderRadius: 1.25,
                                        }}
                                      >
                                        <Typography
                                          variant="caption"
                                          sx={{ color: "text.secondary", textTransform: "capitalize", display: "block", fontSize: "0.68rem", fontWeight: 600 }}
                                        >
                                          {key.replace(/_/g, " ")}
                                        </Typography>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 0.1, fontSize: "0.88rem" }}>
                                          {typeof val === "number"
                                            ? val.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                            : String(val)}
                                        </Typography>
                                      </Paper>
                                    ))}
                                </Box>
                              )}

                              {/* Execution Pipeline Trace */}
                              {testResult.execution_trace && Array.isArray(testResult.execution_trace) && (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 0.5, fontSize: "0.68rem" }}>
                                    EXECUTION PIPELINE TRACE
                                  </Typography>
                                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 160, overflowY: "auto" }}>
                                    {testResult.execution_trace.map((step: any, idx: number) => {
                                      const isFailed = step.status === "FAILED" || step.status === "FLAGGED";
                                      return (
                                        <Box
                                          key={idx}
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            py: 0.5,
                                            px: 1,
                                            borderRadius: 1,
                                            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.01)"),
                                            border: "1px solid",
                                            borderColor: isFailed ? "error.main" : "divider",
                                          }}
                                        >
                                          {isFailed ? (
                                            <ErrorIcon sx={{ fontSize: 14, color: "error.main" }} />
                                          ) : (
                                            <CheckCircleIcon sx={{ fontSize: 14, color: "primary.main" }} />
                                          )}
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.78rem" }}>
                                              {step.step}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.68rem" }} noWrap>
                                              {step.details}
                                            </Typography>
                                          </Box>
                                          <Chip
                                            label={step.status}
                                            size="small"
                                            color={isFailed ? "error" : step.status === "DYNAMIC_SYNTHESIS" ? "warning" : "default"}
                                            variant="outlined"
                                            sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }}
                                          />
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                </Box>
                              )}

                              {/* Domain Specific Breakdown Column */}
                              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                {testResult.category_breakdown_tons && (
                                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 0.5, fontSize: "0.68rem" }}>
                                      POLYMER CATEGORY BREAKDOWN (METRIC TONS)
                                    </Typography>
                                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 140 }}>
                                      <Table size="small" stickyHeader>
                                        <TableHead>
                                          <TableRow>
                                            <TableCell sx={{ fontWeight: 700, py: 0.5, fontSize: "0.7rem" }}>Polymer Category</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, py: 0.5, fontSize: "0.7rem" }}>Volume</TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {Object.entries(testResult.category_breakdown_tons).map(([cat, tons]: [string, any]) => (
                                            <TableRow key={cat}>
                                              <TableCell sx={{ textTransform: "capitalize", py: 0.4, fontSize: "0.72rem" }}>{cat.replace(/_/g, " ")}</TableCell>
                                              <TableCell align="right" sx={{ fontWeight: 600, py: 0.4, fontSize: "0.72rem" }}>{Number(tons).toLocaleString()} MT</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </TableContainer>
                                  </Box>
                                )}

                                {testResult.clearing_summary?.allocated_bids && (
                                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 0.5, fontSize: "0.68rem" }}>
                                      ALLOCATED RECYCLER BIDS (CLEARING SUMMARY)
                                    </Typography>
                                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 140 }}>
                                      <Table size="small" stickyHeader>
                                        <TableHead>
                                          <TableRow>
                                            <TableCell sx={{ fontWeight: 700, py: 0.5, fontSize: "0.7rem" }}>Bidder</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, py: 0.5, fontSize: "0.7rem" }}>Allocated</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, py: 0.5, fontSize: "0.7rem" }}>Rate</TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {testResult.clearing_summary.allocated_bids.map((b: any, i: number) => (
                                            <TableRow key={i}>
                                              <TableCell sx={{ fontWeight: 600, py: 0.4, fontSize: "0.72rem" }}>{b.bidder}</TableCell>
                                              <TableCell align="right" sx={{ py: 0.4, fontSize: "0.72rem" }}>{b.allocated_tons} MT</TableCell>
                                              <TableCell align="right" sx={{ py: 0.4, fontSize: "0.72rem" }}>₹{b.rate_inr.toLocaleString()}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </TableContainer>
                                  </Box>
                                )}

                                {testResult.escrow_split && (
                                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                                    <Paper variant="outlined" sx={{ p: 1, borderColor: "primary.main" }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>
                                        80% Advance Disbursed
                                      </Typography>
                                      <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ fontSize: "0.85rem" }}>
                                        ₹{testResult.escrow_split.advance_payable_inr?.toLocaleString()}
                                      </Typography>
                                    </Paper>
                                    <Paper variant="outlined" sx={{ p: 1, borderColor: "warning.main" }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>
                                        20% Retention Escrow
                                      </Typography>
                                      <Typography variant="subtitle2" fontWeight={700} color="warning.main" sx={{ fontSize: "0.85rem" }}>
                                        ₹{testResult.escrow_split.retention_payable_inr?.toLocaleString()}
                                      </Typography>
                                    </Paper>
                                  </Box>
                                )}

                                {testResult.filing_manifest && (
                                  <Paper variant="outlined" sx={{ p: 1, bgcolor: "background.default" }}>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.68rem" }}>
                                      CPCB Form-1 Manifest SHA-256 Digest:
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{ fontFamily: 'var(--font-mono, monospace)', wordBreak: "break-all", fontWeight: 700, fontSize: "0.7rem" }}
                                    >
                                      {testResult.filing_manifest.sha256_audit_digest}
                                    </Typography>
                                    <Divider sx={{ my: 0.5 }} />
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.68rem" }}>
                                      DSC Key: {testResult.filing_manifest.digital_signature_certificate}
                                    </Typography>
                                  </Paper>
                                )}
                              </Box>
                            </Box>
                          </Box>

                          {/* Bottom Actions */}
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 0.5 }}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                              onClick={() => setWizardStep(1)}
                              sx={{ fontWeight: 600, textTransform: "none", borderRadius: 1.75, fontSize: "0.82rem" }}
                            >
                              Back to Staging
                            </Button>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={testing ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 16 }} />}
                              onClick={handleRunPlayground}
                              disabled={testing}
                              sx={{
                                fontWeight: 600,
                                fontSize: "0.82rem",
                                textTransform: "none",
                                px: 2,
                                py: 0.6,
                                borderRadius: 1.75,
                                bgcolor: "#1A73E8",
                                color: "#FFFFFF",
                                "&:hover": { bgcolor: "#1557B0" },
                              }}
                            >
                              Re-run Simulation
                            </Button>
                          </Box>
                        </Box>
                      )}

                      {/* TAB 1: Raw Output JSON */}
                      {playgroundTab === 1 && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              bgcolor: (t) => (t.palette.mode === "dark" ? "#0D1117" : "#F8FAFC"),
                              borderRadius: 1.5,
                              borderColor: "divider",
                              maxHeight: 400,
                              overflow: "auto",
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontFamily='var(--font-mono, monospace)'
                              component="pre"
                              sx={{
                                m: 0,
                                color: (t) => (t.palette.mode === "dark" ? "#93C5FD" : "#1E40AF"),
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-all",
                                fontSize: "0.75rem",
                              }}
                            >
                              {JSON.stringify(testResult, null, 2)}
                            </Typography>
                          </Paper>
                          <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                              onClick={() => setWizardStep(1)}
                              sx={{ fontWeight: 600, textTransform: "none", borderRadius: 1.75, fontSize: "0.82rem" }}
                            >
                              Back to Staging
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
