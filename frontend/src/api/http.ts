export class ApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

import { getStoredToken } from "../auth/storage";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

type Json = unknown;

export async function apiFetch<T = Json>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const url = input.startsWith("http") ? input : `${API_BASE}${input}`;
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(typeof init?.headers === "object" && init.headers !== null
      ? Object.fromEntries(new Headers(init.headers).entries())
      : {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    ...init,
    headers,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => "");

  if (!res.ok) {
    const detail =
      typeof body === "object" && body && "detail" in (body as any)
        ? (body as any).detail
        : body;
    const detailStr =
      typeof detail === "string"
        ? detail
        : typeof detail === "object" && detail != null
          ? JSON.stringify(detail)
          : String(detail);
    const message = detailStr ? `Request failed (${res.status}): ${detailStr}` : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, detail);
  }

  return body as T;
}

