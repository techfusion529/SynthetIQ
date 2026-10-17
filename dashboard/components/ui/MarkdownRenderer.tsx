"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Strips verbose internal system headers such as:
 * "### [Google Cloud Vertex AI Model Garden (gemini-3.8-flash) Response]"
 * to avoid cluttering human-readable narratives.
 */
function cleanRawNarrative(text: string): string {
  if (!text) return "";
  return text
    .replace(/^#*\s*\[Google Cloud Vertex AI[^\]]+\]\s*/i, "")
    .replace(/^#*\s*\[Gemini[^\]]+Response\]\s*/i, "")
    .trim();
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const cleanedContent = cleanRawNarrative(content);

  return (
    <Box
      className={className}
      sx={{
        fontSize: "0.82rem",
        lineHeight: 1.55,
        color: "text.primary",
        "& > *:first-of-type": { mt: 0 },
        "& > *:last-of-type": { mb: 0 },
      }}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "text.primary",
                mt: 1.25,
                mb: 0.5,
                lineHeight: 1.3,
              }}
            >
              {children}
            </Typography>
          ),
          h2: ({ children }) => (
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                fontSize: "0.9rem",
                color: "text.primary",
                mt: 1,
                mb: 0.5,
                lineHeight: 1.3,
              }}
            >
              {children}
            </Typography>
          ),
          h3: ({ children }) => (
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                fontSize: "0.85rem",
                color: "primary.main",
                mt: 0.75,
                mb: 0.25,
                lineHeight: 1.3,
              }}
            >
              {children}
            </Typography>
          ),
          p: ({ children }) => (
            <Typography
              component="p"
              variant="body2"
              sx={{
                fontSize: "0.82rem",
                lineHeight: 1.5,
                mb: 0.5,
                color: "text.primary",
              }}
            >
              {children}
            </Typography>
          ),
          strong: ({ children }) => (
            <Box
              component="strong"
              sx={{
                fontWeight: 700,
                color: "text.primary",
              }}
            >
              {children}
            </Box>
          ),
          ul: ({ children }) => (
            <Box
              component="ul"
              sx={{
                pl: 2.2,
                my: 0.5,
                "& li": { mb: 0.25 },
              }}
            >
              {children}
            </Box>
          ),
          ol: ({ children }) => (
            <Box
              component="ol"
              sx={{
                pl: 2.2,
                my: 0.5,
                "& li": { mb: 0.25 },
              }}
            >
              {children}
            </Box>
          ),
          li: ({ children }) => (
            <Typography
              component="li"
              variant="body2"
              sx={{
                fontSize: "0.82rem",
                lineHeight: 1.45,
                color: "text.primary",
              }}
            >
              {children}
            </Typography>
          ),
          code: ({ children }) => (
            <Box
              component="code"
              sx={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.76rem",
                px: 0.6,
                py: 0.15,
                borderRadius: 0.75,
                bgcolor: (t) =>
                  t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
                border: "1px solid",
                borderColor: "divider",
                color: "primary.light",
              }}
            >
              {children}
            </Box>
          ),
          hr: () => <Divider sx={{ my: 1 }} />,
          blockquote: ({ children }) => (
            <Box
              sx={{
                borderLeft: "3px solid",
                borderColor: "primary.main",
                pl: 1.5,
                py: 0.25,
                my: 0.75,
                bgcolor: (t) =>
                  t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
                borderRadius: "0 4px 4px 0",
              }}
            >
              {children}
            </Box>
          ),
        }}
      >
        {cleanedContent}
      </ReactMarkdown>
    </Box>
  );
}
