"use client";

import React, { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import { useRouter } from "next/navigation";
import { useOrganization } from "../app/lib/contexts/OrganizationContext";
import { useSession } from "../app/lib/contexts/SessionContext";
import { useColorMode } from "../app/lib/ThemeRegistry";
import ConfigModal from "./ConfigModal";

/** Avatar trigger + account menu. Theme toggle and user info live in the popover. */
export default function UserMenu() {
  const router = useRouter();
  const { user, logout } = useSession();
  const { company } = useOrganization();
  const { mode, toggleColorMode } = useColorMode();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const name = user?.display_name || user?.email?.split("@")[0] || "User";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const role = (user?.role || "viewer").replace(/_/g, " ");
  const org = company?.name || user?.organization_name || user?.org_id || "";
  const canConfig = user?.role === "admin" || user?.role === "platform_admin";

  const close = () => setAnchor(null);
  const signOut = () => {
    close();
    logout();
    router.replace("/login");
  };

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        sx={{
          p: 0.5,
          borderRadius: "50%",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: "primary.main",
            fontSize: "0.85rem",
            fontWeight: 700,
            border: "1.5px solid",
            borderColor: "divider",
          }}
        >
          {initials}
        </Avatar>
      </ButtonBase>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 280,
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
        <Box sx={{ px: 2, py: 1.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{name}</Typography>
          <Typography noWrap sx={{ fontSize: "0.8rem", color: "text.secondary", mt: 0.25 }}>
            {user?.email}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, mt: 1.25, flexWrap: "wrap" }}>
            <Chip size="small" label={role} color="primary" sx={{ textTransform: "capitalize", height: 22 }} />
            {org && <Chip size="small" variant="outlined" label={org} sx={{ height: 22, maxWidth: 190 }} />}
          </Box>
        </Box>

        <Divider />

        {/* Theme mode toggle switch */}
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            "&:hover": { bgcolor: "action.hover" },
            cursor: "pointer",
          }}
          onClick={toggleColorMode}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {mode === "dark" ? (
              <DarkModeIcon fontSize="small" sx={{ color: "primary.light" }} />
            ) : (
              <LightModeIcon fontSize="small" sx={{ color: "warning.main" }} />
            )}
            <Box>
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>Dark Theme</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                {mode === "dark" ? "Enabled" : "Disabled (Light mode)"}
              </Typography>
            </Box>
          </Box>
          <Switch
            size="small"
            checked={mode === "dark"}
            onChange={toggleColorMode}
            inputProps={{ "aria-label": "Toggle dark theme" }}
          />
        </Box>

        <Divider />

        {canConfig && (
          <MenuItem
            onClick={() => {
              close();
              setConfigOpen(true);
            }}
          >
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            Engine configuration
          </MenuItem>
        )}

        <MenuItem onClick={signOut}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>

      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </>
  );
}
