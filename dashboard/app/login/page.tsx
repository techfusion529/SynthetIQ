"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import SecurityIcon from "@mui/icons-material/Security";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import BusinessIcon from "@mui/icons-material/Business";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/contexts/SessionContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useSession();

  const [email, setEmail] = useState("compliance_officer@synthetiq.ai");
  const [password, setPassword] = useState("Password123!");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please provide your corporate email");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const ok = await login(email, password);
      if (ok) {
        router.push("/");
      } else {
        setError("Invalid credentials or user unauthorized");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to sign in. Please verify your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickFill = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("Password123!");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#0B0F19",
        backgroundImage: "radial-gradient(ellipse at 50% 20%, rgba(79, 70, 229, 0.15), transparent 70%)",
        p: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 480,
          width: "100%",
          bgcolor: "rgba(17, 24, 39, 0.8)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 3,
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.5)",
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: "rgba(79, 70, 229, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(79, 70, 229, 0.4)",
              }}
            >
              <SecurityIcon sx={{ color: "#818CF8", fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: "#F3F4F6", letterSpacing: "-0.02em" }}>
                SynthetIQ
              </Typography>
              <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                Autonomous EPR Compliance & Multi-Agent Engine
              </Typography>
            </Box>
          </Box>

          <Typography variant="h6" fontWeight={600} sx={{ mt: 3, mb: 0.5, color: "#E5E7EB" }}>
            Sign In to Enterprise Workspace
          </Typography>
          <Typography variant="body2" sx={{ color: "#9CA3AF", mb: 3 }}>
            Access tenant audits, dynamic agent orchestration, and regulatory vaults.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Corporate Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "rgba(255, 255, 255, 0.02)",
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.12)" },
                  "&:hover fieldset": { borderColor: "#818CF8" },
                },
              }}
            />

            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "rgba(255, 255, 255, 0.02)",
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.12)" },
                  "&:hover fieldset": { borderColor: "#818CF8" },
                },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
              sx={{
                mt: 1,
                py: 1.2,
                borderRadius: 2,
                fontWeight: 700,
                textTransform: "none",
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                boxShadow: "0 4px 14px 0 rgba(79, 70, 229, 0.39)",
                "&:hover": {
                  background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 100%)",
                },
              }}
            >
              {submitting ? "Authenticating..." : "Sign In to Tenant"}
            </Button>
          </Box>

          <Divider sx={{ my: 3, borderColor: "rgba(255, 255, 255, 0.08)" }}>
            <Typography variant="caption" sx={{ color: "#6B7280" }}>
              DEMO ROLES & WORKSPACES
            </Typography>
          </Divider>

          {/* Quick Login Chips for Pair Programming & Testing */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
              Quick test roles (Click to populate):
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Chip
                label="Admin / Compliance Officer"
                size="small"
                onClick={() => handleQuickFill("compliance_officer@synthetiq.ai")}
                sx={{ cursor: "pointer", bgcolor: "rgba(79,70,229,0.15)", color: "#A5B4FC", border: "1px solid rgba(79,70,229,0.3)" }}
              />
              <Chip
                label="Auditor (Physics / Fraud)"
                size="small"
                onClick={() => handleQuickFill("auditor@synthetiq.ai")}
                sx={{ cursor: "pointer", bgcolor: "rgba(16,185,129,0.15)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.3)" }}
              />
              <Chip
                label="Executive Viewer"
                size="small"
                onClick={() => handleQuickFill("board_viewer@synthetiq.ai")}
                sx={{ cursor: "pointer", bgcolor: "rgba(245,158,11,0.15)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.3)" }}
              />
            </Box>
          </Box>

          <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
              New organization?
            </Typography>
            <Button
              size="small"
              onClick={() => router.push("/register")}
              sx={{ color: "#818CF8", fontWeight: 600, textTransform: "none" }}
            >
              Onboard Organization →
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
