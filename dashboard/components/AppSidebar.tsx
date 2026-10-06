"use client";

import React from "react";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ScaleIcon from "@mui/icons-material/Scale";
import GavelIcon from "@mui/icons-material/Gavel";
import RadarIcon from "@mui/icons-material/Radar";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import DescriptionIcon from "@mui/icons-material/Description";
import BusinessIcon from "@mui/icons-material/Business";
import ScheduleIcon from "@mui/icons-material/Schedule";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import TuneIcon from "@mui/icons-material/Tune";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "../app/lib/contexts/SessionContext";

interface AppSidebarProps {
  drawerWidth: number;
  mobileOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: "Executive Hub",       href: "/",              icon: <DashboardIcon />,             roles: [] },
  { label: "Agent Orchestration", href: "/agents",        icon: <MemoryIcon />,                roles: [] },
  { label: "Agent Studio",        href: "/agents/config", icon: <TuneIcon />,                  roles: ["admin", "compliance_officer"] },
  { label: "Data Sources",        href: "/datasources",   icon: <StorageIcon />,               roles: ["admin", "compliance_officer"] },
  { label: "Liability & Sourcing", href: "/liability",    icon: <ScaleIcon />,                 roles: [] },
  { label: "Double Auction",       href: "/auction",      icon: <GavelIcon />,                 roles: [] },
  { label: "Quad-Core Audit",      href: "/audit",        icon: <RadarIcon />,                 roles: [] },
  { label: "Escrow & Approval",    href: "/settlement",   icon: <AccountBalanceWalletIcon />,  roles: [] },
  { label: "CPCB Form-1 Vault",    href: "/dispatch",     icon: <DescriptionIcon />,           roles: [] },
  { label: "Organizations & Team", href: "/organizations", icon: <BusinessIcon />,             roles: ["admin", "compliance_officer"] },
  { label: "Schedules",            href: "/schedules",    icon: <ScheduleIcon />,              roles: ["admin"] },
];

function SidebarContent({ drawerWidth, onClose }: { drawerWidth: number; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user } = useSession();
  const role = user?.role || (token ? "admin" : "viewer");

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.length === 0 || item.roles.includes(role)
  );

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ px: 2 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: "0.12em", color: "text.secondary", textTransform: "uppercase" }}
        >
          EPR Platform
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, pt: 1, flexGrow: 1 }}>
        {visibleItems.map((item) => (
          <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={isActive(item.href)}
              onClick={() => {
                router.push(item.href);
                onClose();
              }}
              sx={{
                borderRadius: 2,
                "&.Mui-selected": {
                  bgcolor: "rgba(79,70,229,0.15)",
                  "& .MuiListItemIcon-root": { color: "primary.light" },
                  "& .MuiListItemText-primary": { color: "primary.light", fontWeight: 700 },
                },
                "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 500 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      {/* Ingress Web Gateways */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: "0.1em", color: "text.secondary", textTransform: "uppercase", fontSize: "0.7rem" }}
        >
          Web Ingress Control
        </Typography>
      </Box>
      <List sx={{ px: 1, pb: 1 }}>
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component="a"
            href="/temporal"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ borderRadius: 2, "&:hover": { bgcolor: "rgba(255,255,255,0.05)" } }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "secondary.light" }}>
              <MemoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Temporal UI"
              primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 500 }}
            />
            <OpenInNewIcon sx={{ fontSize: "0.9rem", color: "text.secondary" }} />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component="a"
            href="/grafana"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ borderRadius: 2, "&:hover": { bgcolor: "rgba(255,255,255,0.05)" } }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "warning.light" }}>
              <RadarIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Grafana Metrics"
              primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 500 }}
            />
            <OpenInNewIcon sx={{ fontSize: "0.9rem", color: "text.secondary" }} />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component="a"
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ borderRadius: 2, "&:hover": { bgcolor: "rgba(255,255,255,0.05)" } }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "success.light" }}>
              <DescriptionIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="FastAPI Docs"
              primaryTypographyProps={{ fontSize: "0.82rem", fontWeight: 500 }}
            />
            <OpenInNewIcon sx={{ fontSize: "0.9rem", color: "text.secondary" }} />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          v0.2.0 · CPCB PWM 2026
        </Typography>
      </Box>
    </Box>
  );
}

export default function AppSidebar({ drawerWidth, mobileOpen, onClose }: AppSidebarProps) {
  const drawerSx = { width: drawerWidth, flexShrink: 0, "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" } };

  return (
    <>
      {/* Mobile drawer */}
      <Drawer variant="temporary" open={mobileOpen} onClose={onClose} ModalProps={{ keepMounted: true }} sx={{ display: { xs: "block", md: "none" }, ...drawerSx }}>
        <SidebarContent drawerWidth={drawerWidth} onClose={onClose} />
      </Drawer>
      {/* Desktop drawer */}
      <Drawer variant="permanent" sx={{ display: { xs: "none", md: "block" }, ...drawerSx }} open>
        <SidebarContent drawerWidth={drawerWidth} onClose={() => {}} />
      </Drawer>
    </>
  );
}
