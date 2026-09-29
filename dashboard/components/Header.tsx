"use client";

import { useState } from "react";
import { Building2, ChevronDown, Radio, Shield, User } from "lucide-react";

export const COMPANIES = [
  {
    id: "COMP-IN-001",
    name: "Hindustan Consumer Goods Ltd",
    gstin: "27AAACH1234F1Z5",
    sector: "FMCG",
    footprint: 18500,
  },
  {
    id: "COMP-IN-002",
    name: "Apex Pharma Packaging Ltd",
    gstin: "07AABCA5678B1Z2",
    sector: "Pharma",
    footprint: 12400,
  },
  {
    id: "COMP-IN-003",
    name: "Tata Electronics Polymers",
    gstin: "29AABCT9988C1Z9",
    sector: "Electronics",
    footprint: 9800,
  },
];

interface HeaderProps {
  selectedCompanyId?: string;
  onCompanyChange?: (id: string) => void;
}

export default function Header({ selectedCompanyId = "COMP-IN-001", onCompanyChange }: HeaderProps) {
  const [selectedId, setSelectedId] = useState(selectedCompanyId);
  const activeCompany = COMPANIES.find((c) => c.id === selectedId) || COMPANIES[0];

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedId(e.target.value);
    if (onCompanyChange) {
      onCompanyChange(e.target.value);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#070b16]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Company Switcher */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
          <Building2 className="w-4 h-4 text-indigo-400" />
          <select
            value={selectedId}
            onChange={handleSelect}
            className="bg-transparent text-sm font-semibold text-slate-100 focus:outline-none cursor-pointer pr-1"
          >
            {COMPANIES.map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                {c.name} ({c.sector})
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs font-mono text-slate-400 px-2.5 py-1 rounded-lg bg-slate-900/50 border border-slate-800/60 hidden md:inline-block">
          GSTIN: {activeCompany.gstin}
        </span>
        <span className="text-xs font-bold text-indigo-400 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20">
          FY2026-27
        </span>
      </div>

      {/* Live Status Indicators & Profile */}
      <div className="flex items-center space-x-4">
        {/* SCADA Status Pill */}
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono">50Hz Extruder Stream</span>
        </div>

        {/* User Identity */}
        <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
            CO
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-200">Compliance Officer</p>
            <p className="text-[10px] text-slate-400 font-mono">DSC: Valid (X.509)</p>
          </div>
        </div>
      </div>
    </header>
  );
}
