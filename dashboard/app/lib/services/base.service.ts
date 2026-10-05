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
      let msg = res.statusText;
      try {
        const err = await res.json();
        msg = err?.detail ?? err?.message ?? msg;
      } catch {
        // ignore parse failure
      }
      throw new ApiError(res.status, msg, url);
    }

    // Empty body (e.g. 204) — return empty object cast to T
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }
}
