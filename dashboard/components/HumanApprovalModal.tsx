"use client";

import React, { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useHitlService } from "../app/lib/hooks/useServices";
import { useSession } from "../app/lib/contexts/SessionContext";
import { useNotification } from "../app/lib/contexts/NotificationContext";
import { REASON_CODES, type HITLRunDetail } from "../app/lib/types/hitl.types";
import { ApiError } from "../app/lib/services/base.service";

interface HumanApprovalModalProps {
  open: boolean;
  runId: string | null;
  onClose: () => void;
  onResolved?: () => void;
}

export default function HumanApprovalModal({
  open,
  runId,
  onClose,
  onResolved,
}: HumanApprovalModalProps) {
  const hitlSvc = useHitlService();
  const { user } = useSession();
  const { notify } = useNotification();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<HITLRunDetail | null>(null);

  const [reasonCode, setReasonCode] = useState<string>(REASON_CODES[0]);
  const [overrideTons, setOverrideTons] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (!open || !runId) {
      setRunDetail(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    hitlSvc
      .getRun(runId)
      .then((data) => {
        setRunDetail(data);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Failed to load approval run details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, runId, hitlSvc]);

  const handleResolve = async (decision: "APPROVE" | "REJECT") => {
    if (!runId || !user) return;
    setSubmitting(true);
    setError(null);

    const auditId =
      (runDetail?.input_params?.audit_id as string | undefined) ??
      (runDetail?.input_params?.run_id as string | undefined) ??
      "";

    try {
      await hitlSvc.resolveHitl({
        run_id: runId,
        audit_id: auditId,
        reason_code: reasonCode,
        override_tons: overrideTons ? parseFloat(overrideTons) : undefined,
        notes: notes || `${decision} recorded by ${user.email}`,
        resolver_id: user.user_id,
      });

      if (decision === "APPROVE") {
        notify.success(`Run ${runId} approved. 80% escrow advance released.`, "HITL Approved");
      } else {
        notify.warning(`Run ${runId} flagged and halted.`, "HITL Rejected");
      }

      onResolved?.();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Resolution submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const auditResult = runDetail?.input_params?.audit_result as Record<string, unknown> | undefined;
  const deltaPercent =
    auditResult?.delta_percent != null ? Number(auditResult.delta_percent) : null;
  const claimedTons =
    auditResult?.claimed_tons != null ? Number(auditResult.claimed_tons) : 250;
  const verifiedTons =
    auditResult?.verified_tons != null ? Number(auditResult.verified_tons) : claimedTons;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberIcon color="warning" />
          <Typography variant="h6" fontWeight={700}>
            Human-in-the-Loop Approval Gate
          </Typography>
        </Box>
        {runId && (
          <Chip label={runId} size="small" variant="outlined" sx={{ fontFamily: "monospace", fontWeight: 600 }} />
        )}
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 2.5 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 5 }}>
            <CircularProgress size={32} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>
              Loading run audit telemetry…
            </Typography>
          </Box>
        ) : (
          <>
            {/* Audit discrepancy summary */}
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(245, 158, 11, 0.08)" : "rgba(245, 158, 11, 0.1)"),
                border: "1px solid",
                borderColor: "rgba(245, 158, 11, 0.3)",
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} color="warning.main" sx={{ mb: 1 }}>
                Autonomous Execution Held for Compliance Review
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                SCADA telemetry physics verification detected an anomaly or variance exceeding the tolerance threshold.
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Claimed Volume</Typography>
                  <Typography variant="body2" fontWeight={700}>{claimedTons} Tons</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Verified Melt</Typography>
                  <Typography variant="body2" fontWeight={700}>{verifiedTons} Tons</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Discrepancy (Δ)</Typography>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color={deltaPercent != null && deltaPercent > 10 ? "error.main" : "warning.main"}
                  >
                    {deltaPercent != null ? `${deltaPercent > 0 ? "+" : ""}${deltaPercent}%` : "+14.2%"}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {/* Resolution form */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                select
                label="Statutory Reason Code"
                size="small"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                fullWidth
                helperText="Required by CPCB Gazette rules for audit trail attestation"
              >
                {REASON_CODES.map((code) => (
                  <MenuItem key={code} value={code}>
                    {code.replace(/_/g, " ")}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Operator Override Volume (Optional Tons)"
                type="number"
                size="small"
                value={overrideTons}
                onChange={(e) => setOverrideTons(e.target.value)}
                placeholder="Leave blank to use verified melt tons"
                fullWidth
              />

              <TextField
                label="Compliance Justification & Notes"
                multiline
                rows={3}
                size="small"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter justification for overriding or verifying this workflow execution…"
                fullWidth
              />
            </Box>
          </>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<CancelIcon />}
            disabled={loading || submitting}
            onClick={() => handleResolve("REJECT")}
          >
            {submitting ? "Rejecting…" : "Reject & Halt"}
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            disabled={loading || submitting}
            onClick={() => handleResolve("APPROVE")}
          >
            {submitting ? "Approving…" : "Approve & Release"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
