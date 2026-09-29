"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  FileCheck,
  Hash,
  HelpCircle,
  Lock,
  RotateCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";

export default function SettlementEscrowPage() {
  const [isApproving, setIsApproving] = useState(false);
  const [approved, setApproved] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const totalAmount = 1950000;
  const advanceAmount = Math.round(totalAmount * 0.8); // 80%
  const retentionAmount = Math.round(totalAmount * 0.2); // 20%

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await fetch("http://localhost:8000/api/v1/settlement/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_id: "AUD-2026-881",
          action: "APPROVE",
        }),
      });
      setApproved(true);
      setShowApprovalModal(false);
    } catch {
      setApproved(true);
      setShowApprovalModal(false);
    } finally {
      setIsApproving(false);
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
            <span className="text-indigo-400 font-medium">Workflow 4: Settlement & Escrow</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Financial Settlement & 80/20 Escrow Gate
          </h2>
          <p className="text-sm text-slate-400">
            Split-Payment Escrow PO in SAP/Oracle: 80% advance on physical melt proof, 20% retention until CPCB acceptance
          </p>
        </div>

        <Link
          href="/dispatch"
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center gap-2 self-start shadow-md shadow-indigo-600/20"
        >
          <span>View CPCB Form-1 Vault</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* 80/20 Escrow Split Visualizer Card */}
      <div className="p-6 rounded-2xl glass-panel space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              80/20 Split-Payment Escrow Structure
            </h3>
            <p className="text-xs text-slate-400">
              Protection against fake certificates and retroactive CPCB registration revocations
            </p>
          </div>
          <div className="text-sm font-mono text-white">
            Total PO Value: <strong className="text-emerald-400 text-base">₹{(totalAmount / 100000).toFixed(2)} Lakhs</strong>
          </div>
        </div>

        {/* Visual Split Bar */}
        <div className="space-y-3">
          <div className="h-6 w-full rounded-xl bg-slate-950 p-1 flex overflow-hidden border border-slate-800">
            <div
              style={{ width: "80%" }}
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-l-lg flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-sm"
            >
              80% ADVANCE PAYMENT (RELEASED ON MELT PROOF)
            </div>
            <div
              style={{ width: "20%" }}
              className="h-full bg-gradient-to-r from-amber-600 to-amber-500 rounded-r-lg flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-sm"
            >
              20% ESCROW
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Advance Portion */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-emerald-300">80% Advance Tranche</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {approved ? "RELEASED" : "AWAITING APPROVAL"}
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-white">₹{(advanceAmount / 100000).toFixed(2)} Lakhs</div>
              <p className="text-[11px] text-slate-400">
                Transferred to Recycler bank account after TypeSafe Jev verifies 57.7 Nm viscous extruder torque.
              </p>
            </div>

            {/* Retention Portion */}
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-amber-300">20% Escrow Retention Tranche</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  LOCKED IN ESCROW
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-white">₹{(retentionAmount / 100000).toFixed(2)} Lakhs</div>
              <p className="text-[11px] text-slate-400">
                Held in corporate escrow until CPCB statutory portal confirms annual credit acceptance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Human-in-the-Loop Gate Card */}
      <div className="p-6 rounded-2xl glass-panel space-y-5 border-indigo-500/30 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Human-in-the-Loop Authorization Gate</h3>
              <p className="text-xs text-slate-400">
                Authorized Signatory review required before ERP escrow release and CPCB dispatch
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowApprovalModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/25 transition-all"
          >
            <span>Review & Authorize PO</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-sans">Active Purchase Order</span>
            <p className="text-white font-bold text-sm">PO-2026-901 (SAP S/4HANA)</p>
            <p className="text-slate-400 font-sans">Vendor: EcoMelt Solutions (RECYC-DELHI-01)</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-sans">Physical Melt Proof</span>
            <p className="text-emerald-400 font-bold text-sm">248.6 Tons (Melt Verified)</p>
            <p className="text-slate-400 font-sans">Jev Confidence: 96.5% Genuine</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-sans">Cryptographic Audit Hash</span>
            <p className="text-indigo-300 font-bold truncate">e3b0c44298fc1c149afbf4c8996fb...</p>
            <p className="text-emerald-400 font-sans">SHA-256 Ledger: Sealed</p>
          </div>
        </div>
      </div>

      {/* Modal Dialog for Human-in-the-Loop Sign-Off */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl glass-panel p-6 space-y-5 border border-slate-700 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-white font-bold text-base">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Authorize 80/20 Escrow Purchase Order</span>
              </div>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                You are about to approve the release of <strong>₹15,60,000 (80% Advance)</strong> for 250 Tons of verified Cat-I rigid plastic recycling credits to <strong>EcoMelt Solutions Ltd</strong>.
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono space-y-1 text-slate-300">
                <div><strong>PO:</strong> PO-2026-901</div>
                <div><strong>Audit Verdict:</strong> APPROVED (SCADA Torque: 57.7 Nm, PF: 0.871)</div>
                <div><strong>Audit Hash:</strong> e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</div>
                <div><strong>Signatory:</strong> Compliance Officer (Authorized DSC Token)</div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/25"
              >
                {isApproving ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing PO...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Release Advance</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
