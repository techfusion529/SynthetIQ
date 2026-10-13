"use client";
import { createTheme, Theme } from "@mui/material/styles";

/**
 * SynthetIQ Professional Theme System
 *
 * Primary: Indigo (#6366F1 / #4F46E5)
 * Secondary: Cyan (#06B6D4)
 * Precision dark (#0B0F17) and clean light (#F4F6F9) modes.
 */
export function getTheme(mode: "dark" | "light"): Theme {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? "#6366F1" : "#4F46E5",
        light: "#818CF8",
        dark: "#3730A3",
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: "#06B6D4",
        light: "#22D3EE",
        dark: "#0891B2",
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
              borderColor: isDark ? "rgba(99, 102, 241, 0.45)" : "rgba(79, 70, 229, 0.35)",
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
            backgroundColor: isDark ? "#6366F1" : "#4F46E5",
            color: "#FFFFFF",
            "&:hover": {
              backgroundColor: isDark ? "#4F46E5" : "#4338CA",
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
