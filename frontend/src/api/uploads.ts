import { apiFetch } from "./http";
import type { ReportNodeOut, TreeNode, UploadOut } from "../types";

export async function listUploads(params?: {
  report_key?: string;
  latestOnly?: boolean;
  region_id?: string;
  country_id?: string;
  model_id?: string;
  company_id?: string;
  report_year?: number;
  report_month?: number;
}): Promise<UploadOut[]> {
  const usp = new URLSearchParams();
  if (params?.report_key) usp.set("report_key", params.report_key);
  if (typeof params?.latestOnly === "boolean") usp.set("latestOnly", String(params.latestOnly));
  if (params?.region_id) usp.set("region_id", params.region_id);
  if (params?.country_id) usp.set("country_id", params.country_id);
  if (params?.model_id) usp.set("model_id", params.model_id);
  if (params?.company_id) usp.set("company_id", params.company_id);
  if (params?.report_year != null) usp.set("report_year", String(params.report_year));
  if (params?.report_month != null) usp.set("report_month", String(params.report_month));
  const qs = usp.toString();
  return apiFetch<UploadOut[]>(`/uploads${qs ? `?${qs}` : ""}`);
}

export type UploadPreviewItem = {
  code: string;
  description?: string | null;
  sheet_name: string;
  cell_ref: string;
  value: string | null;
};

export async function previewUpload(file: File, modelId?: string): Promise<{
  items: UploadPreviewItem[];
  file_sheets?: string[];
}> {
  const form = new FormData();
  form.append("file", file);
  if (modelId) form.append("model_id", modelId);
  return apiFetch<{ items: UploadPreviewItem[]; file_sheets?: string[] }>(`/uploads/preview`, {
    method: "POST",
    body: form
  });
}

export async function createUpload(input: {
  file: File;
  report_key: string;
  notes?: string;
  use_mapping?: boolean;
  region_id?: string;
  country_id?: string;
  model_id?: string;
  model_id?: string;
  company_id?: string;
  report_year?: number;
  report_month?: number;
}): Promise<UploadOut> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("report_key", input.report_key);
  if (input.notes) form.append("notes", input.notes);
  form.append("use_mapping", String(input.use_mapping ?? true));
  if (input.region_id) form.append("region_id", input.region_id);
  if (input.country_id) form.append("country_id", input.country_id);
  if (input.model_id) form.append("model_id", input.model_id);
  if (input.model_id) form.append("model_id", input.model_id);
  if (input.company_id) form.append("company_id", input.company_id);
  if (input.report_year != null) form.append("report_year", String(input.report_year));
  if (input.report_month != null) form.append("report_month", String(input.report_month));

  return apiFetch<UploadOut>(`/uploads`, {
    method: "POST",
    body: form
  });
}

export async function getUploadNodes(uploadId: string): Promise<ReportNodeOut[]> {
  return apiFetch<ReportNodeOut[]>(`/uploads/${uploadId}/nodes`);
}

export async function getUploadTree(uploadId: string): Promise<TreeNode[]> {
  return apiFetch<TreeNode[]>(`/uploads/${uploadId}/tree`);
}

export async function getUploadDebug(uploadId: string): Promise<{
  upload_id: string;
  node_count: number;
  has_nodes: boolean;
}> {
  return apiFetch(`/uploads/${uploadId}/debug`);
}

