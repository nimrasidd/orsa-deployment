import { apiFetch } from "./http";

export type CompanyModelOut = {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
  created_by_user_id?: string | null;
  created_at?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
};

export async function listCompanyModels(companyId?: string): Promise<CompanyModelOut[]> {
  const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  return apiFetch<CompanyModelOut[]>(`/company-models${qs}`);
}

export async function createCompanyModel(name: string): Promise<CompanyModelOut> {
  return apiFetch<CompanyModelOut>("/company-models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
}
