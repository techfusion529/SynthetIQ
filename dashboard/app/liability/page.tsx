"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  HelpCircle,
  Info,
  Layers,
  Percent,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
} from "lucide-react";

export default function LiabilitySourcingPage() {
  const [historicDebt, setHistoricDebt] = useState<number>(3600);
  const currentYearBase = 18500;
  const alreadyFulfilled = 2500;

  // CPCB 1/3 amortization formula
  const amortizedDebt = Math.round(historicDebt / 3);
  const netLiability = currentYearBase + amortizedDebt - alreadyFulfilled;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-slate-200">Executive Hub</Link>
            <span>/</span>
            <span className="text-indigo-400 font-medium">Workflow 1: Liability & Sourcing</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-indigo-400" />
            Plastic Liability & 1/3rd Debt Amortization Matrix
          </h2>
          <p className="text-sm text-slate-400">
            CPCB EPR Guidelines 2026: Mathematical debt amortization and conversion factors ($C_f$)
          </p>
        </div>

        <Link
          href="/auction"
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center gap-2 self-start shadow-md shadow-indigo-600/20"
        >
          <span>Proceed to Auction Room</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Interactive 1/3rd Debt Amortization Calculator */}
      <div className="p-6 rounded-2xl glass-panel space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400" />
              Statutory 1/3rd Historic Debt Amortization Engine
            </h3>
            <p className="text-xs text-slate-400">
              Rule 13(2): Past deficits amortized in equal 33.33% fractions over 3 rolling fiscal years
            </p>
          </div>
          <div className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
            Net = Current + (Debt / 3) − Fulfilled
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Slider control */}
          <div className="space-y-3 md:col-span-1 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Historic Carryover Debt</span>
              <span className="font-mono text-amber-400 font-bold text-sm">{historicDebt.toLocaleString()} Tons</span>
            </div>
            <input
              type="range"
              min="0"
              max="9000"
              step="300"
              value={historicDebt}
              onChange={(e) => setHistoricDebt(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0 T</span>
              <span>4,500 T</span>
              <span>9,000 T</span>
            </div>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Current Base</span>
              <div className="text-xl font-bold font-mono text-white mt-1">{currentYearBase.toLocaleString()} T</div>
              <span className="text-[10px] text-slate-400">FMCG Sales</span>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <span className="text-[11px] text-amber-300 uppercase font-medium">+ Amortized (1/3)</span>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">+{amortizedDebt.toLocaleString()} T</div>
              <span className="text-[10px] text-amber-300/80">FY26 share</span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[11px] text-emerald-300 uppercase font-medium">Net Mandate</span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{netLiability.toLocaleString()} T</div>
              <span className="text-[10px] text-emerald-300/80">Net obligation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Factor Matrix ($C_f$) */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Statutory Conversion Factors ($C_f$) Matrix
          </h3>
          <p className="text-xs text-slate-400">
            CPCB multi-tier recycling chemistry multipliers determining physical melting credit yield
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400 tracking-wider">
                <th className="pb-3 px-3">Plastic Category</th>
                <th className="pb-3 px-3">Primary Chemistry</th>
                <th className="pb-3 px-3">Mechanical ($C_f$)</th>
                <th className="pb-3 px-3">Co-Processing ($C_f$)</th>
                <th className="pb-3 px-3">Minimum Recycled %</th>
                <th className="pb-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-3 font-sans font-semibold text-white">Cat-I: Rigid Plastics</td>
                <td className="py-3 px-3 text-slate-300">Mechanical Extrusion</td>
                <td className="py-3 px-3 font-bold text-emerald-400">1.00</td>
                <td className="py-3 px-3 text-slate-400">0.70</td>
                <td className="py-3 px-3 text-indigo-300">60%</td>
                <td className="py-3 px-3 font-sans"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span></td>
              </tr>
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-3 font-sans font-semibold text-white">Cat-II: Flexible Plastics</td>
                <td className="py-3 px-3 text-slate-300">Pelletizing / Compounding</td>
                <td className="py-3 px-3 font-bold text-emerald-400">0.80</td>
                <td className="py-3 px-3 text-slate-400">0.60</td>
                <td className="py-3 px-3 text-indigo-300">50%</td>
                <td className="py-3 px-3 font-sans"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span></td>
              </tr>
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-3 font-sans font-semibold text-white">Cat-III: Multi-Layered (MLP)</td>
                <td className="py-3 px-3 text-slate-300">Pyrolysis / Co-Processing</td>
                <td className="py-3 px-3 text-slate-400">0.50</td>
                <td className="py-3 px-3 font-bold text-cyan-400">0.90</td>
                <td className="py-3 px-3 text-indigo-300">40%</td>
                <td className="py-3 px-3 font-sans"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span></td>
              </tr>
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-3 font-sans font-semibold text-white">Cat-IV: Compostable Plastics</td>
                <td className="py-3 px-3 text-slate-300">Industrial Composting</td>
                <td className="py-3 px-3 font-bold text-emerald-400">1.00</td>
                <td className="py-3 px-3 text-slate-400">0.80</td>
                <td className="py-3 px-3 text-indigo-300">100%</td>
                <td className="py-3 px-3 font-sans"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
