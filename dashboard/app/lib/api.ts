// SynthetIQ API Gateway Client & Real-Time Service Integration

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : typeof window !== "undefined"
    ? ""
    : "http://localhost:8000";

export interface SystemConfig {
  gemini: {
    model: string;
    api_key_masked: string;
    is_key_provided: boolean;
    temperature: number;
  };
  jev_mode: {
    mode: string;
    torque_threshold_nm: number;
    power_factor_range: [number, number];
    description: string;
  };
  services: {
    api: { status: string; port: number };
    mcp: { status: string; url?: string; error?: string };
    simulator: { status: string; url?: string; error?: string };
    mocks: { status: string; url?: string; error?: string };
    temporal: { status: string; host: string };
  };
  endpoints: {
    mcp_url: string;
    simulator_url: string;
    mocks_url: string;
    temporal_host: string;
  };
}

export interface E2EStep {
  step: number;
  name: string;
  service: string;
  status: string;
  data: Record<string, any>;
  timestamp: number;
}

export interface E2ERunResult {
  run_id: string;
  status: string;
  message: string;
  duration_seconds: number;
  company_id: string;
  category?: string;
  volume_tons?: number;
  audit_hash?: string;
  po_number?: string;
  portal_ack_number?: string;
  steps: E2EStep[];
}

export interface ScadaLiveResponse {
  telemetry: {
    torque_nm: number;
    power_factor: number;
    active_power_kw: number;
    vfd_frequency_hz: number;
    melt_rate_kg_h: number;
    timestamp: number;
    mode: string;
  };
  physics: {
    torque_nm: number;
    power_factor: number;
    active_power_kw: number;
    melt_rate_kg_h: number;
    vfd_frequency_hz: number;
  };
  jev_evaluation: {
    mode: string;
    verdict: string;
    is_spoofed: boolean;
    physical_melt_verified: boolean;
    confidence_score: number;
    flags: string[];
  };
  timestamp: number;
}

// -------------------------------------------------------------
// System Engine & Model Configuration
// -------------------------------------------------------------
export async function fetchConfig(): Promise<SystemConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/config`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Could not reach API gateway config endpoint, using local defaults:", err);
    return null;
  }
}

export async function updateConfig(payload: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function testGemini(apiKey?: string, model?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/config/test-gemini`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, model }),
  });
  return await res.json();
}

// -------------------------------------------------------------
// Autonomous End-to-End Orchestrator
// -------------------------------------------------------------
export async function runE2ECompliance(params: {
  company_id?: string;
  fiscal_year?: string;
  category?: string;
  volume_tons?: number;
  simulate_spoof?: boolean;
}): Promise<E2ERunResult> {
  const res = await fetch(`${API_BASE}/api/v1/compliance/run-e2e`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Compliance run failed with status ${res.status}`);
  }
  return await res.json();
}

export async function fetchComplianceRuns(): Promise<E2ERunResult[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/compliance/runs`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// Live SCADA Telemetry & Jev Reflex Fraud Audit
// -------------------------------------------------------------
export async function fetchLiveScada(mode: "GENUINE" | "RESISTIVE_SPOOF" = "GENUINE"): Promise<ScadaLiveResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/audit/scada/live?mode=${mode}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function triggerAudit(params: {
  recycler_id?: string;
  plant_id?: string;
  category?: string;
  volume_tons?: number;
  simulate_spoof?: boolean;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/audit/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return await res.json();
}

export async function fetchAuditVerdicts(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/audit/verdicts`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// Liability & Upstream Planning
// -------------------------------------------------------------
export async function fetchLiabilityReport(companyId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/liability/report/${companyId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function calculateLiability(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/liability/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

// -------------------------------------------------------------
// Liquidity & Continuous Double Auction
// -------------------------------------------------------------
export async function fetchAuctions(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auctions/`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function broadcastRfp(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/auctions/rfp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

// -------------------------------------------------------------
// 80/20 Escrow Gate & CPCB Form-1 Dispatch
// -------------------------------------------------------------
export async function fetchEscrowPOs(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/settlement/pos`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function approveEscrow(auditId: string, action: string = "APPROVE"): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/settlement/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer mock-firebase-token-cpcb-co",
    },
    body: JSON.stringify({ audit_id: auditId, action }),
  });
  return await res.json();
}

export async function dispatchForm1(poNumber: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/settlement/form1/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ po_number: poNumber }),
  });
  return await res.json();
}
