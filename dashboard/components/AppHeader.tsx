"use client";

import React, { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import BusinessIcon from "@mui/icons-material/Business";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import HomeIcon from "@mui/icons-material/Home";
import { usePathname, useRouter } from "next/navigation";
import NextLink from "next/link";
import { useOrganization as useCompany } from "../app/lib/contexts/OrganizationContext";
import { useSession } from "../app/lib/contexts/SessionContext";
import { useColorMode } from "../app/lib/ThemeRegistry";
import ConfigModal from "./ConfigModal";

interface AppHeaderProps {
  drawerWidth: number;
  onMenuClick: () => void;
}

interface CrumbItem {
  label: string;
  href?: string;
}

const ROUTE_MAP: Record<string, CrumbItem[]> = {
  "/": [{ label: "Executive Hub" }],
  "/agents": [
    { label: "Executive Hub", href: "/" },
    { label: "Agent Orchestration" },
  ],
  "/agents/config": [
    { label: "Executive Hub", href: "/" },
    { label: "Agent Orchestration", href: "/agents" },
    { label: "Studio" },
  ],
  "/datasources": [
    { label: "Executive Hub", href: "/" },
    { label: "Data Onboarding" },
  ],
  "/liability": [
    { label: "Executive Hub", href: "/" },
    { label: "EPR Liability & Sourcing" },
  ],
  "/auction": [
    { label: "Executive Hub", href: "/" },
    { label: "Double Auction" },
  ],
  "/audit": [
    { label: "Executive Hub", href: "/" },
    { label: "Quad-Core Audit" },
  ],
  "/hitl": [
    { label: "Executive Hub", href: "/" },
    { label: "HITL Console" },
  ],
  "/settlement": [
    { label: "Executive Hub", href: "/" },
    { label: "Escrow & Approval" },
  ],
  "/dispatch": [
    { label: "Executive Hub", href: "/" },
    { label: "CPCB Form-1 Vault" },
  ],
  "/organizations": [
    { label: "Executive Hub", href: "/" },
    { label: "Organizations & Team" },
  ],
  "/schedules": [
    { label: "Executive Hub", href: "/" },
    { label: "Schedules" },
  ],
};

function getCrumbsForPath(pathname: string): CrumbItem[] {
  if (ROUTE_MAP[pathname]) {
    return ROUTE_MAP[pathname];
  }
  // Fallback for subpaths
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Executive Hub" }];

  const crumbs: CrumbItem[] = [{ label: "Executive Hub", href: "/" }];
  let currentPath = "";
  segments.forEach((seg, i) => {
    currentPath += `/${seg}`;
    const isLast = i === segments.length - 1;
    const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
    crumbs.push(isLast ? { label } : { label, href: currentPath });
  });
  return crumbs;
}

export default function AppHeader({ drawerWidth, onMenuClick }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useSession();
  const { mode, toggleColorMode } = useColorMode();
  const { company } = useCompany();
  const [configOpen, setConfigOpen] = useState(false);

  // Avatar anchor menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleCloseMenu();
    logout();
    router.push("/login");
  };

  const crumbs = getCrumbsForPath(pathname || "/");

  // User initials
  const initials = user?.display_name
    ? user.display_name.slice(0, 2).toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "U";

  const orgName = company?.name || user?.organization_name || user?.org_id || "Enterprise";

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: 64 }}>
          {/* Mobile hamburger */}
          <IconButton
            color="inherit"
            edge="start"
            onClick={onMenuClick}
            sx={{ display: { md: "none" }, mr: 1 }}
          >
            <MenuIcon />
          </IconButton>

          {/* SynthetIQ Brand Logo Mark (for mobile or compact context) */}
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1, mr: 1 }}>
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: "6px",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 900,
                fontSize: "0.8rem",
              }}
            >
              S
            </Box>
          </Box>

          {/* Dynamic Breadcrumbs in Header */}
          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, overflow: "hidden" }}>
            <Breadcrumbs
              separator={<NavigateNextIcon sx={{ fontSize: 16, color: "text.secondary", opacity: 0.6 }} />}
              aria-label="breadcrumb"
              sx={{
                "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" },
                minWidth: 0,
              }}
            >
              {crumbs.map((crumb, idx) => {
                const isLast = idx === crumbs.length - 1;
                return isLast ? (
                  <Typography
                    key={crumb.label}
                    variant="body2"
                    fontWeight={700}
                    noWrap
                    sx={{ color: "text.primary", fontSize: { xs: "0.8rem", sm: "0.88rem" } }}
                  >
                    {crumb.label}
                  </Typography>
                ) : (
                  <Link
                    key={crumb.label}
                    component={NextLink}
                    href={crumb.href || "/"}
                    underline="hover"
                    noWrap
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      color: "text.secondary",
                      fontSize: { xs: "0.8rem", sm: "0.88rem" },
                      fontWeight: 500,
                      "&:hover": { color: "primary.light" },
                    }}
                  >
                    {idx === 0 && <HomeIcon sx={{ fontSize: 16 }} />}
                    {crumb.label}
                  </Link>
                );
              })}
            </Breadcrumbs>

            {/* Read-only Tenant Organization Badge */}
            <Chip
              icon={<BusinessIcon sx={{ fontSize: "0.85rem !important" }} />}
              label={orgName}
              size="small"
              variant="outlined"
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                fontWeight: 600,
                fontSize: "0.72rem",
                height: 24,
                borderColor: "divider",
                color: "text.secondary",
                maxWidth: 220,
              }}
            />

            {/* Industry Sector Badge */}
            {company?.industry_sector && (
              <Chip
                label={company.industry_sector}
                size="small"
                color="primary"
                variant="outlined"
                sx={{
                  display: { xs: "none", md: "inline-flex" },
                  fontWeight: 600,
                  fontSize: "0.68rem",
                  height: 22,
                }}
              />
            )}
          </Box>

          {/* Right Header Actions */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {/* Dark / Light Mode Toggle */}
            <Tooltip title={mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}>
              <IconButton color="inherit" onClick={toggleColorMode} size="small">
                {mode === "dark" ? (
                  <LightModeIcon sx={{ color: "#F59E0B", fontSize: 20 }} />
                ) : (
                  <DarkModeIcon sx={{ color: "#6366F1", fontSize: 20 }} />
                )}
              </IconButton>
            </Tooltip>

            {/* User Avatar with Profile & Logout Menu */}
            <Tooltip title="User Profile & Settings">
              <IconButton
                onClick={handleOpenMenu}
                size="small"
                sx={{
                  p: 0.3,
                  border: "2px solid",
                  borderColor: openMenu ? "primary.main" : "transparent",
                  transition: "all 0.15s ease",
                  "&:hover": { borderColor: "primary.light" },
                }}
                aria-controls={openMenu ? "user-account-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={openMenu ? "true" : undefined}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: "primary.main",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    boxShadow: "0 2px 6px rgba(99, 102, 241, 0.3)",
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* User Account Popover Menu */}
      <Menu
        id="user-account-menu"
        anchorEl={anchorEl}
        open={openMenu}
        onClose={handleCloseMenu}
        onClick={handleCloseMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            elevation: 4,
            sx: {
              mt: 1.2,
              minWidth: 260,
              p: 1,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              backgroundImage: "none",
            },
          },
        }}
      >
        {/* User Profile Card Header */}
        <Box sx={{ px: 1.5, py: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: "primary.main",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "1rem",
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ overflow: "hidden" }}>
              <Typography variant="subtitle2" fontWeight={700} noWrap>
                {user?.display_name || user?.email?.split("@")[0] || "Compliance User"}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", fontSize: "0.72rem" }}>
                {user?.email || "user@synthetiq.ai"}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap", mt: 0.5 }}>
            <Chip
              label={(user?.role || "viewer").toUpperCase()}
              size="small"
              color={user?.role === "admin" ? "primary" : user?.role === "auditor" ? "success" : "default"}
              sx={{ fontWeight: 700, fontSize: "0.65rem", height: 20 }}
            />
            <Chip
              icon={<BusinessIcon sx={{ fontSize: "0.75rem !important" }} />}
              label={orgName}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: "0.68rem", height: 20, maxWidth: 160 }}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 0.8 }} />

        {/* Engine Settings */}
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            setConfigOpen(true);
          }}
          sx={{ borderRadius: 1, py: 1, gap: 1.5 }}
        >
          <SettingsIcon fontSize="small" sx={{ color: "text.secondary" }} />
          <Typography variant="body2" fontWeight={500}>
            Engine Configuration
          </Typography>
        </MenuItem>

        <Divider sx={{ my: 0.8 }} />

        {/* Logout Option */}
        <MenuItem
          onClick={handleLogout}
          sx={{
            borderRadius: 1,
            py: 1,
            gap: 1.5,
            color: "error.main",
            "&:hover": { bgcolor: "error.lighter", opacity: 0.9 },
          }}
        >
          <LogoutIcon fontSize="small" color="error" />
          <Typography variant="body2" fontWeight={600} color="error">
            Sign Out / Logout
          </Typography>
        </MenuItem>
      </Menu>

      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </>
  );
}
