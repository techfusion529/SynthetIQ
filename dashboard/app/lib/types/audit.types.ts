/** Quad-core fraud audit & SCADA types. */

export interface ScadaPhysics {
  torque_nm: number;
  power_factor: number;
  active_power_kw: number;
  melt_rate_kg_h: number;
  vfd_frequency_hz: number;
}

export interface JevEvaluation {
  mode: string;
  verdict: string;
  is_spoofed: boolean;
  physical_melt_verified: boolean;
  confidence_score: number;
  flags: string[];
}

export interface ScadaLiveResponse {
  telemetry: ScadaPhysics & { timestamp: number; mode: string };
  physics: ScadaPhysics;
  jev_evaluation: JevEvaluation;
  timestamp: number;
}

export interface AuditVerdict {
  audit_id: string;
  recycler_id: string;
  plant_id: string;
  plastic_category?: string;
  reported_volume_tons: number;
  verified_physical_melt_tons?: number;
  physical_melt_verified: boolean;
  confidence_score: number;
  eway_bill_verified?: boolean;
  audit_verdict: string;
  rejection_reasons?: string[];
  audit_hash?: string;
  physics?: Partial<ScadaPhysics>;
  triggered_by?: string;
  timestamp: number;
}

export interface TriggerAuditParams {
  recycler_id?: string;
  plant_id?: string;
  category?: string;
  volume_tons?: number;
  simulate_spoof?: boolean;
}
