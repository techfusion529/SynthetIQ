"use client";

import React from "react";
import Chip, { ChipProps } from "@mui/material/Chip";

export interface StatusBadgeProps {
  status: string | null | undefined;
  size?: "small" | "medium";
  variant?: "filled" | "outlined";
  customLabel?: string;
}

export function getStatusColor(
  status: string | null | undefined
): "success" | "error" | "warning" | "info" | "default" {
  if (!status) return "default";
  const s = status.toUpperCase();

  // Success / verified
  if (
    s === "APPROVED" ||
    s === "COMPLETED" ||
    s === "VERIFIED" ||
    s === "RELEASED" ||
    s === "RESOLVED" ||
    s === "ACTIVE" ||
    s === "HEALTHY" ||
    s === "FILING_ACKNOWLEDGED"
  ) {
    return "success";
  }

  // Error / fraud / failure
  if (
    s === "HALTED_DUE_TO_FRAUD" ||
    s === "REJECTED" ||
    s === "FAILED" ||
    s === "DISPUTED" ||
    s === "ERROR" ||
    s === "SUSPENDED" ||
    s.includes("FRAUD") ||
    s.includes("FAIL")
  ) {
    return "error";
  }

  // Warning / attention required
  if (
    s === "PENDING_REVIEW" ||
    s === "IN_REVIEW" ||
    s === "ESCROW_LOCKED" ||
    s === "HALTED" ||
    s === "ACTION_REQUIRED"
  ) {
    return "warning";
  }

  // Running / active processing / info
  if (
    s === "RUNNING" ||
    s === "PENDING" ||
    s === "MATCHED" ||
    s === "IN_PROGRESS" ||
    s === "PROCESSING" ||
    s === "OPEN"
  ) {
    return "info";
  }

  return "default";
}

/**
 * Standard industrial status chip with square 2px geometry and normalized color schemes.
 */
export default function StatusBadge({
  status,
  size = "small",
  variant = "filled",
  customLabel,
}: StatusBadgeProps) {
  if (!status) return null;

  const color = getStatusColor(status);
  const displayLabel = customLabel ?? status.replace(/_/g, " ");

  return (
    <Chip
      label={displayLabel}
      size={size}
      color={color}
      variant={variant}
      sx={{
        height: size === "small" ? 20 : 24,
        fontSize: size === "small" ? "0.68rem" : "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        borderRadius: "2px",
      }}
    />
  );
}
