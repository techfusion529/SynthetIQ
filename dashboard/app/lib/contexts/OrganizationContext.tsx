"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Organization as OrgType } from "../types/organization.types";
import { OrganizationService } from "../services/organization.service";
import { ApiError } from "../services/base.service";
import { useSession } from "./SessionContext";

const STORAGE_KEY = "synthetiq_selected_org";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Minimal org shape exposed by the context. */
export interface Organization {
  id: string;
  name: string;
  org_type?: string;
  status?: string;
  /** Convenience alias — same as id. Kept so existing callers using company_id still compile. */
  company_id?: string;
  /** Forwarded API fields so existing page/component code keeps compiling. */
  gstin?: string;
  industry_sector?: string;
}

interface OrganizationContextValue {
  /** The currently selected organisation. */
  currentOrg: Organization | null;
  /** All organisations available to the current user. */
  orgs: Organization[];
  setCurrentOrg: (org: Organization) => void;
  isLoading: boolean;
  error: string | null;

  // ── Backward-compat aliases (previously from CompanyContext) ──────────────
  /** Same as `currentOrg?.id ?? ""`. */
  companyId: string;
  /** Same as `currentOrg`. */
  company: Organization | null;
  /** Same as `orgs`. */
  companies: Organization[];
  /** Same as `isLoading`. */
  loadingCompany: boolean;
  /** Same as `error`. */
  companyError: string | null;
  /** Selects the org whose `id` equals the given string. */
  setCompanyId: (id: string) => void;
}

const OrganizationContext = createContext<OrganizationContextValue>({
  currentOrg: null,
  orgs: [],
  setCurrentOrg: () => {},
  isLoading: false,
  error: null,
  companyId: "",
  company: null,
  companies: [],
  loadingCompany: false,
  companyError: null,
  setCompanyId: () => {},
});

/** Maps the full API Organization shape to the slimmer context shape. */
function toContextOrg(o: OrgType): Organization {
  return {
    id: o.org_id,
    name: o.name,
    org_type: o.role,
    status: o.is_active ? "active" : "inactive",
    company_id: o.org_id,
    gstin: o.gstin,
    industry_sector: o.industry_sector,
  };
}

export function OrganizationProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { token, user } = useSession();
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrgs = useCallback(async (tok: string, userOrgId?: string) => {
    if (!tok) return;
    setIsLoading(true);
    setError(null);
    try {
      const svc = new OrganizationService(BASE_URL, tok);
      const list = await svc.listOrgs();
      const mapped = list.map(toContextOrg);
      setOrgs(mapped);

      // Lock to user's assigned organization from authenticated session
      const targetOrgId = userOrgId || (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) ?? "" : "");
      let selected = mapped.find((o) => o.id === targetOrgId) ?? null;

      if (!selected && userOrgId) {
        selected = {
          id: userOrgId,
          name: user?.organization_name || userOrgId,
          company_id: userOrgId,
        };
      } else if (!selected && mapped.length > 0) {
        selected = mapped[0];
      }

      setCurrentOrgState(selected);

      if (selected && typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, selected.id);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to load organizations";
      setError(msg);
      if (userOrgId) {
        setCurrentOrgState({
          id: userOrgId,
          name: user?.organization_name || userOrgId,
          company_id: userOrgId,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!token) return;
    fetchOrgs(token, user?.org_id);
  }, [token, user?.org_id, fetchOrgs]);

  const setCurrentOrg = useCallback((org: Organization) => {
    setCurrentOrgState(org);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, org.id);
    }
  }, []);

  /** Compat helper: select an org by its id string. */
  const setCompanyId = useCallback(
    (id: string) => {
      const found = orgs.find((o) => o.id === id) ?? null;
      if (found) setCurrentOrg(found);
    },
    [orgs, setCurrentOrg]
  );

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        orgs,
        setCurrentOrg,
        isLoading,
        error,
        // backward-compat aliases
        companyId: currentOrg?.id ?? "",
        company: currentOrg,
        companies: orgs,
        loadingCompany: isLoading,
        companyError: error,
        setCompanyId,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextValue {
  return useContext(OrganizationContext);
}
