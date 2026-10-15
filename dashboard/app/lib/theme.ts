"use client";
import { createTheme, Theme } from "@mui/material/styles";

/**
 * Industrial control-room theme: graphite rail, steel-blue accent, square 2px geometry,
 * dense tables. Red is reserved for alarms/errors only.
 */
export function getTheme(mode: "dark" | "light"): Theme {
  const d = mode === "dark";
  const line = d ? "#2C353D" : "#D5DBE1";
  const paper = d ? "#1A2128" : "#FFFFFF";
  const muted = d ? "#9AA7B3" : "#5B6773";

  return createTheme({
    palette: {
      mode,
      primary: { main: d ? "#4C9AE6" : "#0B63B6", contrastText: "#FFFFFF" },
      secondary: { main: muted },
      success: { main: d ? "#3FB868" : "#1E8E3E" },
      warning: { main: d ? "#E0A030" : "#C77700" },
      error: { main: d ? "#EF5350" : "#C62828" },
      info: { main: d ? "#4C9AE6" : "#0B63B6" },
      background: { default: d ? "#11161B" : "#EEF1F4", paper },
      text: { primary: d ? "#E6EBF0" : "#1B232A", secondary: muted },
      divider: line,
    },
    typography: {
      fontFamily: 'var(--font-plex), "IBM Plex Sans", "Segoe UI", Roboto, sans-serif',
      fontSize: 13,
      h4: { fontWeight: 600, fontSize: "1.5rem" },
      h5: { fontWeight: 600, fontSize: "1.25rem" },
      h6: { fontWeight: 600, fontSize: "1.05rem" },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 2 },
    components: {
      MuiCssBaseline: { styleOverrides: { body: { fontVariantNumeric: "tabular-nums" } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiCard: { styleOverrides: { root: { border: `1px solid ${line}`, boxShadow: "none" } } },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: line, padding: "8px 12px" },
          head: { fontWeight: 600, color: muted, backgroundColor: d ? "#1F272F" : "#F5F7F9" },
        },
      },
      MuiAppBar: {
        defaultProps: { color: "inherit" },
        styleOverrides: {
          root: {
            backgroundColor: paper,
            color: d ? "#E6EBF0" : "#1B232A",
            backgroundImage: "none",
            boxShadow: "none",
            borderBottom: `1px solid ${line}`,
          },
        },
      },
      MuiAlert: { styleOverrides: { root: { border: `1px solid ${line}` } } },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: "#1C2329", fontSize: "0.75rem" } } },
      MuiDialog: { styleOverrides: { paper: { border: `1px solid ${line}` } } },
      MuiTextField: { defaultProps: { size: "small" } },
      MuiSelect: { defaultProps: { size: "small" } },
    },
  });
}

const defaultTheme = getTheme("light");
export default defaultTheme;
