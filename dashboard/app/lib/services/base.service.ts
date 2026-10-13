/** BaseService — shared HTTP client with typed request, auth header injection, and ApiError. */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export abstract class BaseService {
  constructor(
    protected readonly baseUrl: string,
    protected readonly token: string
  ) {}

  protected async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    options?: { body?: unknown; params?: Record<string, string | number | boolean | undefined> }
  ): Promise<T> {
    if (!this.token || this.token.trim() === "") {
      throw new ApiError(401, "No auth token", `${this.baseUrl}${path}`);
    }

    // Build URL with query params
    let url = `${this.baseUrl}${path}`;
    if (options?.params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
      const qsStr = qs.toString();
      if (qsStr) url += `?${qsStr}`;
    }

    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
    };

    if (options?.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, init);

    // Validate Content-Type
    const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (ct && ct !== "application/json") {
      throw new ApiError(415, `Unexpected Content-Type: ${ct}`, url);
    }

    if (!res.ok) {
      // 410 Gone — old endpoint has been retired
      if (res.status === 410) {
        throw new ApiError(
          410,
          "This endpoint has moved. Please refresh the page.",
          url
        );
      }

      const body = await res.json().catch(() => ({}));
      const raw =
        (body as { detail?: unknown; message?: unknown }).detail ??
        (body as { message?: unknown }).message;
      const message =
        raw == null
          ? `HTTP ${res.status}`
          : typeof raw === "string"
          ? raw
          : JSON.stringify(raw);

      if (res.status === 401 && typeof window !== "undefined") {
        // Clear session state to match logout behaviour
        localStorage.removeItem("synthetiq_auth_token");
        localStorage.removeItem("synthetiq_auth_user");
        localStorage.removeItem("synthetiq_refresh_token");
        document.cookie = "auth_token=; SameSite=Strict; Path=/; Max-Age=0";
        window.location.href = "/login";
      }

      throw new ApiError(res.status, message, url);
    }

    // Empty body (e.g. 204) — return empty object cast to T
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }
}
