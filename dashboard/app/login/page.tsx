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
import Paper from "@mui/material/Paper";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
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
        setError("Invalid credentials or user unauthorized for this tenant");
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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: (t) => (t.palette.mode === "dark" ? "#0F172A" : "#F8FAFC"),
        p: 2,
        position: "relative",
      }}
    >
      {/* Background Accent Lines */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          bgcolor: "primary.main",
        }}
      />

      <Card
        variant="outlined"
        sx={{
          maxWidth: 460,
          width: "100%",
          bgcolor: "background.paper",
          borderRadius: 2,
          boxShadow: (t) =>
            t.palette.mode === "dark"
              ? "0 20px 40px -15px rgba(0,0,0,0.6)"
              : "0 10px 30px -10px rgba(0, 0, 0, 0.08)",
          borderColor: "divider",
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          {/* Brand Header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: "primary.main",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "1.1rem",
                letterSpacing: "-0.05em",
              }}
            >
              SQ
            </Box>
            <Box>
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{ letterSpacing: "-0.02em", lineHeight: 1.2 }}
              >
                SynthetIQ
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                Autonomous EPR Compliance & Multi-Agent Engine
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 3, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Sign In to Enterprise Workspace
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Authorized access for statutory reporting, telemetry audits & treasury escrow.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5 }}>
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
              placeholder="user@enterprise.com"
            />

            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              size="small"
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submitting}
              endIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardIcon fontSize="small" />}
              sx={{
                mt: 1,
                py: 1.1,
                fontWeight: 700,
                textTransform: "none",
                fontSize: "0.92rem",
              }}
            >
              {submitting ? "Verifying Credentials..." : "Sign In to Workspace"}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: "0.04em" }}>
              DEMO ROLES & QUICK ACCESS
            </Typography>
          </Divider>

          {/* Quick Login Chips */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Select persona to populate test credentials:
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Chip
                label="Compliance Officer (Admin)"
                size="small"
                variant="outlined"
                color="primary"
                onClick={() => handleQuickFill("compliance_officer@synthetiq.ai")}
                sx={{ cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}
              />
              <Chip
                label="Auditor (Physics / Fraud)"
                size="small"
                variant="outlined"
                color="secondary"
                onClick={() => handleQuickFill("auditor@synthetiq.ai")}
                sx={{ cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}
              />
              <Chip
                label="Executive Viewer"
                size="small"
                variant="outlined"
                onClick={() => handleQuickFill("board_viewer@synthetiq.ai")}
                sx={{ cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}
              />
            </Box>
          </Box>

          <Box
            sx={{
              mt: 3,
              pt: 2,
              borderTop: 1,
              borderColor: "divider",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              New enterprise tenant?
            </Typography>
            <Button
              size="small"
              onClick={() => router.push("/register")}
              sx={{ fontWeight: 600, textTransform: "none" }}
            >
              Onboard Organization →
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Trust & Security Badge */}
      <Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 2, color: "text.secondary" }}>
        <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <ShieldOutlinedIcon sx={{ fontSize: 14 }} /> CPCB Form-1 Digital Signature (DSC)
        </Typography>
        <Typography variant="caption">•</Typography>
        <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 14 }} /> ISO 27001 / SOC 2 Attested
        </Typography>
      </Box>
    </Box>
  );
}
