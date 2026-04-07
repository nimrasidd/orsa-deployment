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

/** Authenticated GET returning raw bytes (e.g. file download). */
export async function apiFetchBlob(
  input: string
): Promise<{ blob: Blob; filename?: string }> {
  const url = input.startsWith("http") ? input : `${API_BASE}${input}`;
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { method: "GET", headers });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail: unknown = text;
    try {
      detail = text ? JSON.parse(text) : text;
    } catch {
      /* keep text */
    }
    const detailStr =
      typeof detail === "object" && detail != null && "detail" in (detail as Record<string, unknown>)
        ? String((detail as { detail: unknown }).detail)
        : String(detail ?? text);
    throw new ApiError(
      detailStr ? `Request failed (${res.status}): ${detailStr}` : `Request failed (${res.status})`,
      res.status,
      detail
    );
  }

  const cd = res.headers.get("Content-Disposition");
  const m = cd?.match(/filename="([^"]+)"/i) ?? cd?.match(/filename\*=UTF-8''([^;]+)/i);
  const filename = m?.[1] ? decodeURIComponent(m[1]) : undefined;
  const blob = await res.blob();
  return { blob, filename };
}

