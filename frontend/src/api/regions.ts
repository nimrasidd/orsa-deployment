import { apiFetch } from "./http";

export type RegionOut = { id: string; name: string };
export type CountryOut = { id: string; region_id: string; name: string };
export type ApplicationModelOut = { id: string; country_id: string; name: string };
export type CompanyOut = { id: string; name: string; region_id: string; country_id?: string | null };

export async function listRegions(): Promise<RegionOut[]> {
  return apiFetch<RegionOut[]>("/regions");
}

export async function listCountriesByRegion(regionId: string): Promise<CountryOut[]> {
  return apiFetch<CountryOut[]>(`/regions/${regionId}/countries`);
}

/** All countries (for filters without a region step). */
export async function listAllCountries(): Promise<CountryOut[]> {
  const regions = await listRegions();
  const rlist = Array.isArray(regions) ? regions : [];
  const batches = await Promise.all(
    rlist.map((r) => listCountriesByRegion(r.id).catch(() => [] as CountryOut[]))
  );
  const flat = batches.flat();
  const seen = new Set<string>();
  return flat.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

export async function listModelsByCountry(countryId: string): Promise<ApplicationModelOut[]> {
  return apiFetch<ApplicationModelOut[]>(`/countries/${countryId}/models`);
}

export async function listCompanies(regionId?: string): Promise<CompanyOut[]> {
  const qs = regionId ? `?region_id=${encodeURIComponent(regionId)}` : "";
  return apiFetch<CompanyOut[]>(`/companies${qs}`);
}

export async function createCompany(input: {
  name: string;
  region_id: string;
  country_id?: string | null;
}): Promise<CompanyOut> {
  return apiFetch<CompanyOut>("/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name.trim(),
      region_id: input.region_id,
      country_id: input.country_id?.trim() || null,
    }),
  });
}

export async function deleteCompany(companyId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/companies/${encodeURIComponent(companyId)}`, {
    method: "DELETE",
  });
}

export type ModelOut = {
  id: string;
  country_id: string;
  name: string;
  country_name: string;
  region_name: string;
};

export async function listAllModels(): Promise<ModelOut[]> {
  return apiFetch<ModelOut[]>("/models");
}

export async function createModel(countryId: string, name: string): Promise<ModelOut> {
  return apiFetch<ModelOut>("/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country_id: countryId, name: name.trim() }),
  });
}
