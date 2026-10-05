"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import CircularProgress from "@mui/material/CircularProgress";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import RefreshIcon from "@mui/icons-material/Refresh";
import GavelIcon from "@mui/icons-material/Gavel";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddIcon from "@mui/icons-material/Add";
import SignalCellularAltIcon from "@mui/icons-material/SignalCellularAlt";

import { useCompany } from "../lib/contexts/CompanyContext";
import { useAuctionService } from "../lib/hooks/useServices";
import { ApiError } from "../lib/services/base.service";
import type { Auction, Bid } from "../lib/types/auction.types";

const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  MATCHED: "success",
  BIDDING: "warning",
  OUT_OF_CORRIDOR: "error",
};

function CorridorVisualizer({ auction }: { auction: Auction | null }) {
  if (!auction) return <Skeleton variant="rounded" height={60} />;
  const { floor_price_inr: floor, ceiling_price_inr: ceiling, clearing_price_inr: clearing } = auction;
  // Clearing marker position within the 30–100% band (0–100%)
  const pct = ceiling > floor ? Math.round(((clearing - floor) / (ceiling - floor)) * 100) : 50;
  return (
    <Box>
      <Box sx={{ position: "relative", height: 40, borderRadius: 2, overflow: "hidden", display: "flex" }}>
        {/* Below floor — rejected zone */}
        <Box sx={{ width: "30%", bgcolor: "rgba(244,63,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="caption" color="error" fontWeight={700} sx={{ fontSize: "0.65rem" }}>Banned (&lt;30%)</Typography>
        </Box>
        {/* Statutory corridor */}
        <Box sx={{ width: "70%", bgcolor: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", px: 1.5, position: "relative" }}>
          <Typography variant="caption" color="success.light" fontWeight={600} fontSize="0.7rem">₹{floor.toFixed(2)}</Typography>
          {/* Clearing price marker */}
          <Box sx={{ position: "absolute", left: `${pct * 0.7}%`, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Chip label={`₹${clearing.toFixed(2)}/kg`} size="small" color="secondary" sx={{ fontSize: "0.65rem", fontWeight: 700, height: 20 }} />
          </Box>
          <Typography variant="caption" color="success.light" fontWeight={600} fontSize="0.7rem" sx={{ ml: "auto" }}>₹{ceiling.toFixed(2)}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
        <Typography variant="caption" color="text.disabled">₹0</Typography>
        <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
          Corridor active: ₹{floor.toFixed(2)} — ₹{ceiling.toFixed(2)} (30–100% of ₹{auction.statutory_rate_per_kg}/kg base rate)
        </Typography>
        <Typography variant="caption" color="text.disabled">₹{(ceiling * 1.2).toFixed(2)}+</Typography>
      </Box>
    </Box>
  );
}

export default function AuctionPage() {
  const router = useRouter();
  const { companyId } = useCompany();
  const auctionSvc = useAuctionService();

  const [auctions, setAuctions]         = useState<Auction[]>([]);
  const [activeAuction, setActiveAuction] = useState<Auction | null>(null);
  const [bids, setBids]                 = useState<Bid[]>([]);
  const [loadingAuctions, setLoadingAuctions] = useState(true);
  const [loadingBids, setLoadingBids]   = useState(false);
  const [auctionsError, setAuctionsError] = useState<string | null>(null);
  const [bidsError, setBidsError]       = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const [targetTons, setTargetTons]     = useState("1000");
  const [category, setCategory]         = useState("cat_i_rigid");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── fetch auctions (initial) ───────────────────────────────────────────────
  const fetchAuctions = useCallback(async () => {
    setLoadingAuctions(true);
    setAuctionsError(null);
    try {
      const list = await auctionSvc.listAuctions();
      setAuctions(list);
      if (list.length > 0) setActiveAuction(list[0]);
    } catch (e) {
      setAuctionsError(e instanceof ApiError ? e.message : "Failed to load auctions");
    } finally {
      setLoadingAuctions(false);
    }
  }, [auctionSvc]);

  // ── fetch bids for active auction ─────────────────────────────────────────
  const fetchBids = useCallback(async (auctionId: string) => {
    setLoadingBids(true);
    setBidsError(null);
    try {
      const b = await auctionSvc.getBids(auctionId);
      setBids(b);
    } catch (e) {
      setBidsError(e instanceof ApiError ? e.message : "Failed to load bids");
    } finally {
      setLoadingBids(false);
    }
  }, [auctionSvc]);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);

  // ── poll bids every 10 s ──────────────────────────────────────────────────
  useEffect(() => {
    if (!activeAuction) return;
    fetchBids(activeAuction.id);
    pollRef.current = setInterval(() => fetchBids(activeAuction.id), 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeAuction, fetchBids]);

  // ── broadcast RFP ─────────────────────────────────────────────────────────
  const handleBroadcast = async () => {
    if (!companyId) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await auctionSvc.broadcastRfp({ company_id: companyId, category, target_tons: Number(targetTons) });
      setBroadcastResult(`Auction ${res.auction_id} created — Temporal workflow ${res.workflow_id}`);
      await fetchAuctions();
    } catch (e) {
      setBroadcastResult(`Error: ${e instanceof ApiError ? e.message : "Broadcast failed"}`);
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <Breadcrumbs>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/")}>Executive Hub</Link>
        <Typography color="primary.light" fontWeight={600}>Workflow 2 — Double Auction</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <GavelIcon color="primary" /> Continuous Double Auction Room
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Treasury Agent autonomous matching locked within statutory 30%–100% price corridor
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            select
            size="small"
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            sx={{ width: 170 }}
          >
            <MenuItem value="cat_i_rigid">Cat I — Rigid</MenuItem>
            <MenuItem value="cat_ii_flexible">Cat II — Flexible</MenuItem>
            <MenuItem value="cat_iii_mlp">Cat III — MLP</MenuItem>
            <MenuItem value="cat_iv_compostable">Cat IV — Compostable</MenuItem>
          </TextField>
          <TextField
            size="small" label="Target Tons" value={targetTons}
            onChange={(e) => setTargetTons(e.target.value)}
            sx={{ width: 120 }}
            type="number"
          />
          <Button
            variant="contained" startIcon={broadcasting ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
            onClick={handleBroadcast} disabled={broadcasting || !companyId}
          >
            Broadcast RFP
          </Button>
          <Button variant="outlined" endIcon={<ArrowForwardIcon />} onClick={() => router.push("/audit")}>
            Proceed to Audit
          </Button>
        </Box>
      </Box>

      {broadcastResult && (
        <Alert severity={broadcastResult.startsWith("Error") ? "error" : "success"}>{broadcastResult}</Alert>
      )}

      {auctionsError && <Alert severity="error">{auctionsError}</Alert>}

      {/* Corridor Visualizer */}
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Statutory 30%–100% Price Corridor Rule</Typography>
              <Typography variant="caption" color="text.secondary">
                Transactions outside corridor are automatically rejected. Base rate: ₹{activeAuction?.statutory_rate_per_kg ?? "—"}/kg
              </Typography>
            </Box>
            {loadingAuctions && <CircularProgress size={20} />}
          </Box>
          <CorridorVisualizer auction={activeAuction} />
        </CardContent>
      </Card>

      {/* Auction selector */}
      {!loadingAuctions && auctions.length === 0 ? (
        <Alert severity="info">No auctions found. Broadcast an RFP to create one.</Alert>
      ) : (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {auctions.map((a) => (
            <Chip
              key={a.id}
              label={`${a.auction_id} · ${a.category} · ${a.status}`}
              onClick={() => setActiveAuction(a)}
              color={activeAuction?.id === a.id ? "primary" : "default"}
              variant={activeAuction?.id === a.id ? "filled" : "outlined"}
              size="small"
            />
          ))}
        </Box>
      )}

      {/* Live Order Book */}
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <SignalCellularAltIcon color="success" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>Live Double Auction Order Book</Typography>
              <Chip label="10s refresh" size="small" variant="outlined" color="secondary" sx={{ fontSize: "0.65rem" }} />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                Matched: {bids.filter((b) => b.status === "MATCHED").reduce((s, b) => s + b.volume_tons, 0).toLocaleString()} T
              </Typography>
              <Tooltip title="Refresh bids">
                <IconButton size="small" onClick={() => activeAuction && fetchBids(activeAuction.id)}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Divider sx={{ mb: 1 }} />
          {bidsError && <Alert severity="error" sx={{ mb: 1 }}>{bidsError}</Alert>}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Bid ID</TableCell>
                <TableCell>Recycler</TableCell>
                <TableCell>Plant</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Volume (T)</TableCell>
                <TableCell align="right">Offer (₹/kg)</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Timestamp</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingBids
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}><Skeleton variant="text" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : bids.length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Alert severity="info">No bids received yet for this auction.</Alert>
                      </TableCell>
                    </TableRow>
                  )
                  : bids.map((bid) => (
                    <TableRow key={bid.bid_id} hover>
                      <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, color: "primary.light" }}>{bid.bid_id}</TableCell>
                      <TableCell>{bid.recycler_name}</TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{bid.plant_name}</TableCell>
                      <TableCell>{bid.category}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: "monospace" }}>{bid.volume_tons.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700 }}>₹{bid.price_per_kg.toFixed(2)}</TableCell>
                      <TableCell align="center">
                        <Chip label={bid.status} size="small" color={STATUS_COLOR[bid.status] ?? "default"} sx={{ fontSize: "0.65rem" }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.7rem", color: "text.secondary" }}>
                        {new Date(bid.timestamp).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
