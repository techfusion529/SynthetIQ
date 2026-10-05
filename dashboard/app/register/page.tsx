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
import BusinessIcon from "@mui/icons-material/Business";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
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
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#0B0F19",
        backgroundImage: "radial-gradient(ellipse at 50% 10%, rgba(99, 102, 241, 0.15), transparent 70%)",
        p: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 540,
          width: "100%",
          bgcolor: "rgba(17, 24, 39, 0.8)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 3,
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.5)",
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: "rgba(99, 102, 241, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(99, 102, 241, 0.4)",
              }}
            >
              <BusinessIcon sx={{ color: "#A5B4FC", fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: "#F3F4F6", letterSpacing: "-0.02em" }}>
                Onboard Enterprise
              </Typography>
              <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
                Create your tenant organization and multi-agent compliance workspace
              </Typography>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="subtitle2" sx={{ color: "#818CF8", fontWeight: 700, mt: 1 }}>
              Organization Details
            </Typography>

            <TextField
              label="Legal Enterprise Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Parle Agro Plastics Ltd"
              required
              fullWidth
              size="small"
            />

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <TextField
                select
                label="Industry Sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                size="small"
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
                onChange={(e) => setGstin(e.target.value)}
                placeholder="27AAACH1234F1Z5"
                size="small"
              />
            </Box>

            <Typography variant="subtitle2" sx={{ color: "#818CF8", fontWeight: 700, mt: 1 }}>
              Administrator Account
            </Typography>

            <TextField
              label="Full Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Rajesh Sharma"
              required
              fullWidth
              size="small"
            />

            <TextField
              label="Corporate Work Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="r.sharma@parleagro.com"
              required
              fullWidth
              size="small"
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
              disabled={submitting}
              endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
              sx={{
                mt: 1.5,
                py: 1.2,
                borderRadius: 2,
                fontWeight: 700,
                textTransform: "none",
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #4338CA 0%, #6D28D9 100%)",
                },
              }}
            >
              {submitting ? "Initializing Organization..." : "Create Tenant & Launch Workspace"}
            </Button>
          </Box>

          <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
              Already registered?{" "}
              <Button
                size="small"
                onClick={() => router.push("/login")}
                sx={{ color: "#818CF8", fontWeight: 600, textTransform: "none", p: 0 }}
              >
                Sign In
              </Button>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
