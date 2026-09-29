"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Gavel,
  Lock,
  Plus,
  Radio,
  RefreshCw,
  RotateCw,
  Scale,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { broadcastRfp, fetchAuctions } from "@/app/lib/api";

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

export default function DoubleAuctionPage() {
  const [bids, setBids] = useState<Bid[]>([
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
  ]);
  const [targetTons, setTargetTons] = useState(5000);
  const [clearingPrice, setClearingPrice] = useState(7.8);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<any>(null);

  const statutoryFloor = 3.6; // 30% of ₹12/kg base rate
  const statutoryCeiling = 12.0; // 100% of ₹12/kg base rate

  useEffect(() => {
    fetchAuctions().then((aucs) => {
      if (aucs && aucs.length > 0) {
        const top = aucs[0];
        if (top.target_tons) setTargetTons(top.target_tons);
        if (top.clearing_price_inr) setClearingPrice(top.clearing_price_inr);
      }
    });
  }, []);

  const handleBroadcastRfp = async () => {
    setIsBroadcasting(true);
    try {
      const res = await broadcastRfp({
        company_id: "COMP-IN-001",
        category: "cat_i_rigid",
        target_tons: targetTons,
      });
      setBroadcastResult(res);
      // Append a newly matched bid
      const newBid: Bid = {
        id: `BID-RFP-${Date.now().toString().slice(-4)}`,
        recycler: "EcoMelt Solutions Ltd",
        plant: "Okhla Line 2",
        category: "Cat-I Rigid",
        tons: targetTons,
        pricePerKg: clearingPrice,
        status: "MATCHED",
        timestamp: new Date().toLocaleTimeString(),
      };
      setBids((prev) => [newBid, ...prev]);
    } catch {
      // Keep UI responsive
    } finally {
      setIsBroadcasting(false);
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

        <div className="flex items-center gap-3 self-start flex-wrap">
          <button
            onClick={handleBroadcastRfp}
            disabled={isBroadcasting}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
          >
            {isBroadcasting ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Broadcasting to Temporal...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Broadcast RFP to Liquidity Pool</span>
              </>
            )}
          </button>

          <Link
            href="/audit"
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <span>Proceed to Fraud Audit</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {broadcastResult && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>Temporal Workflow Dispatched:</strong> {broadcastResult.workflow_id} on task queue <code className="font-mono bg-emerald-900/60 px-1 py-0.5 rounded">synthetiq-main</code>.
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-300">Status: {broadcastResult.status}</span>
        </div>
      )}

      {/* Statutory Price Corridor Visualizer Banner */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              Statutory 30% - 100% Price Corridor Rule
            </h3>
            <p className="text-xs text-slate-400">
              Transactions outside corridor are automatically rejected by smart contract rules to prevent predatory pricing
            </p>
          </div>
          <div className="text-xs font-mono text-indigo-300">
            Base Statutory Penalty Rate: <strong className="text-white">₹12.00 / kg</strong>
          </div>
        </div>

        {/* Corridor Graphic */}
        <div className="space-y-2 pt-2">
          <div className="relative h-10 w-full rounded-xl bg-slate-900 border border-slate-800 flex items-center overflow-hidden">
            {/* Out-of-bounds left */}
            <div className="h-full bg-rose-500/10 border-r border-rose-500/30 flex items-center justify-center text-[10px] text-rose-400 font-bold" style={{ width: "30%" }}>
              Banned (&lt;30%)
            </div>

            {/* Statutory Corridor (30% to 100%) */}
            <div className="h-full bg-emerald-500/10 flex items-center justify-between px-3 text-xs font-bold text-emerald-300 relative" style={{ width: "70%" }}>
              <span>Floor: ₹{statutoryFloor.toFixed(2)}</span>
              {/* Marker for Clearing Price */}
              <div className="absolute left-[35%] -top-1 bottom-0 flex flex-col items-center justify-center">
                <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-mono text-[10px] font-bold shadow-md shadow-cyan-400/50">
                  Clearing: ₹{clearingPrice.toFixed(2)}/kg
                </span>
              </div>
              <span>Ceiling: ₹{statutoryCeiling.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono px-1">
            <span>₹0.00</span>
            <span>Corridor Active: Trades match within ₹3.60 to ₹12.00</span>
            <span>₹14.00+</span>
          </div>
        </div>
      </div>

      {/* Live Order Book Table */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-base font-bold text-white">Live Double Auction Order Book (Continuous Matching)</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">Total Matched: 5,000 / 5,000 Tons</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-4">Bid ID</th>
                <th className="py-3 px-4">Recycler Name</th>
                <th className="py-3 px-4">Plant Location</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Volume (Tons)</th>
                <th className="py-3 px-4 text-right">Offer (₹/kg)</th>
                <th className="py-3 px-4 text-center">Corridor Status</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {bids.map((bid) => (
                <tr key={bid.id} className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 font-bold text-indigo-300">{bid.id}</td>
                  <td className="py-3 px-4 font-sans text-slate-200">{bid.recycler}</td>
                  <td className="py-3 px-4 font-sans text-slate-400">{bid.plant}</td>
                  <td className="py-3 px-4 font-sans text-slate-300">{bid.category}</td>
                  <td className="py-3 px-4 text-right text-slate-100">{bid.tons.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-white">₹{bid.pricePerKg.toFixed(2)}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        bid.status === "MATCHED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : bid.status === "BIDDING"
                          ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {bid.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500 text-[11px]">{bid.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
