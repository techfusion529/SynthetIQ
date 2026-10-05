"use client";

import React, { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";

import BusinessIcon from "@mui/icons-material/Business";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";

import { useRouter } from "next/navigation";
import { useSession } from "../lib/contexts/SessionContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface OrgMember {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at?: string;
}

interface OrgRecord {
  org_id: string;
  name: string;
  industry_sector: string;
  gstin?: string;
  country: string;
  annual_plastic_footprint_tons: number;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const { user, token } = useSession();
  const orgId = user?.org_id || "ORG-DEV-001";

  const [activeTab, setActiveTab] = useState(0);

  // Orgs state
  const [organizations, setOrganizations] = useState<OrgRecord[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  // Users state
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("compliance_officer");
  const [submittingInvite, setSubmittingInvite] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchOrgs = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const resp = await fetch(`${API_BASE}/organizations/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setOrganizations(data);
      }
    } catch (e: any) {
      console.error("Failed to load organizations:", e);
    } finally {
      setLoadingOrgs(false);
    }
  }, [token]);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const resp = await fetch(`${API_BASE}/organizations/${orgId}/users/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setMembers(data);
      }
    } catch (e: any) {
      console.error("Failed to load members:", e);
    } finally {
      setLoadingMembers(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    fetchOrgs();
    fetchMembers();
  }, [fetchOrgs, fetchMembers]);

  const handleInviteUser = async () => {
    if (!newEmail || !newName) return;
    setSubmittingInvite(true);
    setFeedback(null);
    try {
      const resp = await fetch(`${API_BASE}/organizations/${orgId}/users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail,
          display_name: newName,
          role: newRole,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to invite user");
      }

      setFeedback({ type: "success", message: `User ${newEmail} added with role ${newRole}` });
      setInviteModalOpen(false);
      setNewEmail("");
      setNewName("");
      fetchMembers();
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleRoleChange = async (userId: string, targetRole: string) => {
    try {
      const resp = await fetch(`${API_BASE}/organizations/${orgId}/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: targetRole }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update role");
      }
      setFeedback({ type: "success", message: "Role updated successfully" });
      fetchMembers();
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this member?")) return;
    try {
      const resp = await fetch(`${API_BASE}/organizations/${orgId}/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to deactivate user");
      fetchMembers();
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message });
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 4 }}>
      <Breadcrumbs>
        <Link underline="hover" color="text.secondary" sx={{ cursor: "pointer" }} onClick={() => router.push("/")}>
          Executive Hub
        </Link>
        <Typography color="primary.light" fontWeight={600}>
          Organizations & Team Management
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <BusinessIcon color="primary" /> Enterprise Multi-Tenancy & Access Control
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage organization profiles, onboard entities, and assign Role-Based Access Control (RBAC) permissions.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          {activeTab === 1 && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setInviteModalOpen(true)}
              sx={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", textTransform: "none" }}
            >
              Add Team Member
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              fetchOrgs();
              fetchMembers();
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {feedback && (
        <Alert severity={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab icon={<BusinessIcon />} iconPosition="start" label="Organizations Directory" sx={{ textTransform: "none", fontWeight: 600 }} />
        <Tab icon={<PeopleAltIcon />} iconPosition="start" label={`Team Members & RBAC Roles (${members.length})`} sx={{ textTransform: "none", fontWeight: 600 }} />
      </Tabs>

      {/* Tab 0: Organizations List */}
      {activeTab === 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {loadingOrgs ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : organizations.length === 0 ? (
            <Alert severity="info">No registered organizations found.</Alert>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5 }}>
              {organizations.map((org) => (
                <Card
                  key={org.org_id}
                  variant="outlined"
                  sx={{ bgcolor: "rgba(255, 255, 255, 0.02)", borderColor: "rgba(255, 255, 255, 0.08)", borderRadius: 2.5 }}
                >
                  <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>{org.name}</Typography>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">{org.org_id}</Typography>
                      </Box>
                      <Chip label={org.industry_sector} size="small" color="primary" variant="outlined" />
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, fontSize: "0.8rem", mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">GSTIN:</Typography>
                      <Typography variant="caption" fontWeight={700} fontFamily="monospace">{org.gstin || "—"}</Typography>
                      <Typography variant="caption" color="text.secondary">Country:</Typography>
                      <Typography variant="caption" fontWeight={600}>{org.country}</Typography>
                      <Typography variant="caption" color="text.secondary">Annual Footprint:</Typography>
                      <Typography variant="caption" fontWeight={700} color="secondary.light">
                        {org.annual_plastic_footprint_tons?.toLocaleString()} Tons
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Tab 1: Team & Roles */}
      {activeTab === 1 && (
        <Card variant="outlined" sx={{ bgcolor: "rgba(255, 255, 255, 0.02)", borderColor: "rgba(255, 255, 255, 0.08)", borderRadius: 2.5 }}>
          <TableContainer component={Paper} sx={{ bgcolor: "transparent" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: "primary.light" }}>User</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "primary.light" }}>User ID</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "primary.light" }}>Assigned Role</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "primary.light" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "primary.light" }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight={700}>{m.display_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.email}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{m.user_id}</TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                        sx={{ fontSize: "0.8rem", height: 32 }}
                      >
                        <MenuItem value="admin">Administrator (Full Access)</MenuItem>
                        <MenuItem value="compliance_officer">Compliance Officer</MenuItem>
                        <MenuItem value="auditor">Auditor (Physics / Fraud Review)</MenuItem>
                        <MenuItem value="viewer">Viewer (Read-Only)</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Chip label={m.is_active ? "Active" : "Disabled"} size="small" color={m.is_active ? "success" : "default"} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Remove User">
                        <IconButton size="small" color="error" onClick={() => handleDeactivate(m.user_id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Invite Member Dialog */}
      <Dialog open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PersonAddIcon color="primary" /> Add Organization Member
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField
            label="Full Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
            size="small"
            required
          />
          <TextField
            label="Email Address"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            fullWidth
            size="small"
            required
          />
          <TextField
            select
            label="Initial Role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            fullWidth
            size="small"
          >
            <MenuItem value="admin">Admin (Manage org, sources & agents)</MenuItem>
            <MenuItem value="compliance_officer">Compliance Officer (Manage data & runs)</MenuItem>
            <MenuItem value="auditor">Auditor (SCADA physics review)</MenuItem>
            <MenuItem value="viewer">Viewer (Read-only)</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setInviteModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!newEmail || !newName || submittingInvite}
            onClick={handleInviteUser}
            sx={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
          >
            {submittingInvite ? "Adding..." : "Add Member"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
