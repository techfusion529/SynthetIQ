"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCheck2,
  FileCode,
  FileText,
  Key,
  Layers,
  Lock,
  Send,
  Shield,
  ShieldCheck,
} from "lucide-react";

const SAMPLE_FORM1_JSON = {
  form_id: "FORM1-CPCB-2026-881A",
  company_id: "COMP-IN-001",
  legal_entity_name: "Hindustan Consumer Goods Ltd",
  gstin: "27AAACH1234F1Z5",
  fiscal_year: "FY2026-27",
  recycler_id: "RECYC-DELHI-01",
  recycler_name: "EcoMelt Solutions Ltd",
  plant_id: "PLANT-OKHLA-2",
  plastic_category: "cat_i_rigid",
  physical_melt_verified_tons: 250.0,
  conversion_factor_cf: 1.0,
  credited_compliance_tons: 250.0,
  sap_purchase_order_number: "PO-2026-901",
  audit_hash_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  scada_vfd_verification: {
    viscous_torque_nm: 57.7,
    motor_power_factor: 0.871,
    thermodynamic_enthalpy_kwh_kg: 0.38,
    system1_reflex_status: "APPROVED"
  },
  statutory_declaration: "I hereby certify under penalty of perjury that the plastic compliance credits reported herein are backed by physical mechanical melting verified through SCADA electrical telemetry.",
  digital_signature: {
    algorithm: "SHA256withRSA",
    signer_dn: "CN=Compliance Officer, O=Hindustan Consumer Goods Ltd, ST=Maharashtra, C=IN",
    certificate_serial: "CERT-2026-X509-88102",
    signature_value: "DSC_SIG_48F19B8C7E2A91F0C99B88019FA82C10",
    timestamp: "2026-09-29T11:28:40Z"
  },
  cpcb_portal_submission: {
    portal_status: "ACCEPTED",
    portal_acknowledgment_number: "ACK-CPCB-2026-X491B8",
    submitted_at: "2026-09-29T11:28:42Z"
  }
};

export default function DispatchForm1Page() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(SAMPLE_FORM1_JSON, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-slate-200">Executive Hub</Link>
            <span>/</span>
            <span className="text-indigo-400 font-medium">Statutory Compliance Vault</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-indigo-400" />
            Statutory Form-1 & CPCB Certificate Vault
          </h2>
          <p className="text-sm text-slate-400">
            Cryptographically sealed Form-1 filing, X.509 Digital Signature (DSC) validation, and national portal receipt
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start font-mono text-xs">
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            CPCB ACCEPTED: ACK-CPCB-2026-X491B8
          </span>
        </div>
      </div>

      {/* Grid: DSC Certificate Card & Dispatch Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DSC Inspector */}
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              Digital Signature Certificate (DSC) Inspector
            </h3>
            <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/20">
              X.509 Valid
            </span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-slate-400 font-sans">Authorized Signatory DN</span>
              <p className="text-slate-100 font-bold break-all">
                CN=Compliance Officer, O=Hindustan Consumer Goods Ltd, ST=Maharashtra, C=IN
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-sans">Cryptographic Algorithm</span>
                <p className="text-indigo-300 font-bold">SHA256withRSA (2048-bit)</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-sans">DSC Token Serial</span>
                <p className="text-white font-bold">CERT-2026-X509-88102</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-slate-400 font-sans">Signature Hex Digest</span>
              <p className="text-emerald-400 font-bold break-all">
                DSC_SIG_48F19B8C7E2A91F0C99B88019FA82C10
              </p>
            </div>
          </div>
        </div>

        {/* Portal Dispatch Receipt Card */}
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              CPCB National Portal Dispatch Status
            </h3>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20">
              HTTP 200 OK
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <p className="font-semibold text-slate-200">Form-1 Payload Serialized & Signed</p>
                <p className="text-slate-400 text-[11px]">Applied conversion factor Cf = 1.0 (Cat-I Rigid Mechanical).</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <p className="font-semibold text-slate-200">Temporal Retry & Backoff Gateway Passed</p>
                <p className="text-slate-400 text-[11px]">Survives government portal API throttling and scheduled maintenance.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <p className="font-semibold text-emerald-400">National Credit Ledger Updated</p>
                <p className="text-slate-400 text-[11px]">Official statutory receipt: <strong>ACK-CPCB-2026-X491B8</strong>.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* JSON Viewer Card */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white font-mono">
              Form-1 Canonical Statutory Filing Payload
            </h3>
          </div>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy JSON</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-[#030712] border border-slate-800/80 font-mono text-xs text-indigo-200 overflow-x-auto leading-relaxed max-h-96">
          {JSON.stringify(SAMPLE_FORM1_JSON, null, 2)}
        </pre>
      </div>
    </div>
  );
}
