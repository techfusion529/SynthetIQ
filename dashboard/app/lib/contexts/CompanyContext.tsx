"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Company } from "../types/company.types";
import { CompanyService } from "../services/company.service";
import { ApiError } from "../services/base.service";
import { useSession } from "./SessionContext";

const STORAGE_KEY = "synthetiq_selected_company";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface CompanyContextValue {
  companyId: string;
  company: Company | null;
  companies: Company[];
  loadingCompany: boolean;
  companyError: string | null;
  setCompanyId: (id: string) => void;
}

const CompanyContext = createContext<CompanyContextValue>({
  companyId: "",
  company: null,
  companies: [],
  loadingCompany: false,
  companyError: null,
  setCompanyId: () => {},
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { token } = useSession();
  const [companyId, setCompanyIdState] = useState<string>("");
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  // Fetch the full company list
  const fetchCompanies = useCallback(async (tok: string) => {
    if (!tok) return;
    try {
      const svc = new CompanyService(BASE_URL, tok);
      const list = await svc.listCompanies();
      setCompanies(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  // Fetch profile for a specific company_id
  const fetchCompanyProfile = useCallback(
    async (id: string, tok: string) => {
      if (!id || !tok) return;
      setLoadingCompany(true);
      setCompanyError(null);
      try {
        const svc = new CompanyService(BASE_URL, tok);
        const profile = await svc.getCompany(id);
        setCompany(profile);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Failed to load company";
        setCompanyError(msg);
        setCompany(null);
      } finally {
        setLoadingCompany(false);
      }
    },
    []
  );

  // On mount: restore from localStorage or fall back to first company
  useEffect(() => {
    if (!token) return;
    (async () => {
      const stored =
        typeof window !== "undefined"
          ? (localStorage.getItem(STORAGE_KEY) ?? "")
          : "";
      if (stored) {
        setCompanyIdState(stored);
        await fetchCompanyProfile(stored, token);
        await fetchCompanies(token);
      } else {
        const list = (await fetchCompanies(token)) ?? [];
        if (list.length > 0) {
          const firstId = list[0].company_id;
          setCompanyIdState(firstId);
          localStorage.setItem(STORAGE_KEY, firstId);
          await fetchCompanyProfile(firstId, token);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const setCompanyId = useCallback(
    (id: string) => {
      setCompanyIdState(id);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
      fetchCompanyProfile(id, token);
    },
    [token, fetchCompanyProfile]
  );

  return (
    <CompanyContext.Provider
      value={{ companyId, company, companies, loadingCompany, companyError, setCompanyId }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  return useContext(CompanyContext);
}
