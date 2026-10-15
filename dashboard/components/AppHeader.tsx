"use client";

import React from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import { useOrganization } from "../app/lib/contexts/OrganizationContext";
import { useSession } from "../app/lib/contexts/SessionContext";
import { useColorMode } from "../app/lib/ThemeRegistry";
import UserMenu from "./UserMenu";
import { HEADER_H } from "./nav";

export default function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useSession();
  const { company } = useOrganization();
  const { mode, toggleColorMode } = useColorMode();
  const org = company?.name || user?.organization_name || user?.org_id || "";

  return (
    <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
      <Toolbar disableGutters sx={{ minHeight: HEADER_H, px: { xs: 1, sm: 2 }, gap: 1.5 }}>
        <Tooltip title="Toggle navigation">
          <IconButton edge="start" aria-label="Toggle navigation" onClick={onMenuClick}>
            <MenuIcon />
          </IconButton>
        </Tooltip>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            aria-hidden
            sx={{ width: 28, height: 28, bgcolor: "primary.main", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}
          >
            S
          </Box>
          <Box sx={{ lineHeight: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1.1 }}>SynthetIQ</Typography>
            <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.7rem", color: "text.secondary", lineHeight: 1.2 }}>
              EPR compliance
            </Typography>
          </Box>
        </Box>

        {org && (
          <>
            <Divider orientation="vertical" flexItem sx={{ my: 1.5, display: { xs: "none", md: "block" } }} />
            <Typography noWrap sx={{ display: { xs: "none", md: "block" }, fontSize: "0.85rem", color: "text.secondary", maxWidth: 320 }}>
              {org}
            </Typography>
          </>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title={mode === "dark" ? "Light theme" : "Dark theme"}>
          <IconButton aria-label="Toggle theme" onClick={toggleColorMode}>
            {mode === "dark" ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
