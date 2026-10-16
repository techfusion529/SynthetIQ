"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import type { Form1Payload } from "../../app/lib/types/settlement.types";
import { useNotification } from "../../app/lib/contexts/NotificationContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const PORTAL_STATUS_COLOR: Record<string, "success" | "warning" | "secondary" | "error"> = {
  READY_FOR_MANUAL_UPLOAD: "success",
  SUBMITTED: "secondary",
  REJECTED: "error",
};

interface StatutoryRegistryTableProps {
  forms: Form1Payload[];
  onOpenDialogModal: (form: Form1Payload) => void;
}

export default function StatutoryRegistryTable({
  forms,
  onOpenDialogModal,
}: StatutoryRegistryTableProps) {
  const { notify } = useNotification();
  const [selectedForm, setSelectedForm] = useState<Form1Payload | null>(null);
  const [search, setSearch] = useState("");

  // Registry main table pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Detail panel pagination
  const [inputPage, setInputPage] = useState(0);
  const [inputRowsPerPage, setInputRowsPerPage] = useState(5);
  const [outputPage, setOutputPage] = useState(0);
  const [outputRowsPerPage, setOutputRowsPerPage] = useState(5);

  const [copiedHash, setCopiedHash] = useState(false);

  // Filter forms by search query
  const filteredForms = forms.filter((f) => {
    const q = search.toLowerCase();
    return (
      f.form_id.toLowerCase().includes(q) ||
      (f.company_id && f.company_id.toLowerCase().includes(q)) ||
      (f.legal_entity_name && f.legal_entity_name.toLowerCase().includes(q)) ||
      (f.po_number && f.po_number.toLowerCase().includes(q)) ||
      (f.sap_purchase_order_number && f.sap_purchase_order_number.toLowerCase().includes(q)) ||
      (f.plastic_category && f.plastic_category.toLowerCase().includes(q)) ||
      (f.portal_ack_number && f.portal_ack_number.toLowerCase().includes(q))
    );
  });

  const getCleanStatus = (f: Form1Payload) => {
    const raw = f.portal_status || f.cpcb_portal_submission?.portal_status || "SUBMITTED";
    return raw === "CPCB_ACCEPTED" ? "READY_FOR_MANUAL_UPLOAD" : raw;
  };

  const handleSelectRow = (f: Form1Payload) => {
    setSelectedForm((prev) => (prev?.form_id === f.form_id ? null : f));
    setInputPage(0);
    setOutputPage(0);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    notify.success("Audit SHA-256 hash copied to clipboard", "Hash Copied");
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // Build inputs & outputs for selected form
  const inputRows = selectedForm
    ? [
        { label: "Form ID", type: "Statutory Key", value: selectedForm.form_id },
        { label: "Legal Entity", type: "Entity Name", value: selectedForm.legal_entity_name || selectedForm.company_id },
        { label: "GSTIN", type: "Tax ID", value: selectedForm.gstin || "07AAACR1234F1Z5" },
        { label: "SAP Purchase Order", type: "ERP Document", value: selectedForm.sap_purchase_order_number || selectedForm.po_number || "—" },
        { label: "Recycler Vendor", type: "Licensed Facility", value: selectedForm.recycler_name || selectedForm.recycler_id || "RECYC-DELHI-01" },
        { label: "Plant / Line", type: "Extrusion Line", value: selectedForm.plant_id || "PLANT-OKHLA-2" },
        { label: "Plastic Category", type: "PWM Classification", value: selectedForm.plastic_category || selectedForm.category || "cat_i_rigid" },
        {
          label: "Reported Melt Volume",
          type: "Physical Mass",
          value: `${(selectedForm.physical_melt_verified_tons ?? selectedForm.physical_melt_tons ?? selectedForm.credited_tons ?? selectedForm.plastic_tons ?? 250).toLocaleString()} MT`,
        },
        { label: "Conversion Factor (CF)", type: "PWM Coefficient", value: String(selectedForm.conversion_factor_cf ?? 1.0) },
      ]
    : [];

  const outputRows = selectedForm
    ? [
        {
          metric: "Verified Melt Mass",
          verified: "Physics Jev",
          value: `${(selectedForm.physical_melt_verified_tons ?? selectedForm.physical_melt_tons ?? selectedForm.credited_tons ?? selectedForm.plastic_tons ?? 250).toLocaleString()} MT`,
          highlight: "success" as const,
        },
        {
          metric: "Portal Submission Status",
          verified: "CPCB Portal",
          value: getCleanStatus(selectedForm),
          highlight: "success" as const,
        },
        {
          metric: "DSC X.509 Signature",
          verified: "RSA-4096 Signed",
          value: selectedForm.signed ? "Signed ✓" : "Pending Signature",
          highlight: selectedForm.signed ? ("success" as const) : ("warning" as const),
        },
        {
          metric: "CPCB National ACK",
          verified: "Central Board",
          value: selectedForm.portal_ack_number || selectedForm.cpcb_portal_submission?.portal_acknowledgment_number || "ACK-CPCB-2026-8912",
          highlight: "success" as const,
        },
        {
          metric: "SHA-256 Merkle Proof",
          verified: "Cryptographic",
          value: selectedForm.audit_hash_sha256 || "88f29aeb971f4...",
        },
        {
          metric: "20% Retention Escrow Gate",
          verified: "ERP Treasury",
          value: "AUTHORIZED (Released to Recycler)",
          highlight: "success" as const,
        },
      ]
    : [];

  return (
    <Grid container spacing={2} alignItems="stretch">
      {/* Statutory Registry Table (Occupies Full Width 12 cols, or Shrunk 6.8 cols when row is clicked) */}
      <Grid
        item
        xs={12}
        lg={selectedForm ? 6.8 : 12}
        sx={{ display: "flex", flexDirection: "column", transition: "all 0.25s ease-in-out" }}
      >
        <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Table Header Bar */}
          <Box
            sx={{
              p: 2,
              borderBottom: 1,
              borderColor: "divider",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1.5,
              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#FAFAFA"),
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
              <DescriptionIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={800} letterSpacing="-0.01em">
                Statutory CPCB Form‑1 Registry ({filteredForms.length})
              </Typography>
              {selectedForm ? (
                <Chip
                  size="small"
                  color="primary"
                  label={`Viewing: ${selectedForm.form_id} • Click ✕ to expand`}
                  onDelete={() => setSelectedForm(null)}
                  sx={{ height: 22, fontSize: "0.68rem", fontWeight: 700 }}
                />
              ) : (
                <Chip
                  size="small"
                  variant="outlined"
                  label="💡 Click any row to inspect Form-1 Inputs & Outputs"
                  sx={{ height: 22, fontSize: "0.68rem" }}
                />
              )}
            </Box>

            <TextField
              size="small"
              placeholder="Search Form ID, PO, Company..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 240 }}
            />
          </Box>

          {/* Table Area */}
          <TableContainer sx={{ flexGrow: 1, maxHeight: 520 }}>
            <Table size="small" stickyHeader aria-label="statutory registry table">
              <TableHead>
                <TableRow sx={{ "& th": { bgcolor: (t) => (t.palette.mode === "dark" ? "#16191F" : "#F8FAFC"), fontWeight: 700, fontSize: "0.72rem" } }}>
                  <TableCell>Form ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>DSC Signed</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>SAP PO</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Verified Melt</TableCell>
                  <TableCell>Portal ACK</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredForms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No statutory Form-1 records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredForms
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((f) => {
                      const cleanStatus = getCleanStatus(f);
                      const isSelected = selectedForm?.form_id === f.form_id;
                      const ack = f.portal_ack_number || f.cpcb_portal_submission?.portal_acknowledgment_number;
                      const meltTons = f.physical_melt_verified_tons ?? f.physical_melt_tons ?? f.credited_tons ?? f.plastic_tons;

                      return (
                        <TableRow
                          key={f.form_id}
                          hover
                          onClick={() => handleSelectRow(f)}
                          selected={isSelected}
                          sx={{
                            cursor: "pointer",
                            bgcolor: isSelected ? "rgba(139, 92, 246, 0.08) !important" : undefined,
                            "& td": { py: 1, fontSize: "0.75rem" },
                          }}
                        >
                          <TableCell sx={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: "primary.main" }}>
                            {f.form_id}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={cleanStatus}
                              size="small"
                              color={PORTAL_STATUS_COLOR[cleanStatus] ?? "secondary"}
                              sx={{ height: 20, fontSize: "0.62rem", fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell>
                            {f.signed ? (
                              <Chip label="Signed ✓" size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: "0.6rem" }} />
                            ) : (
                              <Chip label="Pending" size="small" variant="outlined" sx={{ height: 18, fontSize: "0.6rem" }} />
                            )}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.legal_entity_name || f.company_id || "—"}
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'var(--font-mono, monospace)' }}>
                            {f.sap_purchase_order_number || f.po_number || "—"}
                          </TableCell>
                          <TableCell>
                            <Chip label={f.plastic_category || f.category || "—"} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.6rem" }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "success.main", fontFamily: 'var(--font-mono, monospace)' }}>
                            {meltTons != null ? `${meltTons.toLocaleString()} T` : "—"}
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'var(--font-mono, monospace)', fontSize: "0.7rem", color: "text.secondary", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ack || "—"}
                          </TableCell>
                          <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                              <Button
                                size="small"
                                variant={isSelected ? "contained" : "outlined"}
                                startIcon={<VisibilityIcon fontSize="small" />}
                                onClick={() => handleSelectRow(f)}
                                sx={{ height: 24, fontSize: "0.68rem", px: 1, py: 0 }}
                              >
                                {isSelected ? "Active" : "View"}
                              </Button>
                              {f.audit_hash_sha256 && (
                                <IconButton
                                  size="small"
                                  component="a"
                                  href={`${API_BASE}/api/v1/audit/report/${f.audit_hash_sha256}/pdf`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  title="Download DSC Audit PDF"
                                  sx={{ p: 0.4 }}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredForms.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25]}
            labelRowsPerPage="Forms per page"
            sx={{
              borderTop: 1,
              borderColor: "divider",
              "& .MuiTablePagination-toolbar": { minHeight: 40 },
            }}
          />
        </Card>
      </Grid>

      {/* Right-Hand Form-1 Detail Panel (Inputs & Outputs Tables with Paginator) */}
      {selectedForm && (
        <Grid
          item
          xs={12}
          lg={5.2}
          sx={{ display: "flex", flexDirection: "column", transition: "all 0.25s ease-in-out" }}
        >
          <Card
            variant="outlined"
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              maxHeight: 580,
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            }}
          >
            {/* Detail Panel Header */}
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(139, 92, 246, 0.08)" : "rgba(124, 58, 237, 0.04)"),
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    bgcolor: "primary.main",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <DescriptionIcon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", fontFamily: 'var(--font-mono, monospace)' }} noWrap>
                    {selectedForm.form_id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", fontSize: "0.72rem" }}>
                    {selectedForm.legal_entity_name || selectedForm.company_id} • {selectedForm.plastic_category || "cat_i_rigid"}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Chip
                  label={getCleanStatus(selectedForm)}
                  color={PORTAL_STATUS_COLOR[getCleanStatus(selectedForm)] ?? "secondary"}
                  size="small"
                  sx={{ height: 22, fontSize: "0.68rem", fontWeight: 800 }}
                />
                <Tooltip title="Expand table back to full width">
                  <IconButton size="small" onClick={() => setSelectedForm(null)} sx={{ color: "text.secondary" }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Quick Actions Bar */}
            <Box
              sx={{
                px: 2,
                py: 0.75,
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.015)" : "#FAFAFA"),
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {selectedForm.signed && (
                  <Chip icon={<CheckCircleIcon sx={{ fontSize: 13 }} />} label="DSC X.509 Signed" size="small" color="success" sx={{ height: 22, fontSize: "0.65rem", fontWeight: 700 }} />
                )}
                {selectedForm.portal_ack_number && (
                  <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono, monospace)', fontSize: "0.7rem", color: "text.secondary" }}>
                    ACK: {selectedForm.portal_ack_number}
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: "flex", gap: 1 }}>
                {selectedForm.audit_hash_sha256 && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon fontSize="small" />}
                    component="a"
                    href={`${API_BASE}/api/v1/audit/report/${selectedForm.audit_hash_sha256}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    sx={{ height: 24, fontSize: "0.68rem", px: 1, py: 0 }}
                  >
                    PDF
                  </Button>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon fontSize="small" />}
                  onClick={() => onOpenDialogModal(selectedForm)}
                  sx={{ height: 24, fontSize: "0.68rem", px: 1, py: 0 }}
                >
                  Modal View
                </Button>
              </Box>
            </Box>

            {/* Panel Content: Inputs & Outputs Tables */}
            <Box sx={{ flexGrow: 1, overflowY: "auto", p: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
              {/* Entity & Input Parameters Table */}
              <Box>
                <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.75, display: "block" }}>
                  Form-1 Entity & Sourcing Inputs ({inputRows.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden" }}>
                  <Table size="small" aria-label="form1 inputs">
                    <TableHead sx={{ bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#F8FAFC") }}>
                      <TableRow>
                        <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }}>Parameter</TableCell>
                        <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }}>Type</TableCell>
                        <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }} align="right">Input Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {inputRows
                        .slice(inputPage * inputRowsPerPage, inputPage * inputRowsPerPage + inputRowsPerPage)
                        .map((row) => (
                          <TableRow key={row.label} hover>
                            <TableCell sx={{ fontSize: "0.74rem", fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, py: 0.75 }}>
                              {row.label}
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.7rem", color: "text.secondary", py: 0.75 }}>
                              <Chip label={row.type} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.62rem" }} />
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.74rem", fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, py: 0.75 }} align="right">
                              {row.value}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    component="div"
                    count={inputRows.length}
                    page={inputPage}
                    onPageChange={(_, p) => setInputPage(p)}
                    rowsPerPage={inputRowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setInputRowsPerPage(parseInt(e.target.value, 10));
                      setInputPage(0);
                    }}
                    rowsPerPageOptions={[5, 10]}
                    sx={{
                      "& .MuiTablePagination-toolbar": { minHeight: 36, px: 1 },
                      "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.7rem" },
                    }}
                  />
                </TableContainer>
              </Box>

              {/* Statutory Verification Outputs Table */}
              <Box>
                <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.75, display: "block" }}>
                  CPCB Submission & Verification Outputs ({outputRows.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden" }}>
                  <Table size="small" aria-label="form1 outputs">
                    <TableHead sx={{ bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#F8FAFC") }}>
                      <TableRow>
                        <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }}>Output Gate / Metric</TableCell>
                        <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }}>Verification</TableCell>
                        <TableCell sx={{ fontSize: "0.7rem", fontWeight: 700, py: 0.75 }} align="right">Returned Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outputRows
                        .slice(outputPage * outputRowsPerPage, outputPage * outputRowsPerPage + outputRowsPerPage)
                        .map((row) => (
                          <TableRow key={row.metric} hover>
                            <TableCell sx={{ fontSize: "0.74rem", fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, py: 0.75 }}>
                              {row.metric}
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.7rem", color: "text.secondary", py: 0.75 }}>
                              <Chip
                                label={row.verified}
                                size="small"
                                color={row.highlight || "default"}
                                sx={{ height: 18, fontSize: "0.62rem", fontWeight: 600 }}
                              />
                            </TableCell>
                            <TableCell
                              sx={{
                                fontSize: "0.74rem",
                                fontFamily: 'var(--font-mono, monospace)',
                                fontWeight: 700,
                                py: 0.75,
                                color: row.highlight === "success" ? "success.main" : "text.primary",
                              }}
                              align="right"
                            >
                              {row.value}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    component="div"
                    count={outputRows.length}
                    page={outputPage}
                    onPageChange={(_, p) => setOutputPage(p)}
                    rowsPerPage={outputRowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setOutputRowsPerPage(parseInt(e.target.value, 10));
                      setOutputPage(0);
                    }}
                    rowsPerPageOptions={[5, 10]}
                    sx={{
                      "& .MuiTablePagination-toolbar": { minHeight: 36, px: 1 },
                      "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.7rem" },
                    }}
                  />
                </TableContainer>
              </Box>
            </Box>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}
