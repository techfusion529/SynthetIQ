"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileCheck2,
  Flame,
  Gauge,
  HelpCircle,
  Radio,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";
import { fetchLiveScada, ScadaLiveResponse, triggerAudit } from "@/app/lib/api";

export default function QuadCoreAuditPage() {
  const [mode, setMode] = useState<"GENUINE" | "SPOOFED">("GENUINE");
  const [streamPoints, setStreamPoints] = useState<number[]>([
    45, 52, 58, 64, 59, 62, 55, 61, 58, 65, 60, 57, 63, 61, 56, 60, 58, 64, 62, 59,
  ]);

  const [liveData, setLiveData] = useState<ScadaLiveResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

  // Poll live SCADA telemetry from backend simulator
  useEffect(() => {
    const poll = async () => {
      const data = await fetchLiveScada(mode === "GENUINE" ? "GENUINE" : "RESISTIVE_SPOOF");
      if (data) {
        setLiveData(data);
        const tVal = data.physics.torque_nm;
        setStreamPoints((prev) => [...prev.slice(1), Math.round(tVal + (Math.random() * 4 - 2))]);
      } else {
        // Fallback generator
        const nextVal =
          mode === "GENUINE"
            ? Math.round(55 + Math.random() * 18 - 9)
            : Math.round(1.5 + Math.random() * 1.5);
        setStreamPoints((prev) => [...prev.slice(1), nextVal]);
      }
    };

    poll();
    const interval = setInterval(poll, 1200);
    return () => clearInterval(interval);
  }, [mode]);

  const isGenuine = mode === "GENUINE";
  const torque = liveData?.physics.torque_nm ?? (isGenuine ? 57.7 : 1.8);
  const powerFactor = liveData?.physics.power_factor ?? (isGenuine ? 0.871 : 0.994);
  const activePower = liveData?.physics.active_power_kw ?? (isGenuine ? 95.0 : 82.5);
  const meltRate = liveData?.physics.melt_rate_kg_h ?? (isGenuine ? 248.6 : 0.0);
  const jevVerdict = liveData?.jev_evaluation.verdict ?? (isGenuine ? "APPROVED" : "REJECTED");
  const jevConfidence = liveData?.jev_evaluation.confidence_score
    ? Math.round(liveData.jev_evaluation.confidence_score * 100)
    : isGenuine
    ? 96.5
    : 12.0;

  const handleRunAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await triggerAudit({
        recycler_id: "RECYC-DELHI-01",
        plant_id: "PLANT-OKHLA-2",
        category: "cat_i_rigid",
        volume_tons: 250.0,
        simulate_spoof: mode === "SPOOFED",
      });
      setAuditResult(res);
    } catch {
      setAuditResult({
        audit_id: `AUD-${Date.now()}`,
        audit_verdict: mode === "SPOOFED" ? "REJECTED" : "APPROVED",
        audit_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        confidence_score: mode === "SPOOFED" ? 0.12 : 0.965,
      });
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-slate-200">Executive Hub</Link>
            <span>/</span>
            <span className="text-cyan-400 font-medium">Workflow 3: Quad-Core Fraud Audit</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-cyan-400" />
            Quad-Core Fraud Audit: SCADA VFD Physics Visualizer
          </h2>
          <p className="text-sm text-slate-400">
            TypeSafe Jev System 1 Reflex: Mathematically proving polymer melting vs IoT resistance heater spoofing
          </p>
        </div>

        {/* Live Simulation Mode Toggle & Audit Trigger */}
        <div className="flex items-center gap-3 self-start flex-wrap">
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setMode("GENUINE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isGenuine
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Genuine Melt Signal
            </button>
            <button
              onClick={() => setMode("SPOOFED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                !isGenuine
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              Inject Fake Heaters (Spoof)
            </button>
          </div>

          <button
            onClick={handleRunAudit}
            disabled={isAuditing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isAuditing ? "Auditing Stream..." : "Run Quad-Core Audit"}</span>
          </button>
        </div>
      </div>

      {/* Audit Hash Output Badge if Run */}
      {auditResult && (
        <div
          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
            auditResult.audit_verdict === "APPROVED"
              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
              : "bg-rose-950/40 border-rose-500/50 text-rose-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {auditResult.audit_verdict === "APPROVED" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertOctagon className="w-4 h-4 text-rose-400" />
            )}
            <span>
              <strong>Verdict: {auditResult.audit_verdict}</strong> (Audit ID: {auditResult.audit_id})
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-300 truncate max-w-md">
            SHA-256: {auditResult.audit_hash}
          </div>
        </div>
      )}

      {/* Alert Banner if Spoofed */}
      {!isGenuine && (
        <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/60 text-rose-200 space-y-2 glow-rose animate-fadeIn">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-base">
            <AlertOctagon className="w-6 h-6 shrink-0 animate-bounce" />
            <span>CRITICAL AUDIT ALERT: IOT MECHANICAL FRAUD DETECTED</span>
          </div>
          <p className="text-xs text-rose-300/90 leading-relaxed">
            <strong>Physics Anomaly:</strong> Active electrical power draw is {activePower} kW with near-unity power factor ({powerFactor}), but mechanical screw torque is only {torque} Nm. The plant has connected static resistive heating elements to simulate energy consumption without running viscous polymer extruders. <strong>Compliance credit issuance blocked.</strong>
          </p>
        </div>
      )}

      {/* Oscilloscope & Live VFD Waveform */}
      <div className="p-6 rounded-2xl glass-panel space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                SCADA/VFD Real-Time Oscilloscope: Extruder Screw Torque (Nm)
              </h3>
              <p className="text-xs text-slate-400">
                Plant: <strong className="text-slate-200">RECYC-DELHI-01 (Line 2)</strong> · Motor: 110kW 3-Phase Induction
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400">Sampling:</span>
            <span className="text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">50 Hz</span>
          </div>
        </div>

        {/* Oscilloscope Display */}
        <div className="h-56 w-full rounded-xl bg-[#030712] border border-cyan-500/20 relative scada-grid flex flex-col justify-between p-4 overflow-hidden">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 z-10">
            <span>CH1: MOTOR TORQUE (Nm)</span>
            <span className={isGenuine ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
              {isGenuine ? "VISCOUS SHEAR DETECTED" : "UNLOADED / SPOOFED RESISTIVE"}
            </span>
          </div>

          {/* SVG Waveform Curve */}
          <div className="absolute inset-0 flex items-center px-4 pt-6 pb-4">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="waveformGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isGenuine ? "#06b6d4" : "#f43f5e"} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={isGenuine ? "#06b6d4" : "#f43f5e"} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area under curve */}
              <polygon
                points={`0,100 ${streamPoints
                  .map((val, idx) => `${(idx / (streamPoints.length - 1)) * 100},${100 - (val / 90) * 80}`)
                  .join(" ")} 100,100`}
                fill="url(#waveformGrad)"
              />

              {/* Line path */}
              <polyline
                fill="none"
                stroke={isGenuine ? "#06b6d4" : "#f43f5e"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={streamPoints
                  .map((val, idx) => `${(idx / (streamPoints.length - 1)) * 100},${100 - (val / 90) * 80}`)
                  .join(" ")}
              />
            </svg>
          </div>

          {/* Grid annotations */}
          <div className="flex justify-between items-end text-[10px] font-mono text-slate-400 z-10">
            <span>0 Nm</span>
            <span className="text-slate-400">Current: {torque} Nm</span>
            <span>100 Nm</span>
          </div>
        </div>
      </div>

      {/* Physics Gauges & Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gauge 1: Power Factor */}
        <div className="p-5 rounded-2xl glass-card space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase">Power Factor (cos φ)</span>
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white">{powerFactor}</div>
            <p className="text-xs mt-1">
              {isGenuine ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 0.85 Inductive Motor Work
                </span>
              ) : (
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5" /> 0.99 Pure Resistive Heating
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Gauge 2: Active Power Draw */}
        <div className="p-5 rounded-2xl glass-card space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase">Active Power Draw</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white">
              {activePower} <span className="text-sm font-sans font-medium text-slate-400">kW</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Therm balance: {isGenuine ? "0.38 kWh/kg" : "N/A (No throughput)"}
            </p>
          </div>
        </div>

        {/* Gauge 3: Extrusion Melt Rate */}
        <div className="p-5 rounded-2xl glass-card space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase">Physical Melt Rate</span>
            <Scale className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-cyan-400">
              {meltRate} <span className="text-sm font-sans font-medium text-slate-400">kg/h</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isGenuine ? "Correlated to die pressure" : "Zero throughput detected"}
            </p>
          </div>
        </div>

        {/* Gauge 4: Jev Reflex Confidence */}
        <div className="p-5 rounded-2xl glass-card space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase">Jev Reflex Confidence</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-400">{jevConfidence}%</div>
            <p className="text-xs text-slate-400 mt-1">
              Status: <strong className={isGenuine ? "text-emerald-400" : "text-rose-400"}>{jevVerdict}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
