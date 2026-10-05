"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import LinearProgress from "@mui/material/LinearProgress";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ShieldIcon from "@mui/icons-material/Shield";

import { useSettlementService } from "../lib/hooks/useServices";
import { ApiError } from "../lib/services/base.service";
import type { EscrowPO } from "../lib/types/settlement.types";

const fmt = (n: number | undefined) =>
  n != null ? `₹${(n / 100000).toFixed(2)} Lakhs` : "—";

export default function SettlementPage() {
  const router = useRouter();
  const settlementSvc = useSettlementService();

  const [pos, setPos]         = useState<EscrowPO[]>([]);
  const [activePO, setActivePO] = useState<EscrowPO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [approveOpen, setApproveOpen]   = useState(false);
  const [approving, setApproving]       = useState(false);
  const [approveResult, setApproveResult] = useState<string | null>(null);
  const [approveError, setApproveError]   = useState<string | null>(null);

  // ── fetch PO list ────────────────────────────────────────────────────────
  const fetchPOs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await settlementSvc.listPOs();
      setPos(list);
      if (list.length > 0) {
        // Fetch full PO detail for the first item
        const detail = await settlementSvc.getPO(list[0].po_number);
        setActivePO(detail);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }, [settlementSvc]);

  useEffect(() => { fetchPOs(); }, [fetchPOs]);

  // ── HITL approval ─────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!activePO?.audit_id) {
      setApproveError("Cannot approve PO without an associated audit_id.");
      return;
    }
    setApproving(true);
    setApproveError(null);
    try {
      const res = await settlementSvc.approve({ audit_id: activePO.audit_id, action: "APPROVE" });
      setApproveResult(`Approved by ${res.approved_by}. 80% advance released in ERP.`);
      setApproveOpen(false);
      fetchPOs();
    } catch (e) {
      setApproveError(e instanceof ApiError ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  // ── derived values — all from API, no hardcoded amounts ──────────────────
  const total    = activePO?.total_amount_inr;
  const advance  = activePO?.advance_amount_inr;
  const retention = activePO?.retention_amount_inr;
  const advancePct  = total && advance   ? Math.round((advance / total) * 100) : null;
  const retentionPct = total && retention ? Math.round((retention / total) * 100) : null;

  const STEPS = ["Jev Melt Proof", "80% Advance Released", "Form-1 Dispatched", "20% Retention Released"];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <Breadcrumbs>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/")}>Executive Hub</Link>
        <Typography color="success.light" fontWeight={600}>Workflow 4 — Settlement & Escrow</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AccountBalanceWalletIcon color="success" /> Financial Settlement & 80/20 Escrow Gate
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Split-Payment Escrow PO in SAP/Oracle: 80% advance on physical melt proof, 20% retention until CPCB acceptance
          </Typography>
        </Box>
        <Button variant="contained" color="success" endIcon={<ArrowForwardIcon />} onClick={() => router.push("/dispatch")}>
          View CPCB Form-1 Vault
        </Button>
      </Box>

      {error    && <Alert severity="error">{error}</Alert>}
      {approveResult && <Alert severity="success" icon={<CheckCircleIcon />}>{approveResult}</Alert>}

      {loading ? (
        <>
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={200} />
        </>
      ) : pos.length === 0 ? (
        <Alert severity="info">No escrow purchase orders found.</Alert>
      ) : (
        <>
          {/* PO selector chips */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {pos.map((p) => (
              <Chip
                key={p.po_number}
                label={`${p.po_number} · ${p.status}`}
                onClick={async () => { const d = await settlementSvc.getPO(p.po_number); setActivePO(d); }}
                color={activePO?.po_number === p.po_number ? "success" : "default"}
                variant={activePO?.po_number === p.po_number ? "filled" : "outlined"}
                size="small"
              />
            ))}
          </Box>

          {/* Settlement Stepper */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Settlement Pipeline</Typography>
              <Stepper alternativeLabel activeStep={activePO?.status === "advance_released" ? 2 : 1}>
                {STEPS.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>

          {/* 80/20 Split Visualizer */}
          {activePO && (
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AccountBalanceWalletIcon color="success" fontSize="small" /> 80/20 Split-Payment Escrow Structure
                  </Typography>
                  <Typography variant="body1" fontWeight={700} fontFamily="monospace" color="success.main">
                    Total: {fmt(total)}
                  </Typography>
                </Box>

                {/* Visual split bar */}
                <Box sx={{ display: "flex", height: 48, borderRadius: 2, overflow: "hidden", gap: 0.5, p: 0.5, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid", borderColor: "divider" }}>
                  <Box sx={{ width: `${advancePct ?? 80}%`, bgcolor: "success.dark", borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", px: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CheckCircleIcon fontSize="small" sx={{ color: "success.contrastText" }} />
                      <Typography variant="caption" fontWeight={700} color="success.contrastText">{advancePct ?? 80}% Advance</Typography>
                    </Box>
                    <Typography variant="caption" fontWeight={700} color="success.contrastText" fontFamily="monospace">{fmt(advance)}</Typography>
                  </Box>
                  <Box sx={{ width: `${retentionPct ?? 20}%`, bgcolor: "rgba(245,158,11,0.2)", border: "1px solid", borderColor: "warning.dark", borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, px: 1 }}>
                    <LockIcon fontSize="small" color="warning" />
                    <Typography variant="caption" fontWeight={700} color="warning.main" noWrap>{retentionPct ?? 20}%</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                  <Typography variant="caption" color="success.light" fontWeight={600}>Condition: Jev Melt Proof (SCADA VFD + GST E-Way Bill)</Typography>
                  <Typography variant="caption" color="warning.main" fontWeight={600}>Condition: Form-1 Acceptance & CPCB ACK</Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* PO details grid */}
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                        <Typography variant="caption" color="success.main" fontWeight={700} textTransform="uppercase">Advance Escrow ({advancePct ?? 80}%)</Typography>
                        <Chip label={activePO.status === "advance_released" ? "RELEASED" : "HELD"} size="small" color="success" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" mb={1.5}>
                        Released when Jev System 1 confirms authentic polymer melting with confidence ≥85%.
                      </Typography>
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5, fontSize: "0.75rem", fontFamily: "monospace" }}>
                        <Typography variant="caption" color="text.secondary">SAP PO:</Typography>
                        <Typography variant="caption" color="text.primary" fontWeight={600}>{activePO.sap_purchase_order_number ?? activePO.po_number}</Typography>
                        <Typography variant="caption" color="text.secondary">Beneficiary:</Typography>
                        <Typography variant="caption" color="text.primary" fontWeight={600}>{activePO.recycler_name ?? activePO.recycler_id}</Typography>
                        <Typography variant="caption" color="text.secondary">Volume:</Typography>
                        <Typography variant="caption" color="text.primary">{activePO.plastic_tons?.toLocaleString()} T</Typography>
                      </Box>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                        <Typography variant="caption" color="warning.main" fontWeight={700} textTransform="uppercase">Retention Escrow ({retentionPct ?? 20}%)</Typography>
                        <Chip label="PENDING CPCB ACK" size="small" color="warning" variant="outlined" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" mb={1.5}>
                        Released on Form-1 acceptance and official portal acknowledgment.
                      </Typography>
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5, fontSize: "0.75rem", fontFamily: "monospace" }}>
                        <Typography variant="caption" color="text.secondary">Escrow Account:</Typography>
                        <Typography variant="caption" color="text.primary" fontWeight={600}>{activePO.escrow_account ?? "—"}</Typography>
                        <Typography variant="caption" color="text.secondary">ERP Sync:</Typography>
                        <Typography variant="caption" color="text.primary">{activePO.sap_sync_status ?? "—"}</Typography>
                        <Typography variant="caption" color="text.secondary">Retention:</Typography>
                        <Typography variant="caption" color="warning.main" fontWeight={600}>{fmt(retention)}</Typography>
                      </Box>
                    </Card>
                  </Grid>
                </Grid>

                {/* HITL action */}
                <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <HowToRegIcon color="primary" fontSize="small" />
                    <Typography variant="caption" color="text.secondary">Human-in-the-Loop review enforced for high-value tranches (&gt;₹10L)</Typography>
                  </Box>
                  <Button
                    variant="contained" color="primary"
                    startIcon={<ShieldIcon />}
                    onClick={() => setApproveOpen(true)}
                  >
                    Authorize Escrow Release (HITL)
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* HITL Approval Modal */}
      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ShieldIcon color="primary" /> Authorize 80% Advance Escrow Release
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
          {approveError && <Alert severity="error">{approveError}</Alert>}
          <Typography variant="body2">
            You are signing off on releasing <strong>{fmt(advance)}</strong> ({advancePct ?? 80}% of {activePO?.po_number}) to <strong>{activePO?.recycler_name ?? activePO?.recycler_id}</strong>.
          </Typography>
          <Card variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 0.75, fontSize: "0.75rem", fontFamily: "monospace" }}>
              <Typography variant="caption" color="text.secondary">PO Number:</Typography>
              <Typography variant="caption" fontWeight={700}>{activePO?.po_number ?? "—"}</Typography>
              <Typography variant="caption" color="text.secondary">Audit ID:</Typography>
              <Typography variant="caption" fontWeight={700}>{activePO?.audit_id ?? "—"}</Typography>
              <Typography variant="caption" color="text.secondary">Total Contract:</Typography>
              <Typography variant="caption" fontWeight={700} color="success.main">{fmt(total)}</Typography>
              <Typography variant="caption" color="text.secondary">Advance 80%:</Typography>
              <Typography variant="caption" fontWeight={700}>{fmt(advance)}</Typography>
            </Box>
          </Card>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setApproveOpen(false)} color="inherit">Cancel</Button>
          <Button
            onClick={handleApprove} variant="contained" color="success"
            disabled={approving}
            startIcon={approving ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
          >
            {approving ? "Signing DSC Token…" : "Confirm & Sign Escrow Release"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
