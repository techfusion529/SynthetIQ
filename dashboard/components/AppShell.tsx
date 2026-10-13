"use client";

import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "../app/lib/contexts/SessionContext";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";

const DRAWER_WIDTH = 240;

const PUBLIC_PATHS = ["/login", "/register", "/auth/accept-invite", "/auth/verify-email"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, loading } = useSession();

  const isPublicPage = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname?.startsWith(p + "/") || pathname?.startsWith(p + "?")
  );

  useEffect(() => {
    if (!loading && !token && !user && !isPublicPage) {
      const loginUrl = pathname && pathname !== "/" ? `/login?next=${encodeURIComponent(pathname)}` : "/login";
      router.replace(loginUrl);
    }
  }, [loading, token, user, isPublicPage, pathname, router]);

  // Public auth pages (login, register) render full-bleed without app header or sidebar
  if (isPublicPage) {
    return <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>{children}</Box>;
  }

  // While verifying session, render a clean centered splash loader to prevent unauthenticated flash
  if (loading || (!token && !user)) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          gap: 2,
        }}
      >
        <CircularProgress size={32} color="primary" />
        <Typography variant="body2" color="text.secondary">
          Authenticating SynthetIQ Session...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader drawerWidth={DRAWER_WIDTH} onMenuClick={() => setMobileOpen(true)} />
      <AppSidebar
        drawerWidth={DRAWER_WIDTH}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Toolbar /> {/* spacer so content clears the AppBar */}
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, width: "100%", mx: "auto", flexGrow: 1 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
