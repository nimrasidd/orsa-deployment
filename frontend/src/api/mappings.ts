import { apiFetch, apiFetchBlob } from "./http";
import type { MappingItemOut, MappingOut } from "../types";

export async function listMappings(modelId?: string): Promise<MappingOut[]> {
  const qs = modelId ? `?model_id=${encodeURIComponent(modelId)}` : "";
  return apiFetch<MappingOut[]>(`/mappings${qs}`);
}

export async function createMapping(input: {
  file: File;
  name: string;
  model_id?: string;
  notes?: string;
  uploaded_by?: string;
}): Promise<MappingOut> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("name", input.name);
  if (input.model_id) form.append("model_id", input.model_id);
  if (input.notes) form.append("notes", input.notes);
  if (input.uploaded_by) form.append("uploaded_by", input.uploaded_by);

  return apiFetch<MappingOut>("/mappings", {
    method: "POST",
    body: form
  });
}

export async function getMappingItems(mappingId: string): Promise<MappingItemOut[]> {
  return apiFetch<MappingItemOut[]>(`/mappings/${mappingId}/items`);
}

export async function activateMapping(mappingId: string): Promise<MappingOut> {
  return apiFetch<MappingOut>(`/mappings/${mappingId}/activate`, {
    method: "POST"
  });
}

export async function deleteMapping(mappingId: string): Promise<void> {
  return apiFetch(`/mappings/${mappingId}`, {
    method: "DELETE"
  });
}

/** Download mapping as .xlsx (Code, Description, Sheet, Cell Reference, …). */
export async function downloadMappingWorkbook(mappingId: string): Promise<void> {
  const { blob, filename } = await apiFetchBlob(`/mappings/${encodeURIComponent(mappingId)}/export`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `mapping-${mappingId.slice(0, 8)}.xlsx`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function getActiveMappingItems(modelId?: string): Promise<MappingItemOut[]> {
  const qs = modelId ? `?model_id=${encodeURIComponent(modelId)}` : "";
  return apiFetch<MappingItemOut[]>(`/mappings/active/items${qs}`);
}
