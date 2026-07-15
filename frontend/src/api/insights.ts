import { apiFetch } from "./http";

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
