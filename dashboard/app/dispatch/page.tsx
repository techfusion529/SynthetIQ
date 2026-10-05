"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import DescriptionIcon from "@mui/icons-material/Description";
import SendIcon from "@mui/icons-material/Send";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useRouter } from "next/navigation";

import { useSettlementService } from "../lib/hooks/useServices";
import { ApiError } from "../lib/services/base.service";
import type { Form1Payload, EscrowPO } from "../lib/types/settlement.types";

function FormCard({ f, onView }: { f: Form1Payload; onView: (f: Form1Payload) => void }) {
  const ack = f.portal_ack_number || f.cpcb_portal_submission?.portal_acknowledgment_number;
  const status = f.portal_status || f.cpcb_portal_submission?.portal_status || "SUBMITTED";

  return (
    <Card variant="outlined" sx={{ "&:hover": { borderColor: "primary.light" } }}>
      <CardContent sx={{ p: "16px !important" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography variant="body2" fontWeight={700} fontFamily="monospace">{f.form_id}</Typography>
          <Chip
            label={status}
            size="small"
            color={status.includes("ACCEPTED") ? "success" : "secondary"}
            sx={{ fontSize: "0.65rem" }}
          />
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5, fontSize: "0.75rem", mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Company:</Typography>
          <Typography variant="caption" fontWeight={600}>{f.company_id || "—"}</Typography>
          <Typography variant="caption" color="text.secondary">SAP PO:</Typography>
          <Typography variant="caption" fontWeight={600} fontFamily="monospace">{f.sap_purchase_order_number || "—"}</Typography>
          <Typography variant="caption" color="text.secondary">Category:</Typography>
          <Typography variant="caption" fontWeight={600}>{f.plastic_category || "—"}</Typography>
          <Typography variant="caption" color="text.secondary">Verified Melt:</Typography>
          <Typography variant="caption" fontWeight={600} color="success.main">{f.physical_melt_verified_tons?.toLocaleString()} T</Typography>
        </Box>
        <Divider sx={{ mb: 1 }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="caption" color="text.secondary" fontFamily="monospace" noWrap sx={{ maxWidth: 160 }}>
            {ack ? `ACK: ${ack}` : "—"}
          </Typography>
          <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => onView(f)}>
            View
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DispatchPage() {
  const router = useRouter();
  const settlementSvc = useSettlementService();

  const [forms, setForms]           = useState<Form1Payload[]>([]);
  const [pos, setPos]               = useState<EscrowPO[]>([]);
  const [selectedPo, setSelectedPo] = useState<string>("");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [viewOpen, setViewOpen]     = useState(false);
  const [selectedForm, setSelectedForm] = useState<Form1Payload | null>(null);

  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);
  const [dispatchError, setDispatchError]   = useState<string | null>(null);

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
      await loadData();
    } catch (e) {
      setDispatchError(e instanceof ApiError ? e.message : "Failed to dispatch Form-1 to CPCB portal");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <Breadcrumbs>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/")}>Executive Hub</Link>
        <Typography color="primary.light" fontWeight={600}>Form‑1 Vault — CPCB Dispatch</Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DescriptionIcon color="primary" /> CPCB Form-1 Statutory Dispatch Vault
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Zero‑trust cryptographic proofs: DSC X.509 dual-signature, CPCB National Portal submission & 20% final retention release
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Dispatch Action Panel */}
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
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rounded" height={160} />
            </Grid>
          ))}
        </Grid>
      ) : forms.length === 0 ? (
        <Alert severity="info">
          No statutory Form-1 records have been dispatched yet. Select an Escrow PO above and click dispatch.
        </Alert>
      ) : (
        <>
          <Typography variant="subtitle1" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DescriptionIcon fontSize="small" /> Statutory CPCB Form‑1 Registry ({forms.length})
          </Typography>
          <Grid container spacing={2}>
            {forms.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.form_id}>
                <FormCard f={f} onView={(form) => { setSelectedForm(form); setViewOpen(true); }} />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* View Modal */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DescriptionIcon color="primary" /> Form‑1 Statutory Details
          </Box>
          {selectedForm && (
            <Chip
              label={selectedForm.portal_ack_number || selectedForm.cpcb_portal_submission?.portal_acknowledgment_number || "ACCEPTED"}
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
                  <Typography variant="caption" textTransform="uppercase" color="text.secondary" fontWeight={700} mb={1} display="block">Entity & Sourcing Metadata</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75, fontSize: "0.75rem" }}>
                    <Typography variant="caption" color="text.secondary">Form ID:</Typography>
                    <Typography variant="caption" fontWeight={700} fontFamily="monospace">{selectedForm.form_id}</Typography>
                    <Typography variant="caption" color="text.secondary">Legal Entity:</Typography>
                    <Typography variant="caption" fontWeight={700}>{selectedForm.legal_entity_name || selectedForm.company_id}</Typography>
                    <Typography variant="caption" color="text.secondary">GSTIN:</Typography>
                    <Typography variant="caption" fontWeight={700} fontFamily="monospace">{selectedForm.gstin || "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">SAP PO Number:</Typography>
                    <Typography variant="caption" fontWeight={700} fontFamily="monospace">{selectedForm.sap_purchase_order_number || "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">Recycler:</Typography>
                    <Typography variant="caption" fontWeight={700}>{selectedForm.recycler_name || selectedForm.recycler_id}</Typography>
                    <Typography variant="caption" color="text.secondary">Category:</Typography>
                    <Typography variant="caption" fontWeight={700}>{selectedForm.plastic_category}</Typography>
                    <Typography variant="caption" color="text.secondary">Verified Melt:</Typography>
                    <Typography variant="caption" fontWeight={700} color="success.main">{selectedForm.physical_melt_verified_tons} Tons</Typography>
                    <Typography variant="caption" color="text.secondary">Conversion Factor (Cf):</Typography>
                    <Typography variant="caption" fontWeight={700}>{selectedForm.conversion_factor_cf || 1.0}</Typography>
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
                      <Box sx={{ mt: 1, p: 1, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 1 }}>
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
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setViewOpen(false)} color="inherit">Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
