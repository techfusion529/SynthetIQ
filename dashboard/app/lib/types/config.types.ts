/** System engine configuration types. */

export interface GeminiConfig {
  model: string;
  api_key_masked: string;
  is_key_provided: boolean;
  temperature: number;
}

export interface JevModeConfig {
  mode: string;
  torque_threshold_nm: number;
  power_factor_range: [number, number];
  description: string;
}

export interface ServiceStatus {
  status: string;
  port?: number;
  url?: string;
  host?: string;
  error?: string;
  code?: number;
}

export interface SystemConfig {
  gemini: GeminiConfig;
  jev_mode: JevModeConfig;
  services: {
    api: ServiceStatus;
    mcp: ServiceStatus;
    simulator: ServiceStatus;
    mocks: ServiceStatus;
    temporal: ServiceStatus;
  };
  endpoints: {
    mcp_url: string;
    simulator_url: string;
    mocks_url: string;
    temporal_host: string;
  };
}

export interface UpdateConfigParams {
  gemini_api_key?: string;
  gemini_model?: string;
  jev_mode?: string;
  torque_threshold_nm?: number;
  power_factor_min?: number;
  power_factor_max?: number;
}
