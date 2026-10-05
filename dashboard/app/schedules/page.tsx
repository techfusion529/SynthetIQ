"use client";

import React, { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import { useRouter } from "next/navigation";

import { useScheduleService } from "../lib/hooks/useServices";
import { ApiError } from "../lib/services/base.service";
import type { Schedule } from "../lib/types/schedule.types";

function ScheduleCard({ schedule }: { schedule: Schedule }) {
  const isActive = schedule.status === "ACTIVE";
  const nextRun = schedule.next_run_at
    ? new Date(schedule.next_run_at).toLocaleString()
    : "—";

  return (
    <Card variant="outlined" sx={{ borderLeft: `4px solid ${isActive ? "#10b981" : "#f43f5e"}` }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>{schedule.name}</Typography>
            <Typography variant="caption" color="text.secondary" fontFamily="monospace">{schedule.schedule_id}</Typography>
          </Box>
          <Chip label={schedule.status} size="small" color={isActive ? "success" : "error"} />
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5, fontSize: "0.75rem", mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Frequency:</Typography>
          <Typography variant="caption" fontWeight={700}>{schedule.frequency}</Typography>
          <Typography variant="caption" color="text.secondary">Next Run:</Typography>
          <Typography variant="caption" fontWeight={700} fontFamily="monospace">{nextRun}</Typography>
          <Typography variant="caption" color="text.secondary">Target Service:</Typography>
          <Typography variant="caption" fontWeight={700}>{schedule.target_service}</Typography>
          <Typography variant="caption" color="text.secondary">Last Run:</Typography>
          <Typography variant="caption" fontWeight={700}>{schedule.last_run_at ?? "Never"}</Typography>
        </Box>
        {schedule.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {schedule.description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function SchedulesPage() {
  const router = useRouter();
  const scheduleSvc = useScheduleService();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activating, setActivating] = useState(false);
  const [activateResult, setActivateResult] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await scheduleSvc.listSchedules();
      setSchedules(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, [scheduleSvc]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const handleActivate = async () => {
    if (schedules.length === 0) return;
    setActivating(true);
    setActivateResult(null);
    setActivateError(null);
    try {
      const target = schedules[0];
      const res = await scheduleSvc.resumeSchedule(target.schedule_id);
      setActivateResult(`Schedule ${target.name || target.schedule_id} resumed (${res.status})`);
      fetchSchedules();
    } catch (e) {
      setActivateError(e instanceof ApiError ? e.message : "Failed to activate schedule");
    } finally {
      setActivating(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <Breadcrumbs>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/")}>Executive Hub</Link>
        <Typography color="primary.light" fontWeight={600}>Schedules — Temporal Workflow Automation</Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Scheduled Multi‑Agent Workflows</Typography>
          <Typography variant="body2" color="text.secondary">
            Temporal‑driven periodic compliance runs (daily, weekly, monthly) with automatic audit and settlement.
          </Typography>
        </Box>
        <Button
          variant="contained" color="primary"
          onClick={handleActivate}
          disabled={activating || schedules.length === 0}
          startIcon={activating ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {activating ? "Activating…" : "Activate Next Schedule"}
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {activateError && <Alert severity="error">{activateError}</Alert>}
      {activateResult && <Alert severity="success">{activateResult}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={120} />
          ))}
        </Box>
      ) : schedules.length === 0 ? (
        <Alert severity="info">No scheduled workflows defined.</Alert>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {schedules.map((schedule) => (
            <ScheduleCard key={schedule.schedule_id} schedule={schedule} />
          ))}
        </Box>
      )}
    </Box>
  );
}
