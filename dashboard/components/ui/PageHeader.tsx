"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export interface PageHeaderProps {
  title: string;
  icon?: React.ReactNode;
  description?: string | React.ReactNode;
  actions?: React.ReactNode;
  tags?: React.ReactNode;
}

/**
 * Standard industrial page header with title, icon, descriptive subtitle, and actions.
 * Designed to sit immediately beneath AppShell's PageBar for crisp visual hierarchy.
 */
export default function PageHeader({
  title,
  icon,
  description,
  actions,
  tags,
}: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        gap: 2,
        pb: 1,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
          {icon && (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "primary.main",
              }}
            >
              {icon}
            </Box>
          )}
          <Typography
            variant="h5"
            component="h1"
            sx={{
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "text.primary",
            }}
          >
            {title}
          </Typography>
          {tags && (
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, ml: 0.5 }}>
              {tags}
            </Box>
          )}
        </Box>
        {description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, maxWidth: 840, lineHeight: 1.5 }}
          >
            {description}
          </Typography>
        )}
      </Box>

      {actions && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
}
