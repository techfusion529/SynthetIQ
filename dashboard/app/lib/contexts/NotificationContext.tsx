"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  timestamp: number;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  notify: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const COLOR_MAP: Record<NotificationType, { border: string; bgLight: string; bgDark: string; icon: string }> = {
  success: {
    border: "#10B981",
    bgLight: "rgba(240, 253, 244, 0.95)",
    bgDark: "rgba(6, 78, 59, 0.90)",
    icon: "#10B981",
  },
  error: {
    border: "#EF4444",
    bgLight: "rgba(254, 242, 242, 0.95)",
    bgDark: "rgba(127, 29, 29, 0.90)",
    icon: "#EF4444",
  },
  warning: {
    border: "#F59E0B",
    bgLight: "rgba(255, 251, 235, 0.95)",
    bgDark: "rgba(120, 53, 15, 0.90)",
    icon: "#F59E0B",
  },
  info: {
    border: "#3B82F6",
    bgLight: "rgba(239, 246, 255, 0.95)",
    bgDark: "rgba(30, 58, 138, 0.90)",
    icon: "#3B82F6",
  },
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const add = useCallback(
    (type: NotificationType, message: string, title?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const item: NotificationItem = {
        id,
        type,
        message,
        title: title || (type.charAt(0).toUpperCase() + type.slice(1)),
        timestamp: Date.now(),
      };

      setNotifications((prev) => [item, ...prev].slice(0, 5)); // Keep max 5 visible

      // Auto dismiss after 5.5s
      setTimeout(() => {
        dismiss(id);
      }, 5500);
    },
    [dismiss]
  );

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const notify = {
    success: (msg: string, title?: string) => add("success", msg, title),
    error: (msg: string, title?: string) => add("error", msg, title),
    warning: (msg: string, title?: string) => add("warning", msg, title),
    info: (msg: string, title?: string) => add("info", msg, title),
  };

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss, clearAll }}>
      {children}
      {/* Top-Right Notification Banner Container */}
      <Box
        sx={{
          position: "fixed",
          top: 16,
          right: 20,
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
          width: { xs: "calc(100vw - 32px)", sm: 380 },
          maxWidth: "100%",
          pointerEvents: "none",
        }}
      >
        {notifications.map((item) => {
          const cfg = COLOR_MAP[item.type];
          return (
            <Collapse key={item.id} in appear timeout={300}>
              <Paper
                elevation={6}
                sx={{
                  pointerEvents: "auto",
                  borderLeft: `4px solid ${cfg.border}`,
                  bgcolor: (t) => (t.palette.mode === "dark" ? cfg.bgDark : cfg.bgLight),
                  color: "text.primary",
                  backdropFilter: "blur(12px)",
                  boxShadow: (t) =>
                    t.palette.mode === "dark"
                      ? "0 10px 25px -5px rgba(0,0,0,0.6)"
                      : "0 10px 25px -5px rgba(0,0,0,0.12)",
                  p: 1.5,
                  borderRadius: 1.5,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.25,
                }}
              >
                <Box sx={{ mt: 0.25, color: cfg.icon, display: "grid", placeItems: "center" }}>
                  {item.type === "success" && <CheckCircleOutlineIcon fontSize="small" />}
                  {item.type === "error" && <ErrorOutlineIcon fontSize="small" />}
                  {item.type === "warning" && <WarningAmberIcon fontSize="small" />}
                  {item.type === "info" && <InfoOutlinedIcon fontSize="small" />}
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  {item.title && (
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, lineHeight: 1.2, mb: 0.25 }}>
                      {item.title}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: "0.78rem", color: "text.primary", wordBreak: "break-word", lineHeight: 1.35 }}>
                    {item.message}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label="Close notification"
                  onClick={() => dismiss(item.id)}
                  sx={{ p: 0.25, mt: -0.25, mr: -0.25, color: "text.secondary" }}
                >
                  <CloseIcon sx={{ fontSize: "1rem" }} />
                </IconButton>
              </Paper>
            </Collapse>
          );
        })}
      </Box>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Graceful fallback dummy if outside provider
    return {
      notifications: [],
      notify: {
        success: console.log,
        error: console.error,
        warning: console.warn,
        info: console.info,
      },
      dismiss: () => {},
      clearAll: () => {},
    };
  }
  return ctx;
}
