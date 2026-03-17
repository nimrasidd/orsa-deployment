import { apiFetch } from "./http";

export type CompanyModelOut = {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
};

export async function listCompanyModels(): Promise<CompanyModelOut[]> {
  return apiFetch<CompanyModelOut[]>("/company-models");
}

export async function createCompanyModel(name: string): Promise<CompanyModelOut> {
  return apiFetch<CompanyModelOut>("/company-models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
}
