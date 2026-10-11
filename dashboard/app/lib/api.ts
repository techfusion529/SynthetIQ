// SynthetIQ API Gateway Client & Real-Time Service Integration
import type { E2ERunResult, E2EStep } from "./types/compliance.types";
export type { E2ERunResult, E2EStep };

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : typeof window !== "undefined"
    ? ""
    : "http://localhost:8000";

export interface SystemConfig {
  gemini: {
    model: string;
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
// Auth header helper
// Every authenticated call MUST pass a token from the session.
// If the token is absent the call fails with an error — no silent fallback.
// -------------------------------------------------------------
export function makeAuthHeaders(token: string): HeadersInit {
  if (!token) {
    throw new Error("No auth token — user must be logged in");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// -------------------------------------------------------------
// System Engine & Model Configuration
// -------------------------------------------------------------
export async function fetchConfig(token: string): Promise<SystemConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/config`, {
      cache: "no-store",
      headers: makeAuthHeaders(token),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Could not reach API gateway config endpoint:", err);
    return null;
  }
}

export async function updateConfig(token: string, payload: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/config`, {
    method: "POST",
    headers: makeAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function testGemini(token: string, apiKey?: string, model?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/config/test-gemini`, {
    method: "POST",
    headers: makeAuthHeaders(token),
    body: JSON.stringify({ api_key: apiKey, model }),
  });
  return await res.json();
}

// -------------------------------------------------------------
// Autonomous End-to-End Orchestrator
// -------------------------------------------------------------
export async function runE2ECompliance(
  token: string,
  params: {
    company_id?: string;
    fiscal_year?: string;
    category?: string;
    volume_tons?: number;
    simulate_spoof?: boolean;
  }
): Promise<E2ERunResult> {
  const res = await fetch(`${API_BASE}/api/v1/runs`, {
    method: "POST",
    headers: makeAuthHeaders(token),
    body: JSON.stringify({ type: "e2e_compliance", params }),
  });
  if (res.status === 410) {
    throw new Error("This endpoint has moved. Please refresh the page.");
  }
  if (!res.ok) {
    throw new Error(`Compliance run failed with status ${res.status}`);
  }
  return await res.json();
}

export async function fetchComplianceRuns(token: string): Promise<E2ERunResult[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/runs`, {
      cache: "no-store",
      headers: makeAuthHeaders(token),
    });
    if (res.status === 410) {
      throw new Error("This endpoint has moved. Please refresh the page.");
    }
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    // Re-throw 410 errors so the caller can surface "Please refresh the page."
    // Swallow all other network/parse errors and return an empty list.
    if (e instanceof Error && e.message.startsWith("This endpoint has moved")) throw e;
    return [];
  }
}

// -------------------------------------------------------------
// Live SCADA Telemetry & Jev Reflex Fraud Audit
// -------------------------------------------------------------
export async function fetchLiveScada(
  token: string,
  mode: "GENUINE" | "RESISTIVE_SPOOF" = "GENUINE"
): Promise<ScadaLiveResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/audit/scada/live?mode=${mode}`, {
      cache: "no-store",
      headers: makeAuthHeaders(token),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function triggerAudit(
  token: string,
  params: {
    recycler_id?: string;
    plant_id?: string;
    category?: string;
    volume_tons?: number;
    simulate_spoof?: boolean;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/audit/trigger`, {
    method: "POST",
    headers: makeAuthHeaders(token),
    body: JSON.stringify(params),
  });
  return await res.json();
}

export async function fetchAuditVerdicts(token: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/audit/verdicts`, {
      cache: "no-store",
      headers: makeAuthHeaders(token),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// Liability & Upstream Planning
// -------------------------------------------------------------
export async function fetchLiabilityReport(token: string, companyId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/liability/report/${companyId}`, {
      cache: "no-store",
      headers: makeAuthHeaders(token),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function calculateLiability(token: string, payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/liability/calculate`, {
    method: "POST",
    headers: makeAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return await res.json();
}

// -------------------------------------------------------------
// Liquidity & Continuous Double Auction
// -------------------------------------------------------------
export async function fetchAuctions(token: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auctions/`, {
      cache: "no-store",
      headers: makeAuthHeaders(token),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function broadcastRfp(token: string, payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/auctions/rfp`, {
    method: "POST",
    headers: makeAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return await res.json();
}

// -------------------------------------------------------------
// 80/20 Escrow Gate & CPCB Form-1 Dispatch
// -------------------------------------------------------------
export async function fetchEscrowPOs(token: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/settlement/pos`, {
      cache: "no-store",
      headers: makeAuthHeaders(token),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function approveEscrow(
  auditId: string,
  token: string,
  action: string = "APPROVE",
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/settlement/approve`, {
    method: "POST",
    headers: makeAuthHeaders(token),
    body: JSON.stringify({ audit_id: auditId, action }),
  });
  if (!res.ok) throw new Error(`approveEscrow failed: ${res.status}`);
  return await res.json();
}

export async function dispatchForm1(token: string, poNumber: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/settlement/form1/dispatch`, {
    method: "POST",
    headers: makeAuthHeaders(token),
    body: JSON.stringify({ po_number: poNumber }),
  });
  return await res.json();
}
