"use client";

/**
 * ThemeRegistry — Client Component wrapper for MUI ThemeProvider.
 * Required for MUI v6 with Next.js 14 App Router so the emotion cache
 * is correctly initialised server-side and hydrated client-side.
 */
import React from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
