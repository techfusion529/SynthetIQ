"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  Layers,
  Play,
  RotateCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import {
  E2ERunResult,
  fetchAuditVerdicts,
  fetchComplianceRuns,
  fetchConfig,
  fetchLiabilityReport,
  runE2ECompliance,
  SystemConfig,
} from "@/app/lib/api";

export default function ExecutiveOverviewPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [simulateSpoof, setSimulateSpoof] = useState(false);
  const [latestRun, setLatestRun] = useState<E2ERunResult | null>(null);
  const [allRuns, setAllRuns] = useState<E2ERunResult[]>([]);
  const [engineConfig, setEngineConfig] = useState<SystemConfig | null>(null);
  const [liabilityData, setLiabilityData] = useState<any>(null);
  const [auditVerdicts, setAuditVerdicts] = useState<any[]>([]);

  useEffect(() => {
    fetchConfig().then((cfg) => {
      if (cfg) setEngineConfig(cfg);
    });
    fetchComplianceRuns().then((runs) => {
      if (runs && runs.length > 0) {
        setAllRuns(runs);
        setLatestRun(runs[0]);
      }
    });
    fetchLiabilityReport("COMP-IN-001").then((rep) => {
      if (rep) setLiabilityData(rep);
    });
    fetchAuditVerdicts().then((verdicts) => {
      if (verdicts) setAuditVerdicts(verdicts);
    });
  }, []);

  const handleLaunchComplianceRun = async () => {
    setIsRunning(true);
    try {
      const result = await runE2ECompliance({
        company_id: "COMP-IN-001",
        fiscal_year: "FY2026-27",
        category: "cat_i_rigid",
        volume_tons: 250.0,
        simulate_spoof: simulateSpoof,
      });
      setLatestRun(result);
      setAllRuns((prev) => [result, ...prev]);

      // Refresh audits and liability
      fetchAuditVerdicts().then((v) => v && setAuditVerdicts(v));
      fetchLiabilityReport("COMP-IN-001").then((r) => r && setLiabilityData(r));
    } catch (e: any) {
      console.error("Compliance run error:", e);
    } finally {
      setIsRunning(false);
    }
  };

  const grossTons = liabilityData?.current_year_liability_tons || 18500;
  const netDeficitTons = liabilityData?.net_liability_tons || 17200;
  const amortizedDebtTons = liabilityData?.amortized_debt_tons || 1200;
  const escrowCr = latestRun?.status === "SUCCESS_FULLY_COMPLIANT" ? "₹1.95" : "₹0.00";
  const confidenceScore = latestRun?.steps?.[2]?.data?.confidence_score
    ? `${Math.round(latestRun.steps[2].data.confidence_score * 100)}%`
    : "96.5%";

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 z-10">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Autonomous Multi-Agent Orchestrator
            </span>
            <span className="text-xs text-slate-400">Enterprise PIBO Portal</span>
            <span className="text-xs font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
              {engineConfig ? `${engineConfig.gemini.model} • ${engineConfig.jev_mode.mode}` : "Temporal Worker Active"}
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            EPR Compliance & Anti-Fraud Cockpit
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl">
            Temporal-orchestrated multi-agent pipeline executing across SAP sales records, double auctions,
            and real-time 50Hz SCADA physics telemetry for statutory CPCB fulfillment.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 z-10">
          {/* Spoof injection toggle */}
          <label className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 cursor-pointer select-none text-xs">
            <input
              type="checkbox"
              checked={simulateSpoof}
              onChange={(e) => setSimulateSpoof(e.target.checked)}
              className="accent-rose-500 rounded"
            />
            <span className={simulateSpoof ? "text-rose-400 font-semibold" : "text-slate-400"}>
              {simulateSpoof ? "Spoof Active (Space Heaters)" : "Simulate Spoof"}
            </span>
          </label>

          <button
            onClick={handleLaunchComplianceRun}
            disabled={isRunning}
            className={`px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center space-x-2 shadow-lg transition-all ${
              isRunning
                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                : simulateSpoof
                ? "bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-900/30 cursor-pointer"
                : "bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer"
            }`}
          >
            {isRunning ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Executing Temporal Workflow...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>{simulateSpoof ? "Run With Injected Fraud" : "Launch E2E Compliance Run"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real-Time Live Execution Result Banner */}
      {latestRun && (
        <div
          className={`p-5 rounded-2xl border transition-all animate-fadeIn ${
            latestRun.status === "HALTED_DUE_TO_FRAUD"
              ? "bg-rose-950/40 border-rose-600/50 text-rose-200"
              : "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 mb-3 border-white/10">
            <div className="flex items-center space-x-3">
              {latestRun.status === "HALTED_DUE_TO_FRAUD" ? (
                <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              )}
              <div>
                <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                  <span>Run ID: {latestRun.run_id}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase ${
                      latestRun.status === "HALTED_DUE_TO_FRAUD"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {latestRun.status}
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">{latestRun.message}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs font-mono text-slate-300 flex-wrap gap-y-2">
              <span>Duration: {latestRun.duration_seconds}s</span>
              {latestRun.portal_ack_number && (
                <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2 py-1 rounded border border-cyan-800">
                  CPCB: {latestRun.portal_ack_number}
                </span>
              )}
              {/* Direct Link to Temporal Web UI */}
              <a
                href="http://localhost:8080/namespaces/default/workflows"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-indigo-200 font-semibold flex items-center space-x-1.5 transition"
              >
                <span>Temporal UI</span>
                <ExternalLink className="w-3.5 h-3.5 text-indigo-300" />
              </a>
            </div>
          </div>

          {/* Sequential Step Progression */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
            {latestRun.steps.map((st) => (
              <div
                key={st.step}
                className={`p-2.5 rounded-xl border text-xs ${
                  st.status === "BLOCKED_BY_JEV"
                    ? "bg-rose-900/40 border-rose-500 text-rose-200"
                    : st.status === "COMPLETED"
                    ? "bg-slate-900/60 border-emerald-500/40 text-slate-200"
                    : "bg-slate-900/40 border-slate-800 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[10px] text-slate-400 uppercase">Stage {st.step}</span>
                  {st.status === "COMPLETED" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : st.status === "BLOCKED_BY_JEV" ? (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>
                <p className="font-semibold truncate">{st.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{st.service}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl glass-card space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Gross Packaging</span>
            <Scale className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">
              {grossTons.toLocaleString()} <span className="text-sm font-sans font-medium text-slate-400">Tons</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-indigo-400 font-semibold">+4.2%</span> YoY FMCG packaging sales
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl glass-card space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Net EPR Deficit</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400 font-mono">
              {netDeficitTons.toLocaleString()} <span className="text-sm font-sans font-medium text-slate-400">Tons</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Incl. <strong className="text-slate-200">{amortizedDebtTons.toLocaleString()} T</strong> (1/3rd debt amortization)
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl glass-card space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">80/20 Escrow Volume</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">
              {escrowCr} <span className="text-sm font-sans font-medium text-slate-400">Cr</span>
            </div>
            <p className="text-xs text-emerald-400 mt-1 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 80% Advance released on melt proof
            </p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl glass-card space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Physics Melt Verified</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-cyan-400 font-mono">
              {confidenceScore} <span className="text-xs font-sans text-slate-400">Confidence</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              TypeSafe Jev: Zero resistive spoofing
            </p>
          </div>
        </div>
      </div>

      {/* 4-Workflow End-to-End Orchestration Stepper */}
      <div className="p-6 rounded-2xl glass-panel space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Autonomous Multi-Agent Workflow Pipeline
            </h3>
            <p className="text-xs text-slate-400">
              Temporal durable orchestration connecting SAP ERP, continuous auctions, Jev SCADA audit, and CPCB Form-1
            </p>
          </div>
          <a
            href="http://localhost:8080/namespaces/default/workflows"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-indigo-300 hover:text-white px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 flex items-center space-x-1"
          >
            <span>Temporal Web UI</span>
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Step 1 */}
          <Link href="/liability" className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-400 uppercase">Workflow 1</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white">Upstream Liability</h4>
            <p className="text-xs text-slate-400 mt-1">1/3rd debt amortization & category mapping</p>
            <div className="mt-3 flex items-center text-xs text-indigo-400 font-medium">
              View Matrix <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          {/* Step 2 */}
          <Link href="/auction" className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-400 uppercase">Workflow 2</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white">Double Auction Room</h4>
            <p className="text-xs text-slate-400 mt-1">30%-100% statutory price corridor</p>
            <div className="mt-3 flex items-center text-xs text-indigo-400 font-medium">
              Open Order Book <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          {/* Step 3 */}
          <Link href="/audit" className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all group relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-cyan-400 uppercase">Workflow 3</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white">Quad-Core Fraud Audit</h4>
            <p className="text-xs text-slate-400 mt-1">50Hz SCADA torque & resistive spoof detector</p>
            <div className="mt-3 flex items-center text-xs text-cyan-400 font-medium">
              Launch Oscilloscope <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          {/* Step 4 */}
          <Link href="/settlement" className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-400 uppercase">Workflow 4</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white">80/20 Escrow & Form-1</h4>
            <p className="text-xs text-slate-400 mt-1">Dual-signature release & CPCB filing</p>
            <div className="mt-3 flex items-center text-xs text-indigo-400 font-medium">
              Review Escrow POs <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>
        </div>
      </div>

      {/* Categories Breakdown & Live Jev Audit Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">CPCB Category Obligation & Fulfillment</h3>
              <p className="text-xs text-slate-400">Current fulfillment status under PWM Amendment Rules 2026</p>
            </div>
            <Link href="/liability" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold">
              Manage Targets <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4 pt-1">
            {[
              {
                cat: "Category I: Rigid Plastic",
                target: liabilityData?.breakdown_by_category?.cat_i_rigid || 7500,
                fulfilled: 6200,
                color: "bg-indigo-500",
                cf: "1.00",
              },
              {
                cat: "Category II: Flexible Plastic",
                target: liabilityData?.breakdown_by_category?.cat_ii_flexible || 6200,
                fulfilled: 4800,
                color: "bg-cyan-500",
                cf: "0.80",
              },
              {
                cat: "Category III: Multi-Layered (MLP)",
                target: liabilityData?.breakdown_by_category?.cat_iii_mlp || 2500,
                fulfilled: 2100,
                color: "bg-emerald-500",
                cf: "0.50",
              },
              {
                cat: "Category IV: Compostable",
                target: liabilityData?.breakdown_by_category?.cat_iv_compostable || 1000,
                fulfilled: 950,
                color: "bg-amber-500",
                cf: "1.00",
              },
            ].map((item) => {
              const pct = Math.min(100, Math.round((item.fulfilled / item.target) * 100));
              return (
                <div key={item.cat} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200">{item.cat}</span>
                    <span className="text-slate-400 font-mono">
                      {item.fulfilled.toLocaleString()} / {item.target.toLocaleString()} T ({pct}%) • Cf: {item.cf}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Jev Audit Activity Ledger (1 Col) */}
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Live Jev Audit Activity
              </h3>
              <p className="text-[11px] text-slate-400">Zero-trust cryptographic proofs</p>
            </div>
            <Link href="/audit" className="text-xs text-cyan-400 hover:text-cyan-300">
              Audit Hub
            </Link>
          </div>

          <div className="space-y-3">
            {auditVerdicts.length > 0 ? (
              auditVerdicts.slice(0, 3).map((aud) => (
                <div key={aud.audit_id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-300">{aud.audit_id}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        aud.audit_verdict === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {aud.audit_verdict}
                    </span>
                  </div>
                  <p className="text-slate-400 truncate">{aud.recycler_id} • {aud.plant_id}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Torque: {aud.physics?.torque_nm || 42.6} Nm</span>
                    <span>Conf: {Math.round((aud.confidence_score || 0.965) * 100)}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">
                No audits logged yet. Launch a run to generate live verdicts.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
