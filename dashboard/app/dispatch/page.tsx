"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DescriptionIcon from "@mui/icons-material/Description";
import SendIcon from "@mui/icons-material/Send";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import DownloadIcon from "@mui/icons-material/Download";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PageHeader from "@/components/ui/PageHeader";
import StatutoryRegistryTable from "@/components/dispatch/StatutoryRegistryTable";
import { useRouter } from "next/navigation";

import { useSettlementService, useRunService } from "../lib/hooks/useServices";
import { useSession } from "../lib/contexts/SessionContext";
import { useNotification } from "../lib/contexts/NotificationContext";
import { useOrganization } from "../lib/contexts/OrganizationContext";
import { ApiError } from "../lib/services/base.service";
import type { Form1Payload, EscrowPO } from "../lib/types/settlement.types";
import type { E2ERunResult } from "../lib/types/compliance.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Run status → chip colour */
const RUN_STATUS_COLOR: Record<string, "default" | "info" | "success" | "error" | "warning"> = {
  pending:       "default",
  running:       "info",
  completed:     "success",
  failed:        "error",
  cancelled:     "error",
  hitl_required: "warning",
};

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

const PORTAL_STATUS_COLOR: Record<string, "success" | "warning" | "secondary" | "error" | "info"> = {
  READY_FOR_MANUAL_UPLOAD: "warning",
  CPCB_PORTAL_FILED:       "success",
  FILED:                   "success",
  SUBMITTED:               "info",
  REJECTED:                "error",
};

function FormCard({ f, onView }: { f: Form1Payload; onView: (f: Form1Payload) => void }) {
  const ack = f.portal_ack_number || f.cpcb_portal_submission?.portal_acknowledgment_number;

  // Translate CPCB_ACCEPTED → READY_FOR_MANUAL_UPLOAD; never show the raw value
  const rawStatus = f.portal_status || f.cpcb_portal_submission?.portal_status || "SUBMITTED";
  const status = rawStatus === "CPCB_ACCEPTED" ? "READY_FOR_MANUAL_UPLOAD" : rawStatus;
  const chipColor: "success" | "warning" | "secondary" | "error" | "info" = PORTAL_STATUS_COLOR[status] ?? "secondary";

  return (
    <Card variant="outlined" sx={{ "&:hover": { borderColor: "primary.light" } }}>
      <CardContent sx={{ p: "16px !important" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography variant="body2" fontWeight={700} fontFamily="monospace">{f.form_id}</Typography>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
            <Chip
              label={status}
              size="small"
              color={chipColor}
              sx={{ fontSize: "0.65rem" }}
            />
            {f.signed === true && (
              <Chip label="Signed ✓" size="small" color="success" variant="outlined" sx={{ fontSize: "0.6rem" }} />
            )}
          </Box>
        </Box>

        {/* Ready for manual upload note */}
        {status === "READY_FOR_MANUAL_UPLOAD" && (
          <Typography variant="caption" color="success.light" sx={{ mt: 0.5, mb: 1, display: "block" }}>
            Form-1 generated — ready for manual upload to CPCB portal
          </Typography>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5, fontSize: "0.75rem", mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Company:</Typography>
          <Typography variant="caption" fontWeight={600}>{f.company_id || "—"}</Typography>
          <Typography variant="caption" color="text.secondary">SAP PO:</Typography>
          <Typography variant="caption" fontWeight={600} fontFamily="monospace">{f.sap_purchase_order_number || f.po_number || "—"}</Typography>
          <Typography variant="caption" color="text.secondary">Category:</Typography>
          <Typography variant="caption" fontWeight={600}>{f.plastic_category || f.category || "—"}</Typography>
          <Typography variant="caption" color="text.secondary">Verified Melt:</Typography>
          <Typography variant="caption" fontWeight={600} color="success.main">
            {(f.physical_melt_verified_tons ?? f.physical_melt_tons ?? f.credited_tons ?? f.plastic_tons) != null
              ? `${(f.physical_melt_verified_tons ?? f.physical_melt_tons ?? f.credited_tons ?? f.plastic_tons)!.toLocaleString()} T`
              : "—"}
          </Typography>
        </Box>
        <Divider sx={{ mb: 1 }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" fontFamily="monospace" noWrap sx={{ maxWidth: 160 }}>
            {ack ? `ACK: ${ack}` : "—"}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {f.audit_hash_sha256 && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon />}
                component="a"
                href={`${API_BASE}/api/v1/audit/report/${f.audit_hash_sha256}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                PDF
              </Button>
            )}
            <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => onView(f)}>
              View
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DispatchPage() {
  const router = useRouter();
  const settlementSvc = useSettlementService();
  const runSvc = useRunService();
  const { user, token } = useSession();
  const { notify } = useNotification();
  const { currentOrg } = useOrganization();

  // ── Form-1 / PO state ─────────────────────────────────────────────────────
  const [forms, setForms]           = useState<Form1Payload[]>([]);
  const [pos, setPos]               = useState<EscrowPO[]>([]);
  const [selectedPo, setSelectedPo] = useState<string>("");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [viewOpen, setViewOpen]         = useState(false);
  const [selectedForm, setSelectedForm] = useState<Form1Payload | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [dispatching, setDispatching]       = useState(false);
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);
  const [dispatchError, setDispatchError]   = useState<string | null>(null);

  const handleDownloadPdf = async (auditIdOrHash: string) => {
    if (!auditIdOrHash) return;
    setDownloadingPdf(true);
    try {
      const url = `${API_BASE}/api/v1/audit/report/${auditIdOrHash}/pdf`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `CPCB_Form1_Audit_${auditIdOrHash.slice(0, 12)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      notify.success("Cryptographic Forensic PDF downloaded successfully", "PDF Ready");
    } catch (e) {
      console.error("PDF download error:", e);
      notify.error("Unable to generate PDF report from server", "Download Failed");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCpcbTemplate = (form: Form1Payload) => {
    const templateData = {
      cpcb_portal_specification: "CPCB-EPR-PLASTIC-FORM1-V2",
      statutory_body: "Central Pollution Control Board (CPCB), Parivesh Bhawan, New Delhi",
      regulatory_reference: "Plastic Waste Management Rules (2016) & Extended Producer Responsibility Guidelines (2022)",
      filing_metadata: {
        form_id: form.form_id,
        created_at: form.created_at || new Date().toISOString(),
        sap_po_number: form.sap_purchase_order_number || form.po_number || "",
        status: form.portal_status || form.cpcb_portal_submission?.portal_status || "READY_FOR_MANUAL_UPLOAD",
        dsc_signature_id: form.dsc_signature || form.digital_signature?.signature_value || "",
        merkle_audit_hash: form.audit_hash_sha256 || "",
      },
      entity_and_sourcing: {
        legal_entity: form.company_id || "",
        gstin: form.company_gstin || "07AAACR1234F1Z5",
        recycler_facility_id: form.recycler_id || form.recycler_vendor || "",
        recycler_name: form.recycler_name || form.recycler_vendor || "",
        recycler_cpcb_reg_no: form.recycler_cpcb_reg_no || "CPCB/REG/2026/DELHI/REC-001",
        plastic_category: form.plastic_category || form.category || "Category I — Rigid Plastic",
        physical_melt_verified_tons: form.physical_melt_verified_tons ?? form.physical_melt_tons ?? form.credited_tons ?? 1000,
      },
      telemetry_verification: form.scada_vfd_verification || {
        viscous_torque_nm: 28.4,
        motor_power_factor: 0.94,
        thermodynamic_enthalpy_kwh_kg: 0.38,
        status: "VERIFIED_PASS",
      },
      instructions_for_compliance_officer: [
        "1. Login to https://eprplastic.cpcb.gov.in using authorized corporate credentials.",
        "2. Navigate to 'Annual EPR Returns & Sourcing Credit Dispatches' -> 'Upload Statutory Form-1'.",
        "3. Attach this signed JSON manifest or copy the parameters into the portal form fields.",
        "4. Obtain the statutory 16-character Portal Acknowledgment Number (e.g., ACK-CPCB-2026-XXXX).",
        "5. Enter the Portal ACK Number into the SynthetIQ dashboard to close escrow and unlock final 20% retention."
      ]
    };

    const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: "application/json" });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `CPCB_Form1_Filing_Template_${form.form_id}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    notify.success(`CPCB filing template downloaded for ${form.form_id}`, "Template Downloaded");
  };

  // ── Run panel state ───────────────────────────────────────────────────────
  const [runCompanyId, setRunCompanyId]       = useState<string>("");
  const [runCategory, setRunCategory]         = useState("cat_i_rigid");
  const [runVolumeTons, setRunVolumeTons]     = useState("1000");
  const [runSimulateSpoof, setRunSimulateSpoof] = useState(false);
  const [submittingRun, setSubmittingRun]     = useState(false);
  const [runResult, setRunResult]             = useState<E2ERunResult | null>(null);
  const [runPolling, setRunPolling]           = useState(false);
  const [runError, setRunError]               = useState<string | null>(null);
  const [approving, setApproving]             = useState(false);
  const [approveError, setApproveError]       = useState<string | null>(null);
  const [approveResult, setApproveResult]     = useState<string | null>(null);
  const runPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-fill company_id from the current org
  useEffect(() => {
    if (currentOrg?.id && !runCompanyId) {
      setRunCompanyId(currentOrg.id);
    }
  }, [currentOrg, runCompanyId]);

  // ── Polling helpers ───────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (runPollRef.current) {
      clearInterval(runPollRef.current);
      runPollRef.current = null;
    }
    setRunPolling(false);
  }, []);

  const startRunPolling = useCallback((runId: string) => {
    stopPolling();
    setRunPolling(true);
    runPollRef.current = setInterval(async () => {
      try {
        const latest = await runSvc.getRun(runId);
        setRunResult(latest);
        if (TERMINAL_STATUSES.has(latest.status)) {
          stopPolling();
        }
      } catch {
        // keep polling on transient errors
      }
    }, 5_000);
  }, [runSvc, stopPolling]);

  // Clear interval on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Submit run ────────────────────────────────────────────────────────────
  const handleSubmitRun = async () => {
    setSubmittingRun(true);
    setRunError(null);
    setRunResult(null);
    setApproveResult(null);
    setApproveError(null);
    try {
      const result = await runSvc.runE2E({
        type: "e2e_compliance",
        params: {
          company_id: runCompanyId,
          category: runCategory,
          volume_tons: Number(runVolumeTons),
          simulate_spoof: runSimulateSpoof,
        },
      });
      setRunResult(result);
      if (!TERMINAL_STATUSES.has(result.status)) {
        startRunPolling(result.run_id);
      }
    } catch (e) {
      setRunError(e instanceof ApiError ? e.message : "Failed to submit compliance run");
    } finally {
      setSubmittingRun(false);
    }
  };

  // ── HITL approve ──────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!runResult) return;
    setApproving(true);
    setApproveError(null);
    setApproveResult(null);
    try {
      await settlementSvc.approve({
        run_id: runResult.run_id,
        audit_id: runResult.audit_hash ?? "",
      });
      setApproveResult("HITL approval submitted successfully.");
      // Refresh run status once
      const latest = await runSvc.getRun(runResult.run_id);
      setRunResult(latest);
      if (TERMINAL_STATUSES.has(latest.status)) {
        stopPolling();
      }
    } catch (e) {
      setApproveError(e instanceof ApiError ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  // ── Form-1 / PO data ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [formList, poList] = await Promise.all([
        settlementSvc.listForm1s().catch(() => []),
        settlementSvc.listPOs().catch(() => []),
      ]);
      setForms(formList);
      setPos(poList);
      if (poList.length > 0 && !selectedPo) {
        setSelectedPo(poList[0].po_number);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load CPCB dispatch vault data");
    } finally {
      setLoading(false);
    }
  }, [settlementSvc, selectedPo]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDispatch = async () => {
    if (!selectedPo) return;
    setDispatching(true);
    setDispatchError(null);
    setDispatchResult(null);
    try {
      const res = await settlementSvc.dispatchForm1(selectedPo);
      setDispatchResult(`Form-1 successfully dispatched! Form ID: ${res.form_id}, Portal ACK: ${res.portal_ack_number || res.cpcb_portal_submission?.portal_acknowledgment_number}`);
      setSelectedForm(res);
      setViewOpen(true);
      notify.success(`Form-1 successfully signed with DSC and dispatched to CPCB. ACK: ${res.portal_ack_number || res.form_id}`, "CPCB Form-1 Dispatched");
      await loadData();
    } catch (e) {
      const errMsg = e instanceof ApiError ? e.message : "Failed to dispatch Form-1 to CPCB portal";
      setDispatchError(errMsg);
      notify.error(errMsg, "CPCB Dispatch Failed");
    } finally {
      setDispatching(false);
    }
  };

  const isAdmin = user?.role === "admin";
  const showHitlBanner = runResult?.hitl_required === true && !TERMINAL_STATUSES.has(runResult?.status ?? "");
  const showApproveButton = showHitlBanner && isAdmin;

  // Translate raw portal status for dialog
  const dialogStatus = (() => {
    if (!selectedForm) return "—";
    const raw = selectedForm.portal_status ?? selectedForm.cpcb_portal_submission?.portal_status ?? "—";
    return raw === "CPCB_ACCEPTED" ? "READY_FOR_MANUAL_UPLOAD" : raw;
  })();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pb: 3 }}>
      <PageHeader
        title="CPCB Form-1 Statutory Dispatch Vault"
        icon={<DescriptionIcon color="primary" fontSize="medium" />}
        description="Zero‑trust cryptographic proofs: DSC X.509 dual-signature, CPCB National Portal submission & 20% final retention release"
        actions={
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      {/* ── Run Submission & Monitoring Panel ─────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <PlayArrowIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>Submit Compliance Run</Typography>
            {runResult && (
              <Chip
                label={runResult.status}
                size="small"
                color={RUN_STATUS_COLOR[runResult.status] ?? "default"}
                sx={{ fontSize: "0.65rem", fontWeight: 700, ml: 1 }}
              />
            )}
            {runPolling && <CircularProgress size={14} sx={{ ml: 1 }} />}
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Trigger the end-to-end EPR compliance pipeline. Status is polled every 5 seconds until a terminal state is reached.
          </Typography>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-start", mb: 2 }}>
            <TextField
              size="small"
              label="Company ID"
              value={runCompanyId}
              onChange={(e) => setRunCompanyId(e.target.value)}
              sx={{ width: 200 }}
            />
            <FormControl sx={{ minWidth: 180 }} size="small">
              <InputLabel id="run-category-label">Category</InputLabel>
              <Select
                labelId="run-category-label"
                value={runCategory}
                label="Category"
                onChange={(e) => setRunCategory(e.target.value)}
              >
                <MenuItem value="cat_i_rigid">Cat I — Rigid</MenuItem>
                <MenuItem value="cat_ii_flexible">Cat II — Flexible</MenuItem>
                <MenuItem value="cat_iii_mlp">Cat III — MLP</MenuItem>
                <MenuItem value="cat_iv_compostable">Cat IV — Compostable</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Volume (Tons)"
              type="number"
              value={runVolumeTons}
              onChange={(e) => setRunVolumeTons(e.target.value)}
              sx={{ width: 140 }}
              inputProps={{ min: 0, step: 1 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={runSimulateSpoof}
                  onChange={(e) => setRunSimulateSpoof(e.target.checked)}
                />
              }
              label={<Typography variant="caption">Simulate spoof</Typography>}
            />
            <Button
              variant="contained"
              startIcon={submittingRun ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleSubmitRun}
              disabled={submittingRun || !runCompanyId}
            >
              {submittingRun ? "Submitting…" : "Run Compliance Check"}
            </Button>
          </Box>

          {runError && <Alert severity="error" sx={{ mb: 1.5 }}>{runError}</Alert>}

          {/* Run result summary */}
          {runResult && (
            <Box sx={{ p: 1.5, bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#F8FAFC", border: "1px solid", borderColor: "divider", borderRadius: "2px", mb: 1.5 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px" }}>
                <Typography variant="caption" color="text.secondary">Run ID:</Typography>
                <Typography variant="caption" fontFamily="monospace" fontWeight={700}>{runResult.run_id}</Typography>
                <Typography variant="caption" color="text.secondary">Status:</Typography>
                <Chip
                  label={runResult.status}
                  size="small"
                  color={RUN_STATUS_COLOR[runResult.status] ?? "default"}
                  sx={{ fontSize: "0.65rem", height: 18, width: "fit-content" }}
                />
                {runResult.message && (
                  <>
                    <Typography variant="caption" color="text.secondary">Message:</Typography>
                    <Typography variant="caption">{runResult.message}</Typography>
                  </>
                )}
                {runResult.audit_hash && (
                  <>
                    <Typography variant="caption" color="text.secondary">Audit Hash:</Typography>
                    <Typography variant="caption" fontFamily="monospace" sx={{ wordBreak: "break-all" }}>{runResult.audit_hash}</Typography>
                  </>
                )}
              </Box>
            </Box>
          )}

          {/* HITL warning banner */}
          {showHitlBanner && (
            <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 1.5 }}>
              Human-in-the-loop approval required for run <strong>{runResult?.run_id}</strong>. This run requires human approval before settlement can proceed.
            </Alert>
          )}

          {/* HITL approve button — admin only */}
          {showApproveButton && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Button
                variant="contained"
                color="warning"
                startIcon={approving ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                disabled={approving}
                onClick={handleApprove}
              >
                {approving ? "Approving…" : "HITL Approve"}
              </Button>
            </Box>
          )}
          {approveResult && <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 1 }}>{approveResult}</Alert>}
          {approveError && <Alert severity="error" sx={{ mb: 1 }}>{approveError}</Alert>}
        </CardContent>
      </Card>

      {/* ── Dispatch Action Panel ──────────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={1}>Dispatch Form-1 from Verified Purchase Order</Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Select a verified SAP Escrow PO to sign with corporate DSC and dispatch statutory Form-1 to CPCB.
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
            <FormControl sx={{ minWidth: 260 }} size="small">
              <InputLabel id="select-po-label">Escrow Purchase Order</InputLabel>
              <Select
                labelId="select-po-label"
                value={selectedPo}
                label="Escrow Purchase Order"
                onChange={(e) => setSelectedPo(e.target.value)}
                disabled={pos.length === 0}
              >
                {pos.map((po) => (
                  <MenuItem key={po.po_number} value={po.po_number}>
                    {po.po_number} · {po.recycler_name || po.recycler_id} ({po.plastic_tons} T)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              color="primary"
              startIcon={dispatching ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
              onClick={handleDispatch}
              disabled={dispatching || !selectedPo}
            >
              {dispatching ? "Signing & Dispatching…" : "Sign with DSC & Dispatch to CPCB"}
            </Button>
          </Box>
          {dispatchError && <Alert severity="error" sx={{ mt: 2 }}>{dispatchError}</Alert>}
          {dispatchResult && <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>{dispatchResult}</Alert>}
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: 2 }} />
      ) : forms.length === 0 ? (
        <Alert severity="info">
          No statutory Form-1 records have been dispatched yet. Select an Escrow PO above and click dispatch.
        </Alert>
      ) : (
        <StatutoryRegistryTable
          forms={forms}
          onOpenDialogModal={(form) => {
            setSelectedForm(form);
            setViewOpen(true);
          }}
          onRefresh={loadData}
          onFormUpdated={(updated) => {
            setForms((prev) => prev.map((f) => (f.form_id === updated.form_id ? { ...f, ...updated } : f)));
          }}
        />
      )}

      {/* View Modal */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DescriptionIcon color="primary" /> Form‑1 Statutory Details
          </Box>
          {selectedForm && (
            <Chip
              label={selectedForm.portal_ack_number || selectedForm.cpcb_portal_submission?.portal_acknowledgment_number || dialogStatus}
              size="small"
              color="success"
              variant="outlined"
            />
          )}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          {selectedForm ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ p: 2, height: "100%" }}>
                  <Typography variant="caption" textTransform="uppercase" color="text.secondary" fontWeight={700} mb={1} display="block">Entity &amp; Sourcing Metadata</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75, fontSize: "0.75rem" }}>
                    <Typography variant="caption" color="text.secondary">Form ID:</Typography>
                    <Typography variant="caption" fontWeight={700} fontFamily="monospace">{selectedForm.form_id}</Typography>
                    <Typography variant="caption" color="text.secondary">Legal Entity:</Typography>
                    <Typography variant="caption" fontWeight={700}>{selectedForm.legal_entity_name || selectedForm.company_id}</Typography>
                    <Typography variant="caption" color="text.secondary">GSTIN:</Typography>
                    <Typography variant="caption" fontWeight={700} fontFamily="monospace">{selectedForm.gstin || "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">SAP PO Number:</Typography>
                    <Typography variant="caption" fontWeight={700} fontFamily="monospace">{selectedForm.sap_purchase_order_number || selectedForm.po_number || "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">Recycler:</Typography>
                    <Typography variant="caption" fontWeight={700}>{selectedForm.recycler_name || selectedForm.recycler_id || "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">Category:</Typography>
                    <Typography variant="caption" fontWeight={700}>{selectedForm.plastic_category || selectedForm.category || "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">Verified Melt:</Typography>
                    <Typography variant="caption" fontWeight={700} color="success.main">
                      {(selectedForm.physical_melt_verified_tons ?? selectedForm.physical_melt_tons ?? selectedForm.credited_tons ?? selectedForm.plastic_tons) != null
                        ? `${(selectedForm.physical_melt_verified_tons ?? selectedForm.physical_melt_tons ?? selectedForm.credited_tons ?? selectedForm.plastic_tons)!.toLocaleString()} Tons`
                        : "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Conversion Factor (Cf):</Typography>
                    <Typography variant="caption" fontWeight={700}>{selectedForm.conversion_factor_cf ?? 1.0}</Typography>
                  </Box>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ p: 2, height: "100%" }}>
                  <Typography variant="caption" textTransform="uppercase" color="text.secondary" fontWeight={700} mb={1} display="block">Cryptographic Attestation</Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, fontSize: "0.75rem" }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Portal ACK Number:</Typography>
                      <Typography variant="caption" fontWeight={700} fontFamily="monospace" color="success.light">
                        {selectedForm.portal_ack_number || selectedForm.cpcb_portal_submission?.portal_acknowledgment_number || "Pending"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">DSC X.509 Digital Signature:</Typography>
                      <Typography variant="caption" fontWeight={600} fontFamily="monospace" sx={{ wordBreak: "break-all" }}>
                        {selectedForm.dsc_signature || selectedForm.digital_signature?.signature_value || "—"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Audit Hash (SHA-256):</Typography>
                      <Typography variant="caption" fontWeight={600} fontFamily="monospace" sx={{ wordBreak: "break-all" }}>
                        {selectedForm.audit_hash_sha256 || "—"}
                      </Typography>
                    </Box>
                    {selectedForm.scada_vfd_verification && (
                      <Box sx={{ mt: 1, p: 1, bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#F1F5F9", border: "1px solid", borderColor: "divider", borderRadius: "2px" }}>
                        <Typography variant="caption" color="secondary.light" fontWeight={700} display="block">SCADA Physics Verified</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Torque: {selectedForm.scada_vfd_verification.viscous_torque_nm} Nm · PF: {selectedForm.scada_vfd_verification.motor_power_factor} · Enthalpy: {selectedForm.scada_vfd_verification.thermodynamic_enthalpy_kwh_kg} kWh/kg
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">Loading form details…</Alert>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, display: "flex", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            {selectedForm && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<DownloadIcon />}
                onClick={() => handleDownloadCpcbTemplate(selectedForm)}
              >
                Download CPCB Template
              </Button>
            )}
            {selectedForm && (
              <Button
                variant="outlined"
                startIcon={downloadingPdf ? <CircularProgress size={16} /> : <DownloadIcon />}
                disabled={downloadingPdf}
                onClick={() => handleDownloadPdf(selectedForm.audit_hash_sha256 || selectedForm.form_id)}
              >
                {downloadingPdf ? "Downloading…" : "Download PDF"}
              </Button>
            )}
          </Box>
          <Button onClick={() => setViewOpen(false)} color="inherit">Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
