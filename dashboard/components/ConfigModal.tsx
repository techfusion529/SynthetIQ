"use client";

import React, { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import TuneIcon from "@mui/icons-material/Tune";
import { useConfigService } from "../app/lib/hooks/useServices";
import { ApiError } from "../app/lib/services/base.service";

interface ConfigModalProps {
  open: boolean;
  onClose: () => void;
}

const JEV_MODES = [
  { value: "NIMBLE_PRIMARY",     label: "Nimble Primary (Ollama /v1/systemone)" },
  { value: "HYBRID_ENSEMBLE",    label: "Hybrid Ensemble (Nimble + IsolationForest + Physics)" },
  { value: "REFLEX_PHYSICS_ONLY", label: "Reflex Physics Only (Rules-based)" },
];

export default function ConfigModal({ open, onClose }: ConfigModalProps) {
  const configSvc = useConfigService();

  const [apiKey, setApiKey]     = useState("");
  const [model, setModel]       = useState("");
  const [jevMode, setJevMode]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [currentModel, setCurrentModel] = useState<string>("");

  // Load current config on open
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(false);
    setTestResult(null);
    configSvc.getConfig().then((cfg) => {
      setModel(cfg.gemini.model);
      setJevMode(cfg.jev_mode.mode);
      setCurrentModel(cfg.gemini.model);
    }).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await configSvc.updateConfig({
        gemini_api_key: apiKey || undefined,
        gemini_model: model || undefined,
        jev_mode: jevMode || undefined,
      });
      setSuccess(true);
      setApiKey("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestGemini = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await configSvc.testGemini(apiKey || undefined, model || undefined);
      setTestResult(res.status === "CONNECTED" ? `✓ Connected: ${res.displayName ?? model}` : `⚠ ${res.status}`);
    } catch (e) {
      setTestResult(`✗ ${e instanceof ApiError ? e.message : "Connection failed"}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TuneIcon color="primary" />
        Engine Configuration
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {error   && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">Configuration saved successfully.</Alert>}

        <Box>
          <Typography variant="overline" color="text.secondary">Gemini AI (System 2)</Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 1, alignItems: "center" }}>
            <Chip label={currentModel || "—"} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />
          </Box>
        </Box>

        <TextField
          label="Gemini API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          type="password"
          placeholder="AIzaSy… (leave blank to keep current)"
          fullWidth
          helperText="Get your key from aistudio.google.com/app/apikey"
        />

        <TextField
          label="Gemini Model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="gemini-3.8-flash"
          fullWidth
        />

        <FormControl fullWidth size="small">
          <InputLabel>Jev / Fraud Detection Mode</InputLabel>
          <Select value={jevMode} label="Jev / Fraud Detection Mode" onChange={(e) => setJevMode(e.target.value)}>
            {JEV_MODES.map((m) => (
              <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {testResult && (
          <Alert severity={testResult.startsWith("✓") ? "success" : "warning"} sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
            {testResult}
          </Alert>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={handleTestGemini} disabled={testing} variant="outlined" size="small" startIcon={testing ? <CircularProgress size={14} /> : undefined}>
          Test Connection
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
