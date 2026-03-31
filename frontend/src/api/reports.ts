import { apiFetch } from "./http";

export type ReportNodeRow = {
  id: string;
  upload_id: string;
  code: string;
  level: number;
  parent_code: string | null;
  description: string | null;
  value: string | number | null;
  sheet_name: string | null;
  cell_ref: string | null;
  created_at: string;
  report_key: string;
  version_no: number;
  original_filename: string | null;
  uploaded_at: string;
  company_name: string | null;
};

export async function listReportNodes(params?: {
  upload_id?: string;
  report_key?: string;
  limit?: number;
}): Promise<{ items: ReportNodeRow[]; count: number }> {
  const usp = new URLSearchParams();
  if (params?.upload_id) usp.set("upload_id", params.upload_id);
  if (params?.report_key) usp.set("report_key", params.report_key);
  if (params?.limit != null) usp.set("limit", String(params.limit));
  const qs = usp.toString();
  return apiFetch<{ items: ReportNodeRow[]; count: number }>(`/reports${qs ? `?${qs}` : ""}`);
}

export type PeriodGroup = "year" | "quarter" | "month";

export type ChartDataPoint = {
  year: number;
  value: number;
  label: string;
  upload_id: string;
  /** Bar label: calendar month, quarter (e.g. 2024 Q1), or year string. */
  period?: string;
  month?: number | null;
  quarter?: number | null;
};

export type ChartTimePeriodParams = {
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  year_from?: number;
  year_to?: number;
  report_month?: number;
  quarter?: number;
  /** X-axis bucket: year | quarter | month (default quarter). */
  period_group?: PeriodGroup;
};

export type ChartScopeParams = {
  report_key?: string;
  company_id?: string;
  region_id?: string;
  country_id?: string;
  model_id?: string;
  latest_only?: boolean;
  node_code?: string;
};

export async function getChartData(params?: ChartScopeParams & ChartTimePeriodParams): Promise<ChartDataPoint[]> {
  const usp = new URLSearchParams();
  if (params?.report_key) usp.set("report_key", params.report_key);
  if (params?.company_id) usp.set("company_id", params.company_id);
  if (params?.region_id) usp.set("region_id", params.region_id);
  if (params?.country_id) usp.set("country_id", params.country_id);
  if (params?.model_id) usp.set("model_id", params.model_id);
  if (params?.latest_only === true) usp.set("latest_only", "true");
  if (params?.node_code) usp.set("node_code", params.node_code);
  if (params?.date_from) usp.set("date_from", params.date_from);
  if (params?.date_to) usp.set("date_to", params.date_to);
  if (params?.year_from != null) usp.set("year_from", String(params.year_from));
  if (params?.year_to != null) usp.set("year_to", String(params.year_to));
  if (params?.report_month != null) usp.set("report_month", String(params.report_month));
  if (params?.quarter != null) usp.set("quarter", String(params.quarter));
  usp.set("period_group", params?.period_group ?? "quarter");
  const qs = usp.toString();
  return apiFetch<ChartDataPoint[]>(`/reports/chart-data${qs ? `?${qs}` : ""}`);
}

export type ChartTableRow = {
  name: string;
  code: string;
  level: number;
  parent_name: string;
  values: Record<string, number>;
};

export type ChartTableData = {
  years: number[];
  /** When grouping is quarter or month, column headers (e.g. 2024 Q1, 2024-01). */
  periods?: string[] | null;
  rows: ChartTableRow[];
};

export async function getChartTable(params?: ChartScopeParams & ChartTimePeriodParams): Promise<ChartTableData> {
  const usp = new URLSearchParams();
  if (params?.report_key) usp.set("report_key", params.report_key);
  if (params?.company_id) usp.set("company_id", params.company_id);
  if (params?.region_id) usp.set("region_id", params.region_id);
  if (params?.country_id) usp.set("country_id", params.country_id);
  if (params?.model_id) usp.set("model_id", params.model_id);
  if (params?.latest_only === true) usp.set("latest_only", "true");
  if (params?.node_code) usp.set("node_code", params.node_code);
  if (params?.date_from) usp.set("date_from", params.date_from);
  if (params?.date_to) usp.set("date_to", params.date_to);
  if (params?.year_from != null) usp.set("year_from", String(params.year_from));
  if (params?.year_to != null) usp.set("year_to", String(params.year_to));
  if (params?.report_month != null) usp.set("report_month", String(params.report_month));
  if (params?.quarter != null) usp.set("quarter", String(params.quarter));
  usp.set("period_group", params?.period_group ?? "quarter");
  const qs = usp.toString();
  return apiFetch<ChartTableData>(`/reports/chart-table${qs ? `?${qs}` : ""}`);
}
