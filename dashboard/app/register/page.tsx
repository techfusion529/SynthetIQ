"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/contexts/SessionContext";

const SECTORS = [
  "FMCG",
  "Plastic Recycling",
  "Beverage & Bottling",
  "Packaging & Converting",
  "E-Commerce & Retail",
  "Automotive & Electronics",
  "Industrial Manufacturing",
];

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useSession();

  const [orgName, setOrgName] = useState("");
  const [sector, setSector] = useState("FMCG");
  const [gstin, setGstin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !email || !password || !displayName) {
      setError("Please fill out all required fields");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const ok = await register({
        organization_name: orgName,
        industry_sector: sector,
        gstin: gstin || undefined,
        display_name: displayName,
        email,
        password,
      });

      if (ok) {
        router.push("/");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to onboard organization. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
          maxWidth: 520,
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
              }}
            >
              SQ
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                Onboard Enterprise
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Configure your tenant organization and multi-agent compliance workspace
              </Typography>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ my: 2.5, borderRadius: 1.5 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Organization Legal Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              fullWidth
              size="small"
              placeholder="e.g. Acme Consumer Packaging Ltd"
            />

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <TextField
                select
                label="Industry Sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                size="small"
                fullWidth
              >
                {SECTORS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="GSTIN (Optional)"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                size="small"
                fullWidth
                placeholder="27AABCU9603R1ZM"
              />
            </Box>

            <TextField
              label="Administrator Full Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              fullWidth
              size="small"
              placeholder="e.g. Priya Sharma"
            />

            <TextField
              label="Corporate Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              size="small"
              placeholder="compliance@enterprise.com"
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
              {submitting ? "Provisioning Tenant..." : "Create Workspace"}
            </Button>
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
              Already have an enterprise account?
            </Typography>
            <Button
              size="small"
              onClick={() => router.push("/login")}
              sx={{ fontWeight: 600, textTransform: "none" }}
            >
              Sign In Instead →
            </Button>
          </Box>
        </CardContent>
      </Card>

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
