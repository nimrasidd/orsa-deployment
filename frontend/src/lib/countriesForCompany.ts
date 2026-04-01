import type { CompanyOut, CountryOut } from "../api/regions";

/**
 * Countries linked to a company in master data: explicit `country_id`, else all countries in the company’s region.
 */
export function countriesForCompany(co: CompanyOut | undefined, all: CountryOut[]): CountryOut[] {
  if (!co) return all;
  if (co.country_id) {
    const hit = all.find((c) => c.id === co.country_id);
    return hit ? [hit] : [];
  }
  return all.filter((c) => c.region_id === co.region_id).sort((a, b) => a.name.localeCompare(b.name));
}
