"use client";

import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "../app/lib/contexts/SessionContext";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";
import { HEADER_H, findNav } from "./nav";

const PUBLIC_PATHS = ["/login", "/register", "/auth/accept-invite", "/auth/verify-email"];
const COLLAPSE_KEY = "synthetiq_nav_collapsed";

function PageBar({ pathname }: { pathname: string }) {
  const hit = findNav(pathname);
  if (!hit) return null;
  const small = { fontSize: "0.78rem" };
  return (
    <Box sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", px: { xs: 2, md: 3 }, py: 1 }}>
      <Breadcrumbs separator="/" aria-label="Breadcrumb">
        <Link component={NextLink} href="/" underline="hover" color="text.secondary" sx={small}>
          Home
        </Link>
        {hit.item.href !== "/" && (
          <Typography color="text.secondary" sx={small}>{hit.group}</Typography>
        )}
        <Typography color="text.primary" sx={{ ...small, fontWeight: 600 }}>{hit.item.label}</Typography>
      </Breadcrumbs>
    </Box>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user, token, loading } = useSession();

  const isPublicPage = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (!loading && !token && !user && !isPublicPage) {
      router.replace(pathname !== "/" ? `/login?next=${encodeURIComponent(pathname)}` : "/login");
    }
  }, [loading, token, user, isPublicPage, pathname, router]);

  const toggleNav = () => {
    if (!isDesktop) return setMobileOpen((o) => !o);
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  if (isPublicPage) {
    return <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>{children}</Box>;
  }

  if (loading || (!token && !user)) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default" }}>
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Verifying session
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader onMenuClick={toggleNav} />
      <AppSidebar
        collapsed={collapsed}
        isDesktop={isDesktop}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, pt: `${HEADER_H}px`, display: "flex", flexDirection: "column" }}>
        <PageBar pathname={pathname} />
        <Box sx={{ p: { xs: 2, md: 3 }, width: "100%", maxWidth: 1600, mx: "auto", flexGrow: 1 }}>{children}</Box>
      </Box>
    </Box>
  );
}
