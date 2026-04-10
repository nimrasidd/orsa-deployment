import { apiFetch } from "./http";

export type CompanyModelOut = {
  id: string;
  company_id?: string | null;
  name: string;
  company_name: string | null;
  country_id?: string | null;
  country_name?: string | null;
  created_by_user_id?: string | null;
  created_at?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
};

export async function listCompanyModels(companyId?: string): Promise<CompanyModelOut[]> {
  const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  return apiFetch<CompanyModelOut[]>(`/company-models${qs}`);
}

export async function createCompanyModel(input: {
  name: string;
  country_id: string;
  company_id?: string;
}): Promise<CompanyModelOut> {
  const body: { name: string; country_id: string; company_id?: string } = {
    name: input.name.trim(),
    country_id: input.country_id.trim(),
  };
  if (input.company_id) body.company_id = input.company_id;
  return apiFetch<CompanyModelOut>("/company-models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteCompanyModel(modelId: string): Promise<void> {
  await apiFetch(`/company-models/${encodeURIComponent(modelId)}`, {
    method: "DELETE",
  });
}
