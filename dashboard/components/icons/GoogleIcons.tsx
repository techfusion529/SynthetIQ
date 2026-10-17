"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function GeminiIcon({ size = 20, className }: { size?: number | string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
      className={className}
    >
      <title>Gemini</title>
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill="#3186FF"
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill="url(#gemini-grad-0)"
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill="url(#gemini-grad-1)"
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill="url(#gemini-grad-2)"
      />
      <defs>
        <linearGradient id="gemini-grad-0" x1="7" y1="15.5" x2="11" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gemini-grad-1" x1="8" y1="5.5" x2="11.5" y2="11" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gemini-grad-2" x1="3.5" y1="13.5" x2="17.5" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FABC12" />
          <stop offset="0.46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function GoogleCloudIcon({ size = 20, className }: { size?: number | string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
      className={className}
    >
      <title>Google Cloud</title>
      <path
        d="M15.961 7.327l2.086-2.086.14-.879C14.384.905 8.34 1.297 4.913 5.18A9.643 9.643 0 002.88 8.991l.747-.105 4.172-.688.322-.33c1.856-2.038 4.994-2.312 7.137-.578l.703.037z"
        fill="#EA4335"
      />
      <path
        d="M21.02 8.93a9.399 9.399 0 00-2.834-4.568L15.258 7.29a5.204 5.204 0 011.91 4.129v.52a2.606 2.606 0 012.607 2.605c0 1.44-1.167 2.577-2.606 2.577h-5.22l-.512.556v3.126l.513.49h5.219c3.743.03 6.802-2.952 6.83-6.695a6.778 6.778 0 00-2.98-5.668z"
        fill="#4285F4"
      />
      <path
        d="M6.738 21.293h5.212v-4.172H6.738c-.371 0-.731-.08-1.069-.234l-.74.227-2.1 2.086-.183.71a6.763 6.763 0 004.092 1.383z"
        fill="#34A853"
      />
      <path
        d="M6.738 7.759A6.778 6.778 0 002.646 19.91l3.023-3.023a2.606 2.606 0 113.448-3.448l3.023-3.023a6.771 6.771 0 00-5.402-2.657z"
        fill="#FBBC05"
      />
    </svg>
  );
}

interface PoweredByProps {
  variant?: "pill" | "badge" | "subtle" | "banner";
  showCloud?: boolean;
  sx?: Record<string, any>;
}

export function PoweredByGemini({ variant = "pill", showCloud = true, sx = {} }: PoweredByProps) {
  if (variant === "subtle") {
    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          color: "text.secondary",
          fontSize: "0.75rem",
          fontWeight: 600,
          ...sx,
        }}
      >
        <GeminiIcon size={16} />
        <span>Powered by Google Gemini</span>
        {showCloud && (
          <>
            <span style={{ opacity: 0.4 }}>•</span>
            <GoogleCloudIcon size={16} />
            <span>Google Cloud</span>
          </>
        )}
      </Box>
    );
  }

  if (variant === "banner") {
    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1.25,
          px: 1.75,
          py: 0.6,
          borderRadius: 2,
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(49, 134, 255, 0.08)" : "rgba(49, 134, 255, 0.05)"),
          border: "1px solid",
          borderColor: (t) => (t.palette.mode === "dark" ? "rgba(49, 134, 255, 0.25)" : "rgba(49, 134, 255, 0.2)"),
          backdropFilter: "blur(6px)",
          ...sx,
        }}
      >
        <GeminiIcon size={20} />
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              fontSize: "0.78rem",
              letterSpacing: "0.01em",
              color: (t) => (t.palette.mode === "dark" ? "#60A5FA" : "#2563EB"),
            }}
          >
            Powered by Google Gemini
          </Typography>
          <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1 }}>
            Vertex AI Model Garden &amp; Gemini 3.8 Flash
          </Typography>
        </Box>
        {showCloud && (
          <Box sx={{ pl: 0.75, borderLeft: "1px solid", borderColor: "divider", display: "flex", alignItems: "center" }}>
            <GoogleCloudIcon size={18} />
          </Box>
        )}
      </Box>
    );
  }

  // Default "pill" or "badge"
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.25,
        py: 0.4,
        borderRadius: "999px",
        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)"),
        border: "1px solid",
        borderColor: (t) => (t.palette.mode === "dark" ? "rgba(49, 134, 255, 0.25)" : "rgba(49, 134, 255, 0.2)"),
        transition: "all 0.2s ease",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(49, 134, 255, 0.1)" : "rgba(49, 134, 255, 0.06)"),
        },
        ...sx,
      }}
    >
      <GeminiIcon size={16} />
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontSize: "0.72rem",
          letterSpacing: "0.01em",
          color: "text.primary",
        }}
      >
        Powered by Google Gemini
      </Typography>
      {showCloud && (
        <>
          <Box component="span" sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "text.disabled", mx: 0.25 }} />
          <GoogleCloudIcon size={15} />
          <Typography variant="caption" sx={{ fontSize: "0.68rem", color: "text.secondary", fontWeight: 600 }}>
            Google Cloud
          </Typography>
        </>
      )}
    </Box>
  );
}
