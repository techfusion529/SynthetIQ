"use client";

import { useEffect, useState } from "react";
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
import { approveEscrow, fetchEscrowPOs } from "@/app/lib/api";

export default function SettlementEscrowPage() {
  const [isApproving, setIsApproving] = useState(false);
  const [approved, setApproved] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalResponse, setApprovalResponse] = useState<any>(null);

  const totalAmount = 1950000;
  const advanceAmount = Math.round(totalAmount * 0.8); // 80%
  const retentionAmount = Math.round(totalAmount * 0.2); // 20%

  useEffect(() => {
    fetchEscrowPOs().then((pos) => {
      if (pos && pos.length > 0) {
        setApproved(pos[0].status === "advance_released");
      }
    });
  }, []);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await approveEscrow("AUD-2026-881", "APPROVE");
      setApprovalResponse(res);
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

      {approvalResponse && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>Temporal HITL Approval Recorded:</strong> Approved by {approvalResponse.approved_by || "compliance.officer@brand.in"}. Advance 80% released in ERP.
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-300">Status: {approvalResponse.status}</span>
        </div>
      )}

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
        <div className="space-y-2">
          <div className="flex h-12 w-full rounded-xl overflow-hidden border border-slate-700/80 p-1 bg-slate-950 gap-1.5">
            {/* 80% Tranche */}
            <div
              className={`h-full rounded-lg transition-all flex items-center justify-between px-4 font-mono text-xs font-bold ${
                approved
                  ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
                  : "bg-emerald-900/50 text-emerald-200 border border-emerald-500/40"
              }`}
              style={{ width: "80%" }}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                80% Advance Tranche
              </span>
              <span>₹{(advanceAmount / 100000).toFixed(2)} Lakhs</span>
            </div>

            {/* 20% Retention Tranche */}
            <div
              className="h-full rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 flex items-center justify-between px-3 font-mono text-xs font-bold"
              style={{ width: "20%" }}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">20% Retention</span>
              </span>
              <span>₹{(retentionAmount / 100000).toFixed(2)}L</span>
            </div>
          </div>

          <div className="flex justify-between text-[11px] text-slate-400 px-1 font-mono">
            <span className="text-emerald-400 font-semibold">
              Condition: Verified Melt Proof (SCADA VFD + GST E-Way Bill)
            </span>
            <span className="text-amber-400 font-semibold">
              Condition: Form-1 Acceptance & Credit Transfer on CPCB Portal
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Box 1: Advance Details */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Advance Escrow (80%)</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {approved ? "RELEASED TO RECYCLER" : "HELD IN ESCROW"}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Triggered automatically when the TypeSafe Jev System 1 Reflex confirms authentic polymer melting with confidence score ≥ 85% and weighbridge delta within ±2%.
            </p>
            <div className="text-xs font-mono space-y-1 text-slate-400 border-t border-slate-800/80 pt-2">
              <div className="flex justify-between">
                <span>SAP PO Number:</span>
                <span className="text-white">PO-2026-901</span>
              </div>
              <div className="flex justify-between">
                <span>Beneficiary Recycler:</span>
                <span className="text-white">EcoPlast Recyclers Ltd</span>
              </div>
            </div>
          </div>

          {/* Box 2: Retention Details */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Retention Escrow (20%)</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PENDING CPCB ACK
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Protects against certificate revocations by CPCB. Released strictly upon generation of final Form-1 receipt and official portal acknowledgment.
            </p>
            <div className="text-xs font-mono space-y-1 text-slate-400 border-t border-slate-800/80 pt-2">
              <div className="flex justify-between">
                <span>Escrow Smart Account:</span>
                <span className="text-white">ESCROW-HDFC-9921</span>
              </div>
              <div className="flex justify-between">
                <span>Auto-Release Trigger:</span>
                <span className="text-amber-300">CPCB_ACCEPTED status</span>
              </div>
            </div>
          </div>
        </div>

        {/* HITL Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <UserCheck className="w-4 h-4 text-indigo-400" />
            <span>Human-in-the-Loop review enforced for high-value tranches (&gt;₹10L)</span>
          </div>

          <button
            onClick={() => setShowApprovalModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Authorizing Signature Gate (HITL)</span>
          </button>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0b1021] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Authorize 80% Advance Escrow Release</h3>
              </div>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                You are about to sign off on releasing <strong>₹{(advanceAmount / 100000).toFixed(2)} Lakhs</strong> (80% of PO-2026-901) to <strong>EcoPlast Recyclers Ltd</strong>.
              </p>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Audit Verification:</span>
                  <span className="text-emerald-400 font-bold">APPROVED (Jev System 1: 96.5%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Audit Proof Hash:</span>
                  <span className="text-slate-300 truncate max-w-[200px]">e3b0c44298fc1c14...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Approver DN:</span>
                  <span className="text-slate-300">CN=Compliance Officer, C=IN</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
              >
                {isApproving ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing DSC Token...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Sign Escrow Release</span>
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
