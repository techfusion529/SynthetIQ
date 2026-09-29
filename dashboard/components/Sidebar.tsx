"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Award,
  CheckCircle2,
  Cpu,
  FileText,
  Layers,
  LayoutDashboard,
  Radio,
  Scale,
  Shield,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  {
    name: "Executive Hub",
    href: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: "Liability & Sourcing",
    href: "/liability",
    icon: Scale,
    badge: "W1",
  },
  {
    name: "Double Auction",
    href: "/auction",
    icon: TrendingUp,
    badge: "W2",
  },
  {
    name: "Quad-Core Audit",
    href: "/audit",
    icon: Activity,
    badge: "SCADA",
    highlight: true,
  },
  {
    name: "Escrow & Approval",
    href: "/settlement",
    icon: ShieldCheck,
    badge: "80/20",
  },
  {
    name: "CPCB Form-1 Vault",
    href: "/dispatch",
    icon: FileText,
    badge: "DSC",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#070b16]/95 flex flex-col h-screen sticky top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
            Synthet<span className="text-cyan-400">IQ</span>
          </h1>
          <p className="text-[11px] font-medium text-slate-400">Zero-Trust EPR Compliance</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Workflows & Audit Engine
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm shadow-indigo-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-indigo-400" : item.highlight ? "text-cyan-400" : "text-slate-400"
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    item.highlight
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "bg-slate-800 text-slate-400 border border-slate-700/60"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Cluster / Reflex Health Strip */}
      <div className="p-4 m-3 rounded-xl bg-slate-900/60 border border-slate-800/70 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            Jev System 1 Reflex
          </span>
          <span className="text-[11px] font-mono text-emerald-400">120ms</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
            Temporal Cluster
          </span>
          <span className="text-[11px] font-mono text-cyan-400">4 Flows</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
            CPCB Gateway
          </span>
          <span className="text-[11px] font-mono text-indigo-400">Active</span>
        </div>
      </div>
    </aside>
  );
}
