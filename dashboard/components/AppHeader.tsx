"use client";

import React, { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Alert from "@mui/material/Alert";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import SecurityIcon from "@mui/icons-material/Security";
import LogoutIcon from "@mui/icons-material/Logout";
import { useRouter } from "next/navigation";
import { useCompany } from "../app/lib/contexts/CompanyContext";
import { useSession } from "../app/lib/contexts/SessionContext";
import ConfigModal from "./ConfigModal";

interface AppHeaderProps {
  drawerWidth: number;
  onMenuClick: () => void;
}

export default function AppHeader({ drawerWidth, onMenuClick }: AppHeaderProps) {
  const router = useRouter();
  const { user, logout } = useSession();
  const { companyId, company, companies, loadingCompany, companyError, setCompanyId } =
    useCompany();
  const [configOpen, setConfigOpen] = useState(false);

  const handleCompanyChange = (e: SelectChangeEvent<string>) => {
    setCompanyId(e.target.value);
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` } }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          {/* Mobile hamburger */}
          <IconButton
            color="inherit"
            edge="start"
            onClick={onMenuClick}
            sx={{ display: { md: "none" }, mr: 1 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <SecurityIcon sx={{ color: "primary.light", mr: 0.5 }} />
          <Typography variant="h6" fontWeight={700} noWrap sx={{ flexGrow: 0, mr: 2 }}>
            SynthetIQ
          </Typography>

          {/* Company selector */}
          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
            <Select
              value={companyId}
              onChange={handleCompanyChange}
              displayEmpty
              disabled={companies.length === 0}
              size="small"
              sx={{ minWidth: 220, bgcolor: "rgba(255,255,255,0.04)", "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" } }}
            >
              {companies.length === 0 ? (
                <MenuItem value="" disabled>No companies found</MenuItem>
              ) : (
                companies.map((c) => (
                  <MenuItem key={c.company_id} value={c.company_id}>
                    {c.name}
                  </MenuItem>
                ))
              )}
            </Select>

            {/* GSTIN badge or spinner */}
            {loadingCompany ? (
              <CircularProgress size={16} color="secondary" />
            ) : companyError ? (
              <Chip label="—" size="small" color="error" variant="outlined" />
            ) : company?.gstin ? (
              <Chip
                label={company.gstin}
                size="small"
                variant="outlined"
                sx={{ fontFamily: "monospace", fontSize: "0.7rem", borderColor: "divider", color: "text.secondary" }}
              />
            ) : null}

            {/* Sector badge */}
            {company?.industry_sector && !loadingCompany && (
              <Chip
                label={company.industry_sector}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontSize: "0.7rem" }}
              />
            )}
          </Box>

          {/* User profile & role badge */}
          {user && (
            <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1 }}>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: "block", color: "text.primary" }}>
                  {user.display_name || user.email.split("@")[0]}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.68rem" }}>
                  {user.email}
                </Typography>
              </Box>
              <Chip
                label={user.role.toUpperCase()}
                size="small"
                color={user.role === "admin" ? "primary" : user.role === "auditor" ? "success" : "default"}
                sx={{ fontWeight: 700, fontSize: "0.65rem", height: 22 }}
              />
            </Box>
          )}

          {/* Settings icon */}
          <Tooltip title="Engine configuration">
            <IconButton color="inherit" onClick={() => setConfigOpen(true)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          {/* Logout icon */}
          <Tooltip title="Sign Out">
            <IconButton
              color="inherit"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>

        {/* API_URL missing banner */}
        {!process.env.NEXT_PUBLIC_API_URL && (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            NEXT_PUBLIC_API_URL is not configured. API calls will fail.
          </Alert>
        )}
      </AppBar>

      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </>
  );
}
