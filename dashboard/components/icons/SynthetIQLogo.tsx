"use client";

import React from "react";
import { useTheme } from "@mui/material/styles";

interface SynthetIQLogoProps {
  height?: number | string;
  adaptive?: boolean;
  className?: string;
}

export function SynthetIQLogo({
  height = 34,
  adaptive = true,
  className,
}: SynthetIQLogoProps) {
  const theme = useTheme();
  const isDark = theme?.palette?.mode === "dark";
  const stemColor = adaptive ? (isDark ? "#F8FAFC" : "#1E293B") : "#64748B";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 385 100"
      height={height}
      style={{ width: "auto", display: "block", flexShrink: 0 }}
      fill="none"
      className={className}
      aria-label="SynthetIQ"
    >
      <defs>
        <linearGradient id="headerLogoCore" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        <linearGradient id="headerLogoRight" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
      </defs>

      {/* LEFT: GEOMETRIC RECYCLE + AI ICON */}
      <g transform="translate(4, 2) scale(0.80)">
        {/* Top Arrow */}
        <path
          d="M30 50 L50 18 C54.5 11 65.5 11 70 18 L84 40"
          stroke="url(#headerLogoCore)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M72 39 L85 42 L87 29"
          stroke="#2563EB"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Bottom-Right Arrow */}
        <path
          d="M92 54 L103 72 C107.5 79.5 102 89 93 89 H66"
          stroke="url(#headerLogoRight)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M74 80 L64 89 L74 98"
          stroke="#1D4ED8"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Bottom-Left Arrow */}
        <path
          d="M48 89 H27 C18 89 12.5 79.5 17 72 L25 59"
          stroke="url(#headerLogoCore)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 64 L26 57 L31 69"
          stroke="#38BDF8"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Center AI Star */}
        <path
          d="M60 35 C60 53 60 53 78 53 C60 53 60 53 60 71 C60 53 60 53 42 53 C60 53 60 53 60 35 Z"
          transform="translate(0, 6)"
          fill="url(#headerLogoCore)"
        />

        {/* Mini AI Sparkle */}
        <path
          d="M76 34 C76 39.5 76 39.5 81.5 39.5 C76 39.5 76 39.5 76 45 C76 39.5 76 39.5 70.5 39.5 C76 39.5 76 39.5 76 34 Z"
          fill="#38BDF8"
        />
      </g>

      {/* RIGHT: ALIGNED BRAND TYPOGRAPHY BLOCK */}
      <g transform="translate(114, 0)">
        {/* Heading: SynthetIQ */}
        <text
          x="0"
          y="58"
          fontFamily="'Google Sans', 'IBM Plex Sans', 'Inter', -apple-system, sans-serif"
          fontSize="48"
          fontWeight="700"
        >
          <tspan fill={stemColor}>Synthet</tspan>
          <tspan fill="url(#headerLogoCore)" fontWeight="800">
            IQ
          </tspan>
        </text>

        {/* AI Sparkle Accent above Q */}
        <path
          d="M248 14 C248 19.5 248 19.5 253.5 19.5 C248 19.5 248 19.5 248 25 C248 19.5 248 19.5 242.5 19.5 C248 19.5 248 19.5 248 14 Z"
          fill="#38BDF8"
        />

        {/* Structural Divider Hairline */}
        <rect x="2" y="67" width="240" height="2" rx="1" fill="#3B82F6" opacity="0.45" />
        <rect x="2" y="67" width="64" height="2" rx="1" fill="#4285F4" />

        {/* 4-Word Subtitle */}
        <text
          x="2"
          y="81"
          fontFamily="'IBM Plex Mono', 'Inter', monospace"
          fontSize="8.5"
          fontWeight="600"
          fill="#3B82F6"
        >
          AUTONOMOUS CIRCULAR COMPLIANCE ECOSYSTEM
        </text>
      </g>
    </svg>
  );
}

export function SynthetIQIcon({
  size = 32,
  className,
}: {
  size?: number | string;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="SynthetIQ Icon"
    >
      <defs>
        <linearGradient id="headerIconTop" x1="25" y1="15" x2="95" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>

        <linearGradient id="headerIconRight" x1="100" y1="45" x2="55" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        <linearGradient id="headerIconLeft" x1="50" y1="100" x2="20" y2="35" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        <linearGradient id="headerIconAiCore" x1="40" y1="40" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>

      <path
        d="M30 50 L50 18 C54.5 11 65.5 11 70 18 L84 40"
        stroke="url(#headerIconTop)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M72 39 L85 42 L87 29"
        stroke="#2563EB"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M92 54 L103 72 C107.5 79.5 102 89 93 89 H66"
        stroke="url(#headerIconRight)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M74 80 L64 89 L74 98"
        stroke="#1D4ED8"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M48 89 H27 C18 89 12.5 79.5 17 72 L25 59"
        stroke="url(#headerIconLeft)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 64 L26 57 L31 69"
        stroke="#38BDF8"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M60 35 C60 53 60 53 78 53 C60 53 60 53 60 71 C60 53 60 53 42 53 C60 53 60 53 60 35 Z"
        transform="translate(0, 6)"
        fill="url(#headerIconAiCore)"
      />

      <path
        d="M76 34 C76 39.5 76 39.5 81.5 39.5 C76 39.5 76 39.5 76 45 C76 39.5 76 39.5 70.5 39.5 C76 39.5 76 39.5 76 34 Z"
        fill="#38BDF8"
      />
    </svg>
  );
}
