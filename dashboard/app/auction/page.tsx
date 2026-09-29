"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Gavel,
  Lock,
  Radio,
  RefreshCw,
  Scale,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";

interface Bid {
  id: string;
  recycler: string;
  plant: string;
  category: string;
  tons: number;
  pricePerKg: number;
  status: "MATCHED" | "BIDDING" | "OUT_OF_CORRIDOR";
  timestamp: string;
}

const INITIAL_BIDS: Bid[] = [
  {
    id: "BID-DEL-101",
    recycler: "EcoMelt Solutions Ltd",
    plant: "Okhla Industrial Plant 2",
    category: "Cat-I Rigid",
    tons: 3000,
    pricePerKg: 7.8,
    status: "MATCHED",
    timestamp: "11:24:02",
  },
  {
    id: "BID-GUJ-204",
    recycler: "Gujarat Poly-Recyclers",
    plant: "Surat GIDC Extrusion Facility",
    category: "Cat-I Rigid",
    tons: 2000,
    pricePerKg: 7.8,
    status: "MATCHED",
    timestamp: "11:24:08",
  },
  {
    id: "BID-MAH-309",
    recycler: "Deccan Circular Plastics",
    plant: "Pune Chakan Line 1",
    category: "Cat-I Rigid",
    tons: 2500,
    pricePerKg: 8.4,
    status: "BIDDING",
    timestamp: "11:24:15",
  },
  {
    id: "BID-TN-412",
    recycler: "Chennai EcoProcessors",
    plant: "Sriperumbudur Hub",
    category: "Cat-I Rigid",
    tons: 1500,
    pricePerKg: 13.5,
    status: "OUT_OF_CORRIDOR",
    timestamp: "11:24:20",
  },
];

export default function DoubleAuctionPage() {
  const [bids, setBids] = useState<Bid[]>(INITIAL_BIDS);
  const [targetTons] = useState(5000);
  const [clearingPrice] = useState(7.8);
  const statutoryFloor = 3.6; // 30% of ₹12/kg base rate
  const statutoryCeiling = 12.0; // 100% of ₹12/kg base rate

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-slate-200">Executive Hub</Link>
            <span>/</span>
            <span className="text-indigo-400 font-medium">Workflow 2: Liquidity & Auction</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Gavel className="w-6 h-6 text-indigo-400" />
            Continuous Double Auction Room
          </h2>
          <p className="text-sm text-slate-400">
            Treasury Agent autonomous matching locked within statutory corridor ($30\% - 100\%$)
          </p>
        </div>

        <Link
          href="/audit"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-sm flex items-center gap-2 self-start shadow-md shadow-indigo-500/20"
        >
          <span>Proceed to Quad-Core Audit</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Statutory Price Corridor Visualizer Card */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              Statutory Compensation Price Corridor
            </h3>
            <p className="text-xs text-slate-400">
              CPCB Environmental Compensation rate bounds: Minimum 30% to Maximum 100%
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Statutory Rate:</span>
            <span className="text-white font-bold bg-slate-800 px-2 py-0.5 rounded">₹12.00 / kg</span>
          </div>
        </div>

        {/* Visual Corridor Bar */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-amber-400 font-bold">Floor: ₹{statutoryFloor.toFixed(2)} (30%)</span>
            <span className="text-emerald-400 font-bold text-sm">Clearing: ₹{clearingPrice.toFixed(2)} / kg</span>
            <span className="text-rose-400 font-bold">Ceiling: ₹{statutoryCeiling.toFixed(2)} (100%)</span>
          </div>

          <div className="h-6 w-full rounded-xl bg-slate-950 p-1 relative border border-slate-800 overflow-hidden">
            {/* 30% - 100% Allowed Region */}
            <div
              style={{ left: "30%", width: "70%" }}
              className="absolute top-1 bottom-1 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-rose-500/20 rounded border border-emerald-500/30"
            />
            {/* Clearing Price Marker */}
            <div
              style={{ left: "65%" }}
              className="absolute top-0 bottom-0 w-1 bg-emerald-400 shadow-lg shadow-emerald-400 flex flex-col items-center"
            >
              <div className="w-3 h-3 bg-emerald-400 rounded-full -mt-1" />
            </div>
          </div>

          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Rejected (Anti-Dumping Floor)</span>
            <span className="text-emerald-400 font-semibold">Autonomous Liquidity Clearing Zone</span>
            <span>Rejected (Exceeds Penalty Cap)</span>
          </div>
        </div>
      </div>

      {/* Auction Bidding Table */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Recycler (PWP) Order Book & Live Bids
            </h3>
            <p className="text-xs text-slate-400">
              Matched: <strong className="text-emerald-400 font-mono">5,000 / 5,000 Tons</strong> target volume
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Auction Matched
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400 tracking-wider">
                <th className="pb-3 px-3">Bid ID</th>
                <th className="pb-3 px-3">Recycler Entity</th>
                <th className="pb-3 px-3">Plant Facility</th>
                <th className="pb-3 px-3">Offered Volume</th>
                <th className="pb-3 px-3">Bid Price</th>
                <th className="pb-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {bids.map((b) => (
                <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 text-slate-400">{b.id}</td>
                  <td className="py-3 px-3 font-sans font-semibold text-white">{b.recycler}</td>
                  <td className="py-3 px-3 font-sans text-slate-400">{b.plant}</td>
                  <td className="py-3 px-3 text-slate-200">{b.tons.toLocaleString()} Tons</td>
                  <td className="py-3 px-3 font-bold text-slate-200">₹{b.pricePerKg.toFixed(2)}/kg</td>
                  <td className="py-3 px-3 font-sans">
                    {b.status === "MATCHED" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        MATCHED (100%)
                      </span>
                    )}
                    {b.status === "BIDDING" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        ORDER BOOK
                      </span>
                    )}
                    {b.status === "OUT_OF_CORRIDOR" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        CORRIDOR EXCEEDED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
