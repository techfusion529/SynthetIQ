"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

const TOKEN_KEY = "synthetiq_auth_token";
const USER_KEY = "synthetiq_auth_user";
const REFRESH_TOKEN_KEY = "synthetiq_refresh_token";

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
  tokenExpiry: number | null;
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
  setSession: (token: string, user: AuthUser, refreshToken?: string) => void;
}

const SessionContext = createContext<SessionContextValue>({
  token: "",
  user: null,
  isAuthenticated: false,
  loading: true,
  tokenExpiry: null,
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

/** Decode the exp claim from a JWT without any external library. */
function parseJwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    // Pad base64url to standard base64 before decoding
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(padded));
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

/** Write the auth_token cookie so Next.js proxy can read it server-side. */
function writeAuthCookie(token: string, maxAge: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `auth_token=${token}; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

/** Clear the auth_token cookie. */
function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = "auth_token=; SameSite=Strict; Path=/; Max-Age=0";
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string>("");
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [refreshToken, setRefreshTokenState] = useState<string>("");
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Ref to hold the current refresh token in async callbacks without stale closures
  const refreshTokenRef = useRef<string>("");

  // Initialize session from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY) ?? "";

      if (storedToken && storedUser) {
        const exp = parseJwtExp(storedToken);
        setTokenState(storedToken);
        setUserState(JSON.parse(storedUser));
        setRefreshTokenState(storedRefresh);
        refreshTokenRef.current = storedRefresh;
        setTokenExpiry(exp);

        // Sync cookie for proxy
        const cookieMaxAge = exp
          ? Math.max(0, exp - Math.floor(Date.now() / 1000))
          : 3600;
        writeAuthCookie(storedToken, cookieMaxAge);
      }
    } catch {
      // localStorage not available or parse error — leave state empty
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setTokenState("");
    setUserState(null);
    setRefreshTokenState("");
    refreshTokenRef.current = "";
    setTokenExpiry(null);
    clearAuthCookie();
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }, []);

  const setSession = useCallback(
    (newToken: string, newUser: AuthUser, newRefreshToken?: string) => {
      const exp = parseJwtExp(newToken);
      setTokenState(newToken);
      setUserState(newUser);
      setTokenExpiry(exp);

      const cookieMaxAge = exp
        ? Math.max(0, exp - Math.floor(Date.now() / 1000))
        : 3600;
      writeAuthCookie(newToken, cookieMaxAge);

      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
        if (newRefreshToken !== undefined) {
          localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
          setRefreshTokenState(newRefreshToken);
          refreshTokenRef.current = newRefreshToken;
        }
      }
    },
    []
  );

  // Auto-refresh: schedule a token refresh 5 minutes before expiry
  useEffect(() => {
    if (!token || !tokenExpiry) return;

    const msUntilRefresh = tokenExpiry * 1000 - Date.now() - 5 * 60 * 1000;

    const doRefresh = async () => {
      const currentRefreshToken = refreshTokenRef.current;
      if (!currentRefreshToken) {
        logout();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return;
      }

      try {
        const resp = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: currentRefreshToken }),
        });

        if (!resp.ok) {
          throw new Error(`Refresh failed: ${resp.status}`);
        }

        const data = await resp.json();
        setSession(data.access_token, data.user, data.refresh_token);
      } catch {
        // On any failure, clear session and redirect to login
        logout();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    };

    if (msUntilRefresh <= 0) {
      // Already past the refresh window — refresh immediately
      doRefresh();
      return;
    }

    const timerId = setTimeout(doRefresh, msUntilRefresh);
    return () => clearTimeout(timerId);
  }, [token, tokenExpiry, logout, setSession]);

  const login = useCallback(
    async (email: string, password?: string): Promise<boolean> => {
      setLoading(true);
      try {
        const resp = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(
            (err as { detail?: string }).detail || `Login failed (${resp.status})`
          );
        }

        const data = await resp.json();
        setSession(data.access_token, data.user, data.refresh_token);
        return true;
      } catch (err) {
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setSession]
  );

  const register = useCallback(
    async (regData: {
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
          throw new Error(
            (errorData as { detail?: string }).detail ||
              `Registration failed (${resp.status})`
          );
        }

        const data = await resp.json();
        setSession(data.access_token, data.user, data.refresh_token);
        return true;
      } catch (err) {
        console.error("Registration error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setSession]
  );

  return (
    <SessionContext.Provider
      value={{
        token,
        user,
        isAuthenticated: Boolean(token && user),
        loading,
        tokenExpiry,
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
