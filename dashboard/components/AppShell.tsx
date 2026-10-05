"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";

const DRAWER_WIDTH = 240;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
