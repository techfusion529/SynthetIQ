"use client";

import React, { useEffect, useState, useCallback } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Badge from "@mui/material/Badge";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useOrganization } from "../app/lib/contexts/OrganizationContext";
import { useSession } from "../app/lib/contexts/SessionContext";
import { useHitlService } from "../app/lib/hooks/useServices";
import type { HITLRun } from "../app/lib/types/hitl.types";
import UserMenu from "./UserMenu";
import HumanApprovalModal from "./HumanApprovalModal";
import { findNav } from "./nav";
import { PoweredByGemini } from "./icons/GoogleIcons";

export const APP_HEADER_H = 64;

export default function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname() || "/";
  const { user } = useSession();
  const { company } = useOrganization();
  const hitlSvc = useHitlService();

  const org = company?.name || user?.organization_name || user?.org_id || "";
  const navHit = findNav(pathname);

  // HITL notifications state
  const [pendingRuns, setPendingRuns] = useState<HITLRun[]>([]);
  const [notificationAnchor, setNotificationAnchor] = useState<HTMLElement | null>(null);
  const [selectedApprovalRunId, setSelectedApprovalRunId] = useState<string | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      const data = await hitlSvc.listHitlRuns(20);
      setPendingRuns(data.filter((r) => r.hitl_required || r.status.includes("HITL") || r.status.includes("REVIEW")));
    } catch {
      // Background poll failure is non-fatal
    }
  }, [hitlSvc]);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const handleOpenApproval = (runId: string) => {
    handleNotificationClose();
    setSelectedApprovalRunId(runId);
    setApprovalModalOpen(true);
  };

  const breadcrumbStyle = { fontSize: "0.72rem" };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          color: "text.primary",
        }}
      >
        <Toolbar disableGutters sx={{ minHeight: `${APP_HEADER_H}px !important`, px: { xs: 1.5, sm: 2.5 }, gap: 1.5 }}>
          {/* Mobile / desktop toggle */}
          <Tooltip title="Toggle navigation">
            <IconButton edge="start" aria-label="Toggle navigation" onClick={onMenuClick} size="small">
              <MenuIcon />
            </IconButton>
          </Tooltip>

          {/* Logo mark */}
          <Box
            aria-hidden
            sx={{
              width: 30,
              height: 30,
              bgcolor: "primary.main",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: "0.95rem",
              borderRadius: 1,
              flexShrink: 0,
            }}
          >
            S
          </Box>

          {/* Title and Breadcrumbs stacked */}
          <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, py: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "0.98rem", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
                SynthetIQ
              </Typography>
              {org && (
                <>
                  <Typography sx={{ color: "text.disabled", fontSize: "0.8rem", lineHeight: 1 }}>/</Typography>
                  <Typography
                    noWrap
                    sx={{
                      fontSize: "0.86rem",
                      fontWeight: 600,
                      color: "text.secondary",
                      maxWidth: { xs: 160, sm: 280, md: 400 },
                      lineHeight: 1.2,
                    }}
                  >
                    {org}
                  </Typography>
                </>
              )}
            </Box>

            {/* Breadcrumb moved below company name in the header */}
            <Breadcrumbs separator="/" aria-label="Breadcrumb" sx={{ mt: 0.25, "& .MuiBreadcrumbs-separator": { mx: 0.5 } }}>
              <Link component={NextLink} href="/" underline="hover" color="text.secondary" sx={breadcrumbStyle}>
                Home
              </Link>
              {navHit && navHit.item.href !== "/" && (
                <Typography color="text.secondary" sx={breadcrumbStyle}>
                  {navHit.group}
                </Typography>
              )}
              {navHit && (
                <Typography color="text.primary" sx={{ ...breadcrumbStyle, fontWeight: 700 }}>
                  {navHit.item.label}
                </Typography>
              )}
            </Breadcrumbs>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Powered by Google Gemini & Cloud */}
          <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center" }}>
            <PoweredByGemini variant="pill" showCloud />
          </Box>

          {/* Notification bell with Human Approvals popover */}
          <Tooltip title={pendingRuns.length > 0 ? `${pendingRuns.length} Pending Human Approvals` : "Notifications"}>
            <IconButton
              aria-label="Pending Approvals"
              onClick={handleNotificationClick}
              size="small"
              sx={{
                p: 0.75,
                color: pendingRuns.length > 0 ? "warning.main" : "text.secondary",
                border: "1px solid",
                borderColor: pendingRuns.length > 0 ? "warning.light" : "transparent",
              }}
            >
              <Badge badgeContent={pendingRuns.length} color="warning" max={99}>
                <NotificationsOutlinedIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* User profile avatar (no name beside avatar, per requirement) */}
          <UserMenu />
        </Toolbar>
      </AppBar>

      {/* Notifications / Approvals Popover */}
      <Menu
        anchorEl={notificationAnchor}
        open={Boolean(notificationAnchor)}
        onClose={handleNotificationClose}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 360,
              maxWidth: "calc(100vw - 32px)",
              border: 1,
              borderColor: "divider",
              boxShadow: (t) =>
                t.palette.mode === "dark"
                  ? "0 10px 30px rgba(0,0,0,0.6)"
                  : "0 10px 30px rgba(0,0,0,0.1)",
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>Human Approvals</Typography>
            <Chip
              size="small"
              label={pendingRuns.length}
              color={pendingRuns.length > 0 ? "warning" : "default"}
              sx={{ height: 20, fontSize: "0.72rem", fontWeight: 700 }}
            />
          </Box>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchPending}>
              <RefreshIcon sx={{ fontSize: "1rem" }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Divider />

        {pendingRuns.length === 0 ? (
          <Box sx={{ py: 3, px: 2, textAlign: "center" }}>
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 32, mb: 0.5, opacity: 0.8 }} />
            <Typography variant="body2" fontWeight={600}>
              All Workflows Compliant
            </Typography>
            <Typography variant="caption" color="text.secondary">
              No human-in-the-loop approvals pending review.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 320, overflowY: "auto" }}>
            {pendingRuns.map((run) => (
              <MenuItem
                key={run.run_id}
                onClick={() => handleOpenApproval(run.run_id)}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  py: 1.25,
                  px: 2,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", mb: 0.5 }}>
                  <Typography sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.82rem" }}>
                    {run.run_id}
                  </Typography>
                  <Chip
                    label="Review Needed"
                    size="small"
                    color="warning"
                    icon={<WarningAmberIcon sx={{ fontSize: "0.85rem !important" }} />}
                    sx={{ height: 20, fontSize: "0.68rem", fontWeight: 600 }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.3 }}>
                  SCADA physics anomaly flagged on melt verification. Click to review & release.
                </Typography>
              </MenuItem>
            ))}
          </Box>
        )}

        <Divider />

        <Box sx={{ p: 1, textAlign: "center" }}>
          <Button
            component={NextLink}
            href="/hitl"
            onClick={handleNotificationClose}
            size="small"
            fullWidth
            sx={{ fontSize: "0.78rem" }}
          >
            Open Full HITL Console →
          </Button>
        </Box>
      </Menu>

      {/* Direct Human Approval Modal */}
      <HumanApprovalModal
        open={approvalModalOpen}
        runId={selectedApprovalRunId}
        onClose={() => setApprovalModalOpen(false)}
        onResolved={fetchPending}
      />
    </>
  );
}
