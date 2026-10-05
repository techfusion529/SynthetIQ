/** ConfigService — system engine configuration and Gemini connectivity endpoints. */

import { BaseService } from "./base.service";
import type { SystemConfig, UpdateConfigParams } from "../types/config.types";

export class ConfigService extends BaseService {
  /** Returns active runtime config and microservice statuses. */
  async getConfig(): Promise<SystemConfig> {
    return this.request<SystemConfig>("GET", "/api/v1/config");
  }

  /** Updates engine config (model, API key, Jev mode). Requires config:write (admin). */
  async updateConfig(params: UpdateConfigParams): Promise<{ status: string; message: string }> {
    return this.request("POST", "/api/v1/config", { body: params });
  }

  /** Tests Gemini connectivity with the configured API key. */
  async testGemini(apiKey?: string, model?: string): Promise<{ status: string; model?: string; displayName?: string }> {
    return this.request("POST", "/api/v1/config/test-gemini", {
      body: { api_key: apiKey, model },
    });
  }
}
