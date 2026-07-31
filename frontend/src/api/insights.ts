import { apiFetch } from "./http";
import { getStoredToken } from "../auth/storage";

export type InsightMetric = {
  code: string;
  name: string;
  value: number | null;
  change_pct: number | null;
  period: string;
};

export type InsightsSummary = {
  company_name: string | null;
  reporting_period: string | null;
  headline_metrics: InsightMetric[];
  top_movers: InsightMetric[];
  alerts: string[];
  narrative: string;
  generated_at: string;
  source_upload_id: string | null;
  llm_used: boolean;
  upload_count: number;
};

export async function getInsightsSummary(params?: {
  model_id?: string;
  report_key?: string;
  company_id?: string;
}): Promise<InsightsSummary> {
  const usp = new URLSearchParams();
  if (params?.model_id) usp.set("model_id", params.model_id);
  if (params?.report_key) usp.set("report_key", params.report_key);
  if (params?.company_id) usp.set("company_id", params.company_id);
  const qs = usp.toString();
  return apiFetch<InsightsSummary>(`/insights/summary${qs ? `?${qs}` : ""}`);
}

export type StreamInsightsHandlers = {
  onSummary?: (summary: InsightsSummary) => void;
  onToken?: (chunk: string) => void;
  onDone?: (payload: { llm_used: boolean; narrative: string }) => void;
  onError?: (message: string) => void;
};

/** Consume SSE from GET /insights/summary/stream. Returns an abort function. */
export function streamInsightsSummary(
  params: {
    model_id?: string;
    report_key?: string;
    company_id?: string;
  },
  handlers: StreamInsightsHandlers
): () => void {
  const usp = new URLSearchParams();
  if (params.model_id) usp.set("model_id", params.model_id);
  if (params.report_key) usp.set("report_key", params.report_key);
  if (params.company_id) usp.set("company_id", params.company_id);
  const qs = usp.toString();
  const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  const url = `${API_BASE}/insights/summary/stream${qs ? `?${qs}` : ""}`;
  const token = getStoredToken();
  const ctrl = new AbortController();

  void (async () => {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        handlers.onError?.(`Stream failed (${res.status})`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventName = "message";

      const flushBlock = (block: string) => {
        if (!block.trim()) return;
        let ev = eventName;
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) ev = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        const data = dataLines.join("\n");
        if (ev === "summary") {
          try {
            handlers.onSummary?.(JSON.parse(data) as InsightsSummary);
          } catch {
            /* ignore */
          }
        } else if (ev === "token") {
          // token payload is raw text (may be JSON-string escaped if we sent json)
          try {
            const parsed = JSON.parse(data);
            handlers.onToken?.(typeof parsed === "string" ? parsed : data);
          } catch {
            handlers.onToken?.(data);
          }
        } else if (ev === "done") {
          try {
            handlers.onDone?.(JSON.parse(data) as { llm_used: boolean; narrative: string });
          } catch {
            handlers.onDone?.({ llm_used: false, narrative: data });
          }
        } else if (ev === "error") {
          try {
            const p = JSON.parse(data) as { message?: string };
            handlers.onError?.(p.message ?? data);
          } catch {
            handlers.onError?.(data);
          }
        }
        eventName = "message";
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const block of parts) flushBlock(block);
      }
      if (buffer.trim()) flushBlock(buffer);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") return;
      handlers.onError?.(e instanceof Error ? e.message : String(e));
    }
  })();

  return () => ctrl.abort();
}
