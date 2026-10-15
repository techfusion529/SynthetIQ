"use client";

import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";

export interface StatCardProps {
  label: string;
  value?: string | number | null;
  unit?: string;
  icon?: React.ReactNode;
  color?: string;
  loading?: boolean;
  error?: string | null;
  subtitle?: string;
  badge?: React.ReactNode;
}

/**
 * Standard industrial KPI card with tabular-numeric display and crisp hairline borders.
 * Adapts seamlessly across light and dark theme modes.
 */
export default function StatCard({
  label,
  value,
  unit,
  icon,
  color,
  loading = false,
  error,
  subtitle,
  badge,
}: StatCardProps) {
  const accentColor = color ?? "primary.main";

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        transition: "border-color 0.15s ease",
        "&:hover": {
          borderColor: accentColor,
        },
      }}
    >
      <CardContent sx={{ p: "16px !important" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontSize: "0.7rem",
            }}
          >
            {label}
          </Typography>
          {badge ? (
            badge
          ) : icon ? (
            <Box sx={{ color: accentColor, opacity: 0.85, display: "flex", alignItems: "center" }}>
              {icon}
            </Box>
          ) : null}
        </Box>

        {loading ? (
          <Box sx={{ mt: 1.5 }}>
            <Skeleton variant="text" width="60%" height={38} />
            <Skeleton variant="text" width="40%" height={18} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 1, py: 0.25, px: 1, fontSize: "0.72rem" }}>
            {error}
          </Alert>
        ) : (
          <Box sx={{ mt: 1.25 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 0.75 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  fontFamily: 'var(--font-plex), "IBM Plex Sans", monospace',
                  fontVariantNumeric: "tabular-nums",
                  color: color || "text.primary",
                  lineHeight: 1.15,
                }}
              >
                {value ?? "—"}
              </Typography>
              {unit && (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 600,
                    fontFamily: 'var(--font-plex), "IBM Plex Sans", sans-serif',
                  }}
                >
                  {unit}
                </Typography>
              )}
            </Box>

            {subtitle && (
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  display: "block",
                  mt: 0.5,
                  fontSize: "0.72rem",
                  lineHeight: 1.4,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
