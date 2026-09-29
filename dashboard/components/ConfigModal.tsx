"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Flame,
  Gauge,
  KeyRound,
  RefreshCw,
  Server,
  Settings,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { fetchConfig, SystemConfig, testGemini, updateConfig } from "@/app/lib/api";

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: (config: SystemConfig) => void;
}

export default function ConfigModal({ isOpen, onClose, onConfigUpdated }: ConfigModalProps) {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Form states
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [jevMode, setJevMode] = useState("HYBRID_ENSEMBLE");
  const [torqueThreshold, setTorqueThreshold] = useState(8.0);
  const [pfMin, setPfMin] = useState(0.78);
  const [pfMax, setPfMax] = useState(0.96);

  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    const data = await fetchConfig();
    if (data) {
      setConfig(data);
      setGeminiModel(data.gemini.model);
      setJevMode(data.jev_mode.mode);
      setTorqueThreshold(data.jev_mode.torque_threshold_nm);
      setPfMin(data.jev_mode.power_factor_range[0]);
      setPfMax(data.jev_mode.power_factor_range[1]);
    }
    setLoading(false);
  };

  const handleTestGemini = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await testGemini(apiKeyInput || undefined, geminiModel);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ status: "ERROR", message: e.message });
    }
    setTestingKey(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);
    try {
      const payload: Record<string, any> = {
        gemini_model: geminiModel,
        jev_mode: jevMode,
        torque_threshold_nm: torqueThreshold,
        power_factor_min: pfMin,
        power_factor_max: pfMax,
      };
      if (apiKeyInput.trim()) {
        payload.gemini_api_key = apiKeyInput.trim();
      }
      await updateConfig(payload);
      setNotification("Engine configuration updated and applied successfully!");
      // Reload updated config
      const refreshed = await fetchConfig();
      if (refreshed) {
        setConfig(refreshed);
        if (onConfigUpdated) onConfigUpdated(refreshed);
      }
      setTimeout(() => setNotification(null), 4000);
    } catch {
      setNotification("Failed to update config. Verify API Gateway connectivity.");
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#090d1a] border border-slate-700/80 rounded-2xl shadow-2xl shadow-indigo-950/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>SynthetIQ Engine & Model Configuration</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Live Runtime
                </span>
              </h2>
              <p className="text-xs text-slate-400">Manage Gemini AI reasoning, TypeSafe Jev System 1 physics thresholds & services</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar text-sm">
          {notification && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{notification}</span>
            </div>
          )}

          {/* Section 1: Gemini AI System 2 */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-indigo-300 font-semibold">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Google Gemini AI (System 2 Reasoning)</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Active Key: {config?.gemini.api_key_masked || "Checking..."}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Model Selection</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Default & Recommended)</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Fast)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Deep Reasoning)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Gemini API Key (Leave empty to keep current)
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    placeholder="AIzaSy..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Test Gemini Button & Feedback */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <button
                type="button"
                onClick={handleTestGemini}
                disabled={testingKey}
                className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{testingKey ? "Testing..." : "Test Gemini Connectivity"}</span>
              </button>

              {testResult && (
                <div className="text-xs font-mono">
                  {testResult.status === "CONNECTED" ? (
                    <span className="text-emerald-400 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Connected ({testResult.displayName})</span>
                    </span>
                  ) : testResult.status === "MOCK_FALLBACK" ? (
                    <span className="text-amber-400 flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Deterministic Mock Mode (No Key Set)</span>
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center space-x-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Connection Error: {testResult.message || testResult.error}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: TypeSafe Jev System 1 Reflex Mode */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-cyan-300 font-semibold">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <span>TypeSafe Jev System 1 Reflex (Physics Engine)</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                50Hz Real-Time Gate
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Execution Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: "HYBRID_ENSEMBLE",
                    label: "Hybrid Ensemble",
                    sub: "Jev Fast Gate + Gemini Reasoning",
                  },
                  {
                    id: "REFLEX_PHYSICS_ONLY",
                    label: "Reflex Physics Only",
                    sub: "Sub-ms deterministic motor math",
                  },
                  {
                    id: "DEEP_FORENSIC_ONLY",
                    label: "Deep Forensic",
                    sub: "Full LLM anomaly evaluation",
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setJevMode(m.id)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      jevMode === m.id
                        ? "bg-cyan-500/10 border-cyan-500 text-cyan-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <p className="text-xs font-bold">{m.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{m.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Threshold Sliders */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Min Extruder Shaft Torque (Nm)</span>
                <span className="font-mono text-cyan-400 font-bold">{torqueThreshold} Nm</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="25.0"
                step="0.5"
                value={torqueThreshold}
                onChange={(e) => setTorqueThreshold(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Torque below this threshold with high active power triggers space heater resistive spoofing rejection.
              </p>
            </div>
          </div>

          {/* Section 3: Microservice Endpoints & Live Health Matrix */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-300 font-semibold">
                <Server className="w-4 h-4 text-indigo-400" />
                <span>Microservice Status & Endpoints</span>
              </div>
              <button
                type="button"
                onClick={loadConfig}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh Matrix</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { name: "API Gateway", port: ":8000", status: config?.services.api.status || "ONLINE" },
                { name: "Zero-Trust MCP", port: ":8001", status: config?.services.mcp.status || "ONLINE" },
                { name: "SCADA Simulator", port: ":9091", status: config?.services.simulator.status || "ONLINE" },
                { name: "Mocks ERP/CPCB", port: ":8002", status: config?.services.mocks.status || "ONLINE" },
              ].map((svc) => (
                <div key={svc.name} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-slate-300">{svc.name}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        svc.status === "ONLINE" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                      }`}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-slate-500">{svc.port}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <p className="text-xs text-slate-400">Settings take effect immediately across all workflows</p>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Cpu className="w-4 h-4" />
              <span>{saving ? "Saving..." : "Save & Apply Live Engine Config"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
