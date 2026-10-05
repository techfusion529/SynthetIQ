"use client";
import { createTheme } from "@mui/material/styles";

/**
 * SynthetIQ MUI v6 dark theme.
 * Primary  = indigo  #4f46e5
 * Secondary = cyan   #06b6d4
 * Background = #070b16
 */
const theme = createTheme({
  palette: {
    mode: "dark",
    primary:   { main: "#4f46e5", light: "#6366f1", dark: "#3730a3" },
    secondary: { main: "#06b6d4", light: "#22d3ee", dark: "#0891b2" },
    success:   { main: "#10b981" },
    warning:   { main: "#f59e0b" },
    error:     { main: "#f43f5e" },
    background: { default: "#070b16", paper: "#0f172a" },
    text:      { primary: "#f1f5f9", secondary: "#94a3b8" },
    divider:   "rgba(148,163,184,0.12)",
  },
  typography: {
    fontFamily: [
      "Inter",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      "sans-serif",
    ].join(","),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#0f172a",
          border: "1px solid rgba(148,163,184,0.10)",
          "&:hover": { borderColor: "rgba(79,70,229,0.35)" },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none", backgroundColor: "#0f172a" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, borderRadius: 10 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: "rgba(148,163,184,0.10)" },
        head: { fontWeight: 700, color: "#94a3b8", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em" },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 6, height: 6 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: "#070b16", borderRight: "1px solid rgba(148,163,184,0.10)" },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: "#070b16", backgroundImage: "none", borderBottom: "1px solid rgba(148,163,184,0.10)" },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: 8, fontSize: "0.75rem" },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundImage: "none", backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.12)" },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small", variant: "outlined" },
    },
    MuiSelect: {
      defaultProps: { size: "small" },
    },
  },
});

export default theme;
