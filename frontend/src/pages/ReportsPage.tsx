import * as React from "react";
import { listUploads } from "../api/uploads";
import {
  listRegions,
  listCountriesByRegion,
  listModelsByCountry,
  listCompanies,
  type RegionOut,
  type CountryOut,
  type ApplicationModelOut,
  type CompanyOut
} from "../api/regions";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import type { UploadOut } from "../types";
import { toast } from "sonner";
import { ArrowRight, RefreshCcw } from "lucide-react";
import { useWorkspace } from "../workspace/tabs";
import { useAuth } from "../auth/AuthContext";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function ReportsPage() {
  const { openOrActivate } = useWorkspace();
  const { user } = useAuth();
  const [reportKey, setReportKey] = React.useState("");
  const [latestOnly, setLatestOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<UploadOut[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [regions, setRegions] = React.useState<RegionOut[]>([]);
  const [countries, setCountries] = React.useState<CountryOut[]>([]);
  const [models, setModels] = React.useState<ApplicationModelOut[]>([]);
  const [companies, setCompanies] = React.useState<CompanyOut[]>([]);
  const [regionId, setRegionId] = React.useState("");
  const [countryId, setCountryId] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [reportYear, setReportYear] = React.useState<number | "">("");
  const [reportMonth, setReportMonth] = React.useState<number | "">("");

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listUploads({
        report_key: reportKey.trim() ? reportKey.trim() : undefined,
        latestOnly,
        region_id: regionId || undefined,
        country_id: countryId || undefined,
        model_id: modelId || undefined,
        company_id: companyId || undefined,
        report_year: reportYear !== "" ? reportYear : undefined,
        report_month: reportMonth !== "" ? reportMonth : undefined
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "detail" in e ? String((e as { detail: unknown }).detail) : String((e as Error)?.message ?? e);
      setLoadError(msg);
      setItems([]);
      toast.error("Failed to load reports", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey, latestOnly, regionId, countryId, modelId, companyId, reportYear, reportMonth]);

  React.useEffect(() => {
    listRegions().then(setRegions).catch(() => setRegions([]));
    listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  React.useEffect(() => {
    if (!user) return;
    if (!user.is_admin && user.company_id) {
      setCompanyId(user.company_id);
    }
  }, [user?.id, user?.is_admin, user?.company_id]);

  React.useEffect(() => {
    if (!companyId) {
      setRegionId("");
      setCountryId("");
      setModels([]);
      setModelId("");
      return;
    }
    const company = companies.find((c) => c.id === companyId);
    if (!company) return;
    setRegionId(company.region_id);
    setCountryId(company.country_id ?? "");
    setModelId("");
  }, [companyId, companies]);

  React.useEffect(() => {
    if (!regionId) {
      setCountries([]);
      return;
    }
    listCountriesByRegion(regionId).then(setCountries).catch(() => setCountries([]));
  }, [regionId]);

  React.useEffect(() => {
    if (!countryId) {
      setModels([]);
      setModelId("");
      return;
    }
    listModelsByCountry(countryId).then(setModels).catch(() => setModels([]));
    setModelId("");
  }, [countryId]);

  function getCompanyName(upload: UploadOut): string {
    if (!upload.company_id) return "—";
    const c = companies.find((x) => x.id === upload.company_id);
    return c?.name ?? "—";
  }

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-transparent p-6 ring-1 ring-white/10 shadow-glow backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">Reports</div>
            <div className="mt-1 text-xs text-slate-400">
              Browse reports by filters. One entry per report.
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            <div>
              <div className="mb-1 text-xs text-slate-400">Company</div>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={!!user && !user.is_admin}
                title={user && !user.is_admin ? "Your account is limited to your company" : undefined}
                className="h-10 w-full rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10 disabled:opacity-70"
              >
                {user?.is_admin ? <option value="">All</option> : null}
                {companies.map((co) => (
                  <option key={co.id} value={co.id}>{co.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">Region</div>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                disabled={!!companyId}
                className="h-10 w-full rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10 disabled:opacity-50"
              >
                <option value="">All</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">Country</div>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                disabled={!regionId}
                className="h-10 w-full rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10 disabled:opacity-50"
              >
                <option value="">All</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">Model</div>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={!countryId}
                className="h-10 w-full rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10 disabled:opacity-50"
              >
                <option value="">All</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">Year</div>
              <input
                type="number"
                placeholder="All"
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value ? parseInt(e.target.value, 10) : "")}
                className="h-10 w-full rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10"
                min={2020}
                max={2030}
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">Month</div>
              <select
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value ? parseInt(e.target.value, 10) : "")}
                className="h-10 w-full rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10"
              >
                <option value="">All</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Filter by report key"
              value={reportKey}
              onChange={(e) => setReportKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
              className="max-w-xs"
            />
            <label className="flex h-11 items-center justify-between gap-3 rounded-xl bg-white/5 px-4 text-sm ring-1 ring-white/10">
              <span className="text-slate-300">Latest only</span>
              <input
                type="checkbox"
                checked={latestOnly}
                onChange={(e) => setLatestOnly(e.target.checked)}
                className="h-4 w-4 accent-sky-400"
              />
            </label>
            <Button variant="ghost" onClick={load} disabled={loading}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCompanyId(user && !user.is_admin ? user.company_id : "");
                setRegionId("");
                setCountryId("");
                setModelId("");
                setReportYear("");
                setReportMonth("");
                setReportKey("");
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </div>

      <Card
        title="Reports"
        subtitle={
          loading
            ? "Loading…"
            : loadError
              ? "Could not load reports. Check that the backend is running."
              : items.length
                ? `${items.length} report(s)`
                : "No reports yet. Upload an Excel file to get started, or clear filters if you expect to see results."
        }
        actions={
          !loading && items.length === 0 && !loadError ? (
            <Button
              onClick={() =>
                openOrActivate({
                  path: "/upload",
                  title: "Upload"
                })
              }
            >
              Upload Excel
            </Button>
          ) : null
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-400">
              <tr className="[&>th]:pb-3 [&>th]:font-medium">
                <th>Company</th>
                <th>Report key</th>
                <th>Version</th>
                <th>Filename</th>
                <th>Uploaded</th>
                <th className="text-right">Open</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {items.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-white/10 [&>td]:py-3"
                >
                  <td className="pr-4 text-slate-300">{getCompanyName(u)}</td>
                  <td className="pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.report_key}</span>
                      <Badge className="text-slate-300">id: {u.id.slice(0, 8)}</Badge>
                    </div>
                    {u.notes ? (
                      <div className="mt-1 text-xs text-slate-400 line-clamp-1">{u.notes}</div>
                    ) : null}
                  </td>
                  <td className="pr-4">
                    <Badge>v{u.version_no}</Badge>
                  </td>
                  <td className="pr-4 text-slate-300">{u.original_filename}</td>
                  <td className="pr-4 text-slate-300">{formatDate(u.uploaded_at)}</td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        openOrActivate({
                          path: `/uploads/${u.id}`,
                          title: `Report • ${u.report_key} v${u.version_no}`
                        })
                      }
                    >
                      View <ArrowRight className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {loadError ? (
                      <div className="space-y-2">
                        <p>{loadError}</p>
                        <p className="text-xs">
                          Ensure the backend is running at{" "}
                          <span className="font-mono text-slate-300">http://127.0.0.1:8000</span>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p>No results.</p>
                        <p className="text-xs">
                          Click <strong>Clear filters</strong> above to show all reports, or{" "}
                          <button
                            type="button"
                            onClick={() =>
                              openOrActivate({ path: "/upload", title: "Upload" })
                            }
                            className="text-sky-400 hover:text-sky-300 underline"
                          >
                            upload a file
                          </button>
                          .
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
