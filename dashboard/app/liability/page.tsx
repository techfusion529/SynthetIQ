"use client";

import { useEffect, useState } from "react";
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
import { calculateLiability, fetchLiabilityReport } from "@/app/lib/api";

export default function LiabilitySourcingPage() {
  const [historicDebt, setHistoricDebt] = useState<number>(3600);
  const [currentYearBase, setCurrentYearBase] = useState<number>(18500);
  const [alreadyFulfilled, setAlreadyFulfilled] = useState<number>(2500);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, number>>({
    cat_i_rigid: 7500.0,
    cat_ii_flexible: 6200.0,
    cat_iii_mlp: 2500.0,
    cat_iv_compostable: 1000.0,
  });
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    fetchLiabilityReport("COMP-IN-001").then((report) => {
      if (report) {
        setCurrentYearBase(report.current_year_liability_tons || 18500);
        setHistoricDebt(report.historic_debt_tons || 3600);
        setAlreadyFulfilled(report.already_fulfilled_tons || 2500);
        if (report.breakdown_by_category) {
          setCategoryBreakdown(report.breakdown_by_category);
        }
      }
    });
  }, []);

  // CPCB 1/3 amortization formula
  const amortizedDebt = Math.round(historicDebt / 3);
  const netLiability = currentYearBase + amortizedDebt - alreadyFulfilled;

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await calculateLiability({
        company_id: "COMP-IN-001",
        fiscal_year: "FY2026-27",
        historic_debt_tons: historicDebt,
      });
      if (res && res.details) {
        // API updated
      }
    } catch {
      // keep state
    } finally {
      setIsRecalculating(false);
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
            <span className="text-indigo-400 font-medium">Workflow 1: Liability & Sourcing</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-indigo-400" />
            Plastic Liability & 1/3rd Debt Amortization Matrix
          </h2>
          <p className="text-sm text-slate-400">
            CPCB EPR Guidelines 2026: Mathematical debt amortization and statutory conversion factors ($C_f$)
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
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
              Net = Current + (Debt / 3) − Fulfilled
            </div>
            <button
              onClick={handleRecalculate}
              disabled={isRecalculating}
              className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
              <span>Sync Server</span>
            </button>
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
              <p className="text-[10px] text-slate-400 mt-0.5">FY26 Sales Ingestion</p>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[11px] text-amber-300 uppercase font-medium">Amortized 1/3rd</span>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">+{amortizedDebt.toLocaleString()} T</div>
              <p className="text-[10px] text-amber-300/80 mt-0.5">33.3% Annual Tranche</p>
            </div>

            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-[11px] text-indigo-300 uppercase font-medium">Net Obligation</span>
              <div className="text-xl font-bold font-mono text-indigo-400 mt-1">{netLiability.toLocaleString()} T</div>
              <p className="text-[10px] text-indigo-300/80 mt-0.5">Less {alreadyFulfilled.toLocaleString()}T Done</p>
            </div>
          </div>
        </div>
      </div>

      {/* Statutory Category Conversion Factor ($C_f$) Table */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="border-b border-slate-800/80 pb-3">
          <h3 className="text-base font-bold text-white">Statutory Conversion Factor ($C_f$) Matrix</h3>
          <p className="text-xs text-slate-400">
            CPCB Weight Multipliers for physical credit calculation: Credit = Physical Tons × $C_f$
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-4">Plastic Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Target (Tons)</th>
                <th className="py-3 px-4 text-center">Mechanical $C_f$</th>
                <th className="py-3 px-4 text-center">Waste-to-Energy $C_f$</th>
                <th className="py-3 px-4 text-right">Net Statutory Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              <tr className="hover:bg-slate-900/40">
                <td className="py-3 px-4 font-bold text-indigo-300">Category I</td>
                <td className="py-3 px-4 font-sans text-slate-300">Rigid Plastic Packaging</td>
                <td className="py-3 px-4 text-slate-200">{(categoryBreakdown.cat_i_rigid || 7500).toLocaleString()}</td>
                <td className="py-3 px-4 text-center text-emerald-400 font-bold">1.00</td>
                <td className="py-3 px-4 text-center text-slate-400">0.70</td>
                <td className="py-3 px-4 text-right font-bold text-white">
                  {(categoryBreakdown.cat_i_rigid || 7500).toLocaleString()} Credits
                </td>
              </tr>
              <tr className="hover:bg-slate-900/40">
                <td className="py-3 px-4 font-bold text-cyan-300">Category II</td>
                <td className="py-3 px-4 font-sans text-slate-300">Flexible Single/Multi-Layer</td>
                <td className="py-3 px-4 text-slate-200">{(categoryBreakdown.cat_ii_flexible || 6200).toLocaleString()}</td>
                <td className="py-3 px-4 text-center text-emerald-400 font-bold">0.80</td>
                <td className="py-3 px-4 text-center text-slate-400">0.60</td>
                <td className="py-3 px-4 text-right font-bold text-white">
                  {Math.round((categoryBreakdown.cat_ii_flexible || 6200) * 0.8).toLocaleString()} Credits
                </td>
              </tr>
              <tr className="hover:bg-slate-900/40">
                <td className="py-3 px-4 font-bold text-emerald-300">Category III</td>
                <td className="py-3 px-4 font-sans text-slate-300">Multi-Layered Plastic (MLP)</td>
                <td className="py-3 px-4 text-slate-200">{(categoryBreakdown.cat_iii_mlp || 2500).toLocaleString()}</td>
                <td className="py-3 px-4 text-center text-emerald-400 font-bold">0.50</td>
                <td className="py-3 px-4 text-center text-cyan-400 font-bold">0.90</td>
                <td className="py-3 px-4 text-right font-bold text-white">
                  {Math.round((categoryBreakdown.cat_iii_mlp || 2500) * 0.5).toLocaleString()} Credits
                </td>
              </tr>
              <tr className="hover:bg-slate-900/40">
                <td className="py-3 px-4 font-bold text-amber-300">Category IV</td>
                <td className="py-3 px-4 font-sans text-slate-300">Compostable Plastics</td>
                <td className="py-3 px-4 text-slate-200">{(categoryBreakdown.cat_iv_compostable || 1000).toLocaleString()}</td>
                <td className="py-3 px-4 text-center text-emerald-400 font-bold">1.00</td>
                <td className="py-3 px-4 text-center text-slate-400">0.80</td>
                <td className="py-3 px-4 text-right font-bold text-white">
                  {(categoryBreakdown.cat_iv_compostable || 1000).toLocaleString()} Credits
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
