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

export default function QuadCoreAuditPage() {
  const [mode, setMode] = useState<"GENUINE" | "SPOOFED">("GENUINE");
  const [streamPoints, setStreamPoints] = useState<number[]>([
    45, 52, 58, 64, 59, 62, 55, 61, 58, 65, 60, 57, 63, 61, 56, 60, 58, 64, 62, 59
  ]);

  // Simulate continuous 50Hz SCADA stream tick
  useEffect(() => {
    const interval = setInterval(() => {
      setStreamPoints((prev) => {
        const nextVal =
          mode === "GENUINE"
            ? Math.round(55 + Math.random() * 18 - 9)
            : Math.round(1.5 + Math.random() * 1.5);
        return [...prev.slice(1), nextVal];
      });
    }, 400);
    return () => clearInterval(interval);
  }, [mode]);

  const isGenuine = mode === "GENUINE";
  const torque = isGenuine ? 57.7 : 1.8;
  const powerFactor = isGenuine ? 0.871 : 0.994;
  const activePower = isGenuine ? 95.0 : 82.5;
  const meltRate = isGenuine ? 248.6 : 0.0;
  const jevConfidence = isGenuine ? 96.5 : 14.8;

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

        {/* Live Simulation Mode Toggle */}
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800 self-start">
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
      </div>

      {/* Alert Banner if Spoofed */}
      {!isGenuine && (
        <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/60 text-rose-200 space-y-2 glow-rose animate-fadeIn">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-base">
            <AlertOctagon className="w-6 h-6 shrink-0 animate-bounce" />
            <span>CRITICAL AUDIT ALERT: IOT MECHANICAL FRAUD DETECTED</span>
          </div>
          <p className="text-xs text-rose-300/90 leading-relaxed">
            <strong>Physics Anomaly:</strong> Active electrical power draw is 82.5 kW with near-unity power factor (0.994), but mechanical screw torque is only 1.8 Nm. The plant has connected static resistive heating elements to simulate energy consumption without running viscous polymer extruders. <strong>Compliance credit issuance blocked.</strong>
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

        {/* Gauge 2: Shaft Torque */}
        <div className="p-5 rounded-2xl glass-card space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase">Screw Torque</span>
            <Scale className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white">{torque} <span className="text-sm font-sans text-slate-400">Nm</span></div>
            <p className="text-xs mt-1 text-slate-400">
              Min viscous threshold: <strong className="text-slate-200">15.0 Nm</strong>
            </p>
          </div>
        </div>

        {/* Gauge 3: Melt Rate */}
        <div className="p-5 rounded-2xl glass-card space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase">Extrusion Throughput</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white">{meltRate} <span className="text-sm font-sans text-slate-400">kg/h</span></div>
            <p className="text-xs mt-1 text-slate-400">
              Enthalpy balance: <strong className="text-slate-200">0.38 kWh/kg</strong>
            </p>
          </div>
        </div>

        {/* Gauge 4: TypeSafe Jev Reflex */}
        <div className="p-5 rounded-2xl glass-card space-y-3 border-cyan-500/20">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase text-cyan-300">Jev System 1 Reflex</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono ${isGenuine ? "text-cyan-400" : "text-rose-400"}`}>
              {jevConfidence}% <span className="text-xs font-sans text-slate-400">Score</span>
            </div>
            <p className="text-xs mt-1 text-slate-400">
              Evaluation latency: <strong className="text-cyan-400 font-mono">118ms</strong>
            </p>
          </div>
        </div>
      </div>

      {/* E-Way Bill & Packaging Ledger Check */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-400" />
            Inbound Logistics & GST E-Way Bill Verification
          </h3>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            E-Way: EWB-2026-99210
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
            <span className="text-slate-400 font-sans">Weighbridge Tare / Gross</span>
            <p className="text-slate-100 font-bold mt-1">13,500 kg / 28,500 kg</p>
            <p className="text-emerald-400 font-sans mt-0.5">Net Plastic Scrap: 15,000 kg (Matched)</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
            <span className="text-slate-400 font-sans">Vehicle Transit</span>
            <p className="text-slate-100 font-bold mt-1">DL-01-AB-4819 (GPS Tracked)</p>
            <p className="text-emerald-400 font-sans mt-0.5">Origin: Okhla Collection Center</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
            <span className="text-slate-400 font-sans">HSN Classification</span>
            <p className="text-slate-100 font-bold mt-1">3915.10.00 (Rigid Polymers)</p>
            <p className="text-emerald-400 font-sans mt-0.5">National Ledger QR Check: VALID</p>
          </div>
        </div>

        {/* Action to proceed to Settlement */}
        <div className="pt-3 flex justify-end">
          <Link
            href="/settlement"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
          >
            <span>Proceed to 80/20 Escrow Gate</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
