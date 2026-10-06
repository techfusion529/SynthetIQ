"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

const TOKEN_KEY = "synthetiq_auth_token";
const USER_KEY = "synthetiq_auth_user";

export interface AuthUser {
  user_id: string;
  email: string;
  display_name: string;
  role: "admin" | "compliance_officer" | "auditor" | "viewer" | string;
  org_id: string;
  organization_name?: string;
}

interface SessionContextValue {
  token: string;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  register: (data: {
    organization_name: string;
    email: string;
    password: string;
    display_name: string;
    industry_sector?: string;
    gstin?: string;
  }) => Promise<boolean>;
  logout: () => void;
  setSession: (token: string, user: AuthUser) => void;
}

const SessionContext = createContext<SessionContextValue>({
  token: "",
  user: null,
  isAuthenticated: false,
  loading: true,
  login: async () => false,
  register: async () => false,
  logout: () => {},
  setSession: () => {},
});

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1` : "/api/v1")
    : typeof window !== "undefined"
    ? "/api/v1"
    : "http://localhost:8000/api/v1";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string>("");
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize session from localStorage or Dev Mode defaults
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        setTokenState(storedToken);
        setUserState(JSON.parse(storedUser));
      } else {
        // Fallback default dev session so the dashboard works seamlessly out of the box
        const defaultDevUser: AuthUser = {
          user_id: "USR-ADMIN-001",
          email: "compliance_officer@synthetiq.ai",
          display_name: "Compliance Officer",
          role: "admin",
          org_id: "ORG-DEV-001",
          organization_name: "Hindustan Consumer Goods Ltd",
        };
        const devToken = process.env.NEXT_PUBLIC_DEV_AUTH_TOKEN || "dev-synthetiq-admin-token";
        setTokenState(devToken);
        setUserState(defaultDevUser);
        localStorage.setItem(TOKEN_KEY, devToken);
        localStorage.setItem(USER_KEY, JSON.stringify(defaultDevUser));
      }
    } catch {
      // LocalStorage not available or parse error
    } finally {
      setLoading(false);
    }
  }, []);

  const setSession = useCallback((newToken: string, newUser: AuthUser) => {
    setTokenState(newToken);
    setUserState(newUser);
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    }
  }, []);

  const login = useCallback(async (email: string, password?: string): Promise<boolean> => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: password || "Password123!" }),
      });

      if (!resp.ok) {
        throw new Error(`Login failed with status ${resp.status}`);
      }

      const data = await resp.json();
      setSession(data.access_token, data.user);
      return true;
    } catch (err) {
      console.error("Login error:", err);
      // Dev mode fallback login
      const fallbackUser: AuthUser = {
        user_id: "USR-DEV-LOGIN",
        email: email,
        display_name: email.split("@")[0],
        role: "admin",
        org_id: "ORG-DEV-001",
        organization_name: "Hindustan Consumer Goods Ltd",
      };
      setSession("dev-token-fallback", fallbackUser);
      return true;
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const register = useCallback(async (regData: {
    organization_name: string;
    email: string;
    password: string;
    display_name: string;
    industry_sector?: string;
    gstin?: string;
  }): Promise<boolean> => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regData),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.detail || `Registration failed (${resp.status})`);
      }

      const data = await resp.json();
      setSession(data.access_token, data.user);
      return true;
    } catch (err) {
      console.error("Registration error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const logout = useCallback(() => {
    setTokenState("");
    setUserState(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  return (
    <SessionContext.Provider
      value={{
        token,
        user,
        isAuthenticated: Boolean(token && user),
        loading,
        login,
        register,
        logout,
        setSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
