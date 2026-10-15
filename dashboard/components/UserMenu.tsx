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
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import { useRouter } from "next/navigation";
import { useOrganization } from "../app/lib/contexts/OrganizationContext";
import { useSession } from "../app/lib/contexts/SessionContext";
import ConfigModal from "./ConfigModal";

/** Avatar trigger + account menu. Name and role sit beside the avatar on wider screens. */
export default function UserMenu() {
  const router = useRouter();
  const { user, logout } = useSession();
  const { company } = useOrganization();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const name = user?.display_name || user?.email?.split("@")[0] || "User";
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
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
        sx={{ gap: 1.25, pl: 1, pr: 0.75, py: 0.5, borderRadius: 1, textAlign: "left", "&:hover": { bgcolor: "action.hover" } }}
      >
        <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: "0.8rem", fontWeight: 600 }}>{initials}</Avatar>
        <Box sx={{ display: { xs: "none", md: "block" }, maxWidth: 160 }}>
          <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 600, lineHeight: 1.2 }}>{name}</Typography>
          <Typography noWrap sx={{ fontSize: "0.72rem", color: "text.secondary", textTransform: "capitalize", lineHeight: 1.2 }}>
            {role}
          </Typography>
        </Box>
        <ExpandMoreIcon fontSize="small" sx={{ display: { xs: "none", md: "block" }, color: "text.secondary" }} />
      </ButtonBase>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 260, border: 1, borderColor: "divider" } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
          <Typography noWrap sx={{ fontSize: "0.8rem", color: "text.secondary" }}>{user?.email}</Typography>
          <Box sx={{ display: "flex", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
            <Chip size="small" label={role} color="primary" sx={{ textTransform: "capitalize", height: 22 }} />
            {org && <Chip size="small" variant="outlined" label={org} sx={{ height: 22, maxWidth: 180 }} />}
          </Box>
        </Box>
        <Divider />
        {canConfig && (
          <MenuItem onClick={() => { close(); setConfigOpen(true); }}>
            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
            Engine configuration
          </MenuItem>
        )}
        <MenuItem onClick={signOut}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>

      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </>
  );
}
