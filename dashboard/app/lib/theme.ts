"use client";
import { createTheme, Theme } from "@mui/material/styles";

/**
 * SynthetIQ Professional Theme System
 * Inspired by ABB's industrial precision design language.
 *
 * Primary: ABB Red (#E0001B)
 * Secondary: Industrial Cobalt (#0072CE)
 * Shape: 6px precision radius
 * Typography: Clean Swiss industrial typography (Inter / Roboto)
 */
export function getTheme(mode: "dark" | "light"): Theme {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#E0001B",
        light: "#FF2D42",
        dark: "#B80016",
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: "#0072CE",
        light: "#38A1F3",
        dark: "#00569C",
        contrastText: "#FFFFFF",
      },
      success: {
        main: isDark ? "#10B981" : "#059669",
        light: "#34D399",
        dark: "#047857",
      },
      warning: {
        main: isDark ? "#F59E0B" : "#D97706",
        light: "#FBBF24",
        dark: "#B45309",
      },
      error: {
        main: isDark ? "#EF4444" : "#DC2626",
        light: "#F87171",
        dark: "#B91C1C",
      },
      info: {
        main: isDark ? "#06B6D4" : "#0284C7",
        light: "#22D3EE",
        dark: "#0369A1",
      },
      background: {
        default: isDark ? "#0B0F17" : "#F4F6F9",
        paper: isDark ? "#151B26" : "#FFFFFF",
      },
      text: {
        primary: isDark ? "#F8FAFC" : "#0F172A",
        secondary: isDark ? "#94A3B8" : "#64748B",
      },
      divider: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
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
      h1: { fontWeight: 700, letterSpacing: "-0.02em" },
      h2: { fontWeight: 700, letterSpacing: "-0.02em" },
      h3: { fontWeight: 600, letterSpacing: "-0.01em" },
      h4: { fontWeight: 600, letterSpacing: "-0.01em" },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600, letterSpacing: "0.01em" },
    },
    shape: { borderRadius: 6 },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: isDark ? "#151B26" : "#FFFFFF",
            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}`,
            borderRadius: 8,
            boxShadow: isDark
              ? "0 2px 8px rgba(0, 0, 0, 0.35)"
              : "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            "&:hover": {
              borderColor: isDark ? "rgba(224, 0, 27, 0.45)" : "rgba(224, 0, 27, 0.35)",
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: isDark ? "#151B26" : "#FFFFFF",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 6,
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
          },
          containedPrimary: {
            backgroundColor: "#E0001B",
            color: "#FFFFFF",
            "&:hover": {
              backgroundColor: "#B80016",
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 4,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottomColor: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.07)",
          },
          head: {
            fontWeight: 700,
            color: isDark ? "#94A3B8" : "#64748B",
            fontSize: "0.72rem",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 4, height: 6 },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? "#0B0F17" : "#FFFFFF",
            borderRight: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#0B0F17" : "#FFFFFF",
            color: isDark ? "#F8FAFC" : "#0F172A",
            backgroundImage: "none",
            borderBottom: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}`,
            boxShadow: isDark ? "none" : "0 1px 2px rgba(0, 0, 0, 0.03)",
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 4,
            fontSize: "0.75rem",
            backgroundColor: isDark ? "#1E293B" : "#0F172A",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
            backgroundColor: isDark ? "#151B26" : "#FFFFFF",
            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.10)"}`,
            borderRadius: 8,
          },
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
}

const defaultTheme = getTheme("dark");
export default defaultTheme;
