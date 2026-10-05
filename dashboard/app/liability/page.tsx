"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ScaleIcon from "@mui/icons-material/Scale";
import CalculateIcon from "@mui/icons-material/Calculate";

import { useCompany } from "../lib/contexts/CompanyContext";
import { useLiabilityService } from "../lib/hooks/useServices";
import { ApiError } from "../lib/services/base.service";
import type { LiabilityReport } from "../lib/types/liability.types";

const CATEGORY_META: Record<string, { label: string; color: "primary" | "secondary" | "success" | "warning" }> = {
  cat_i_rigid:        { label: "Category I — Rigid Plastic",       color: "primary" },
  cat_ii_flexible:    { label: "Category II — Flexible Plastic",   color: "secondary" },
  cat_iii_mlp:        { label: "Category III — Multi-Layer (MLP)", color: "success" },
  cat_iv_compostable: { label: "Category IV — Compostable",        color: "warning" },
};

function StatCard({ label, value, unit, color }: { label: string; value: number | null; unit?: string; color?: string }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="caption" textTransform="uppercase" letterSpacing="0.06em" color="text.secondary" fontWeight={600}>{label}</Typography>
        <Typography variant="h4" fontWeight={700} fontFamily="monospace" sx={{ mt: 1, color: color ?? "text.primary" }}>
          {value != null ? value.toLocaleString() : "—"}
          {unit && <Typography component="span" variant="body2" color="text.secondary" ml={0.5}>{unit}</Typography>}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function LiabilityPage() {
  const router = useRouter();
  const { companyId } = useCompany();
  const liabilitySvc = useLiabilityService();

  const [report, setReport]         = useState<LiabilityReport | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Slider state
  const [sliderDebt, setSliderDebt] = useState<number>(0);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcError, setRecalcError]     = useState<string | null>(null);
  const [recalcResult, setRecalcResult]   = useState<LiabilityReport | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Displayed net liability — from recalc result if available, else from original report
  const displayed = recalcResult ?? report;

  const fetchReport = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await liabilitySvc.getReport(companyId);
      setReport(r);
      setSliderDebt(r.historic_debt_tons ?? 0);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError("No liability report found for this company.");
      } else {
        setError(e instanceof ApiError ? e.message : "Failed to load liability report");
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, liabilitySvc]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Debounced recalculate on slider change (500 ms, useEffect-based to avoid stale closure)
  useEffect(() => {
    if (!companyId || !report) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setRecalcLoading(true);
      setRecalcError(null);
      try {
        const res = await liabilitySvc.calculate({ company_id: companyId, fiscal_year: "FY2026-27", historic_debt_tons: sliderDebt });
        // Merge result into displayed report
        setRecalcResult({
          ...(report),
          historic_debt_tons: sliderDebt,
          amortized_debt_tons: res.amortized_debt_tons,
          net_liability_tons: res.net_liability_tons,
          current_year_liability_tons: res.current_year_liability_tons,
          already_fulfilled_tons: res.already_fulfilled_tons,
        });
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Recalculation failed";
        setRecalcError(`Recalculation failed: ${msg}`);
        // Preserve previous values on error
      } finally {
        setRecalcLoading(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [sliderDebt]); // eslint-disable-line react-hooks/exhaustive-deps

  const skeletonRowCount = report ? Object.keys(report.breakdown_by_category ?? {}).length : 4;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      {/* Breadcrumb */}
      <Breadcrumbs>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/")}>Executive Hub</Link>
        <Typography color="primary.light" fontWeight={600}>Workflow 1 — Liability & Sourcing</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ScaleIcon color="primary" /> Plastic Liability & 1/3 Debt Amortization Matrix
          </Typography>
          <Typography variant="body2" color="text.secondary">
            CPCB EPR Guidelines 2026 — mathematical debt amortization and statutory conversion factors (Cf)
          </Typography>
        </Box>
        <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => router.push("/auction")}>
          Proceed to Auction Room
        </Button>
      </Box>

      {error && <Alert severity={error.includes("No liability") ? "warning" : "error"}>{error}</Alert>}

      {/* KPI row */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          {loading ? <Skeleton variant="rounded" height={100} /> : <StatCard label="Current Year Base" value={displayed?.current_year_liability_tons ?? null} unit="Tons" />}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {loading ? <Skeleton variant="rounded" height={100} /> : <StatCard label="Historic Debt" value={sliderDebt} unit="Tons" color="#f59e0b" />}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {loading ? <Skeleton variant="rounded" height={100} /> : <StatCard label="Amortized 1/3" value={displayed?.amortized_debt_tons ?? null} unit="Tons" color="#4f46e5" />}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {loading ? <Skeleton variant="rounded" height={100} /> : <StatCard label="Net Obligation" value={displayed?.net_liability_tons ?? null} unit="Tons" color="#10b981" />}
        </Grid>
      </Grid>

      {/* Amortization slider */}
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <CalculateIcon color="secondary" />
            <Typography variant="subtitle1" fontWeight={700}>Statutory 1/3 Historic Debt Amortization Engine</Typography>
            {recalcLoading && <Chip label="Recalculating…" size="small" color="primary" variant="outlined" sx={{ ml: "auto" }} />}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Rule 13(2): Past deficits amortized in equal 33.33% fractions over 3 rolling fiscal years
          </Typography>
          <Box sx={{ px: 1, mt: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" color="text.secondary">Historic Carryover Debt</Typography>
              <Typography variant="body2" fontWeight={700} fontFamily="monospace" color="warning.main">
                {sliderDebt.toLocaleString()} Tons
              </Typography>
            </Box>
            <Slider
              value={sliderDebt}
              min={0} max={9000} step={100}
              onChange={(_, v) => setSliderDebt(v as number)}
              color="primary"
              marks={[{ value: 0, label: "0" }, { value: 4500, label: "4,500" }, { value: 9000, label: "9,000" }]}
            />
          </Box>
          {recalcError && <Alert severity="error" sx={{ mt: 1 }}>{recalcError}</Alert>}
          <Box sx={{ mt: 2, p: 1.5, bgcolor: "rgba(79,70,229,0.07)", borderRadius: 2, border: "1px solid rgba(79,70,229,0.15)" }}>
            <Typography variant="caption" color="primary.light" fontFamily="monospace">
              Net = Current ({displayed?.current_year_liability_tons?.toLocaleString() ?? "…"}) + Amortized (
              {displayed?.amortized_debt_tons?.toLocaleString() ?? "…"}) − Fulfilled (
              {displayed?.already_fulfilled_tons?.toLocaleString() ?? "…"}) ={" "}
              <strong>{displayed?.net_liability_tons?.toLocaleString() ?? "…"} Tons</strong>
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Conversion Factor (Cf) Table */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={0.5}>Statutory Conversion Factor (Cf) Matrix</Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            CPCB weight multipliers: Credits = Physical Tons × Cf
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Plastic Category</TableCell>
                <TableCell align="right">Liability (Tons)</TableCell>
                <TableCell align="center">Mechanical Cf</TableCell>
                <TableCell align="center">Co-processing Cf</TableCell>
                <TableCell align="right">Net Credits</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                    <TableRow key={i}>
                      {[1, 2, 3, 4, 5].map((c) => (
                        <TableCell key={c}><Skeleton variant="text" width="80%" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : report?.breakdown_by_category
                  ? Object.entries(report.breakdown_by_category).map(([key, tons]) => {
                      const meta = CATEGORY_META[key] ?? { label: key, color: "primary" as const };
                      const cf = report.conversion_factors?.[key];
                      const mechCf  = cf?.mechanical  ?? null;
                      const coProcCf = cf?.co_processing ?? null;
                      return (
                        <TableRow key={key} hover>
                          <TableCell>
                            <Chip label={meta.label} size="small" color={meta.color} variant="outlined" />
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                            {(tons as number).toLocaleString()}
                          </TableCell>
                          <TableCell align="center" sx={{ fontFamily: "monospace", color: "success.main", fontWeight: 700 }}>
                            {mechCf != null ? mechCf.toFixed(2) : "N/A"}
                          </TableCell>
                          <TableCell align="center" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
                            {coProcCf != null ? coProcCf.toFixed(2) : "N/A"}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                            {mechCf != null ? Math.round((tons as number) * mechCf).toLocaleString() : "N/A"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  : (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Alert severity="info">No breakdown data available.</Alert>
                      </TableCell>
                    </TableRow>
                  )
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
