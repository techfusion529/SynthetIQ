"use client";

/**
 * ThemeRegistry — Client Component wrapper for MUI ThemeProvider.
 * Provides ColorModeContext for real-time switching between dark and light modes,
 * persisted in localStorage.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getTheme } from "./theme";

interface ColorModeContextType {
  mode: "dark" | "light";
  toggleColorMode: () => void;
  setColorMode: (mode: "dark" | "light") => void;
}

const ColorModeContext = createContext<ColorModeContextType>({
  mode: "dark",
  toggleColorMode: () => {},
  setColorMode: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

const THEME_STORAGE_KEY = "synthetiq_color_mode";

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(THEME_STORAGE_KEY) as "dark" | "light" | null;
      if (savedMode === "light" || savedMode === "dark") {
        setMode(savedMode);
      } else if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
        setMode("light");
      }
    } catch {
      // localStorage unavailable or restricted
    }
    setMounted(true);
  }, []);

  const colorMode = useMemo<ColorModeContextType>(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((prev) => {
          const next = prev === "dark" ? "light" : "dark";
          try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
          } catch {
            // ignore
          }
          return next;
        });
      },
      setColorMode: (newMode: "dark" | "light") => {
        setMode(newMode);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, newMode);
        } catch {
          // ignore
        }
      },
    }),
    [mode]
  );

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
