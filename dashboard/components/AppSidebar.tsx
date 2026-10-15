"use client";

import React from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "../app/lib/contexts/SessionContext";
import { HEADER_H, NAV, RAIL_MINI, RAIL_W, findNav } from "./nav";

const RAIL_BG = "#1C2329";
const RAIL_TEXT = "#C9D1D9";
const RAIL_MUTED = "#8B98A5";
const RAIL_LINE = "rgba(255,255,255,0.08)";

function NavList({ mini, onNavigate }: { mini: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useSession();
  const role = user?.role ?? "viewer"; // fail closed: no role, no privileged links
  const can = (roles?: string[]) => !roles || roles.includes(role);
  const active = findNav(pathname || "/")?.item.href;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box component="nav" aria-label="Primary" sx={{ flexGrow: 1, overflowY: "auto", py: 1 }}>
        {NAV.filter((g) => can(g.roles)).map((g, gi) => {
          const items = g.items.filter((i) => can(i.roles));
          if (!items.length) return null;
          return (
            <Box key={g.label} sx={{ mb: 1 }}>
              {mini ? (
                gi > 0 && <Divider sx={{ borderColor: RAIL_LINE, mx: 1.5, mb: 1 }} />
              ) : (
                <Typography sx={{ px: 2.5, pt: 1.5, pb: 0.5, fontSize: "0.75rem", fontWeight: 600, color: RAIL_MUTED }}>
                  {g.label}
                </Typography>
              )}
              <List disablePadding>
                {items.map((i) => {
                  const Icon = i.icon;
                  const selected = !i.external && active === i.href;
                  const linkProps = i.external
                    ? { component: "a", href: i.href, target: "_blank", rel: "noopener noreferrer" }
                    : { component: NextLink, href: i.href, onClick: onNavigate };
                  const btn = (
                    <ListItemButton
                      {...(linkProps as object)}
                      selected={selected}
                      aria-current={selected ? "page" : undefined}
                      sx={{
                        minHeight: 40,
                        px: mini ? 0 : 2.25,
                        justifyContent: mini ? "center" : "flex-start",
                        borderLeft: "3px solid transparent",
                        color: RAIL_TEXT,
                        "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
                        "&.Mui-selected": { bgcolor: "rgba(255,255,255,0.07)", borderLeftColor: "primary.light", color: "#FFFFFF" },
                        "&.Mui-selected:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: mini ? 0 : 36, color: "inherit" }}>
                        <Icon fontSize="small" />
                      </ListItemIcon>
                      {!mini && (
                        <>
                          <ListItemText primary={i.label} primaryTypographyProps={{ fontSize: "0.85rem", noWrap: true }} />
                          {i.external && <OpenInNewIcon sx={{ fontSize: 14, color: RAIL_MUTED }} />}
                        </>
                      )}
                    </ListItemButton>
                  );
                  return mini ? (
                    <Tooltip key={i.href} title={i.label} placement="right">
                      {btn}
                    </Tooltip>
                  ) : (
                    <React.Fragment key={i.href}>{btn}</React.Fragment>
                  );
                })}
              </List>
            </Box>
          );
        })}
      </Box>
      {!mini && (
        <Typography sx={{ p: 2, fontSize: "0.75rem", color: RAIL_MUTED, borderTop: `1px solid ${RAIL_LINE}` }}>
          SynthetIQ v0.2.0
        </Typography>
      )}
    </Box>
  );
}

interface Props {
  collapsed: boolean;
  isDesktop: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}

export default function AppSidebar({ collapsed, isDesktop, mobileOpen, onClose }: Props) {
  const w = isDesktop && collapsed ? RAIL_MINI : RAIL_W;
  return (
    <Drawer
      variant={isDesktop ? "permanent" : "temporary"}
      open={isDesktop || mobileOpen}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: isDesktop ? w : 0,
        flexShrink: 0,
        transition: "width 0.2s ease",
        "& .MuiDrawer-paper": {
          width: w,
          boxSizing: "border-box",
          top: isDesktop ? HEADER_H : 0,
          height: isDesktop ? `calc(100% - ${HEADER_H}px)` : "100%",
          bgcolor: RAIL_BG,
          color: RAIL_TEXT,
          borderRight: 0,
          overflowX: "hidden",
          transition: "width 0.2s ease",
        },
      }}
    >
      <NavList mini={isDesktop && collapsed} onNavigate={isDesktop ? undefined : onClose} />
    </Drawer>
  );
}
