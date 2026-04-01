import * as React from "react";
import { deleteUpload, listUploads } from "../api/uploads";
import { ApiError } from "../api/http";
import { listAllCountries, listCompanies, type CountryOut, type CompanyOut } from "../api/regions";
import { listCompanyModels, type CompanyModelOut } from "../api/companyModels";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import type { UploadOut } from "../types";
import { toast } from "sonner";
import { ArrowRight, Columns2, FileSpreadsheet, RefreshCcw, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../workspace/tabs";
import { useAuth } from "../auth/AuthContext";
import { countriesForCompany } from "../lib/countriesForCompany";

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reportKey, setReportKey] = React.useState("");
  const [latestOnly, setLatestOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<UploadOut[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [countries, setCountries] = React.useState<CountryOut[]>([]);
  const [models, setModels] = React.useState<CompanyModelOut[]>([]);
  const [companies, setCompanies] = React.useState<CompanyOut[]>([]);
  const [countryId, setCountryId] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [reportYear, setReportYear] = React.useState<number | "">("");
  const [reportMonth, setReportMonth] = React.useState<number | "">("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = React.useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listUploads({
        report_key: reportKey.trim() ? reportKey.trim() : undefined,
        latestOnly,
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
      toast.error("Failed to load uploads", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey, latestOnly, countryId, modelId, companyId, reportYear, reportMonth]);

  React.useEffect(() => {
    listAllCountries().then(setCountries).catch(() => setCountries([]));
    listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  React.useEffect(() => {
    if (!user) return;
    if (!user.is_admin && user.company_id) {
      setCompanyId(user.company_id);
    }
  }, [user?.id, user?.is_admin, user?.company_id]);

  const reportsCompanyAppliedRef = React.useRef<string | null>(null);

  // When company changes: reset country + model filters.
  React.useEffect(() => {
    if (!companyId) {
      setCountryId("");
      setModelId("");
      reportsCompanyAppliedRef.current = null;
      return;
    }
    if (!companies.some((c) => c.id === companyId)) return;
    if (reportsCompanyAppliedRef.current !== companyId) {
      setCountryId("");
      setModelId("");
      reportsCompanyAppliedRef.current = companyId;
    }
  }, [companyId, companies]);

  const reportsCountryOptions = React.useMemo(() => {
    if (!companyId) return countries;
    const co = companies.find((c) => c.id === companyId);
    return countriesForCompany(co, countries);
  }, [companyId, companies, countries]);

  React.useEffect(() => {
    if (!countryId) return;
    if (!reportsCountryOptions.some((c) => c.id === countryId)) setCountryId("");
  }, [countryId, reportsCountryOptions]);

  /** Mapping models (uploads.model_id) — same as Dashboard / Upload, not application_models. */
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!companyId) {
          if (user?.is_admin) {
            const data = await listCompanyModels();
            if (!cancelled) setModels(Array.isArray(data) ? data : []);
          } else {
            if (!cancelled) {
              setModels([]);
              setModelId("");
            }
          }
          return;
        }
        const data = await listCompanyModels(companyId);
        if (!cancelled) {
          setModels(Array.isArray(data) ? data : []);
          setModelId("");
        }
      } catch {
        if (!cancelled) setModels([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [companyId, user?.is_admin]);

  function getCompanyName(upload: UploadOut): string {
    if (!upload.company_id) return "—";
    const c = companies.find((x) => x.id === upload.company_id);
    return c?.name ?? "—";
  }

  const allOnPageSelected =
    items.length > 0 && items.every((u) => selectedIds.has(u.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((u) => u.id)));
  }

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const ids = new Set(items.map((u) => u.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (ids.has(id)) next.add(id);
        else changed = true;
      }
      if (prev.size !== next.size) changed = true;
      return changed ? next : prev;
    });
  }, [items]);

  async function handleDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || deleting) return;
    const labels = items
      .filter((u) => selectedIds.has(u.id))
      .map((u) => `${u.report_key} v${u.version_no}`)
      .join("\n");
    const msg = `Delete ${ids.length} upload(s) and all their report data (this cannot be undone)?\n\n${labels.slice(0, 800)}${labels.length > 800 ? "\n…" : ""}`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    try {
      for (const id of ids) {
        await deleteUpload(id);
      }
      toast.success(`Deleted ${ids.length} upload(s).`);
      setSelectedIds(new Set());
      await load();
    } catch (e) {
      const detail = e instanceof ApiError ? String(e.detail ?? e.message) : String((e as Error)?.message ?? e);
      toast.error("Delete failed", { description: detail });
      void load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-transparent p-6 ring-1 ring-white/10 shadow-glow backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">Upload</div>
            <div className="mt-1 text-xs text-slate-400">
              Browse uploads by filters. One row per report version.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/models")}>
              <Columns2 className="h-4 w-4" />
              Compare reports
            </Button>
            <Button type="button" onClick={() => navigate("/upload")}>
              <FileSpreadsheet className="h-4 w-4" />
              Upload Excel
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
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
              <div className="mb-1 text-xs text-slate-400">Country</div>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                title={
                  companyId
                    ? "Countries for this company: its mapped country, or all countries in its region if none set."
                    : "All countries (pick a company to narrow this list)"
                }
                className="h-10 w-full rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10"
              >
                <option value="">All</option>
                {reportsCountryOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">Model</div>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={!user?.is_admin && !companyId}
                title={
                  !user?.is_admin && !companyId
                    ? "Select a company first"
                    : "Mapping model (filters uploads by model_id)"
                }
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
                setCompanyId(user && !user.is_admin ? (user.company_id ?? "") : "");
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
        title="Uploads"
        subtitle={
          loading
            ? "Loading…"
            : loadError
              ? "Could not load uploads. Check that the backend is running."
              : items.length
                ? `${items.length} report version(s)`
                : "No uploads yet. Use Upload Excel to add a file, or clear filters if you expect to see results."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {items.length > 0 ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={selectedIds.size === 0 || deleting || loading}
                onClick={() => void handleDeleteSelected()}
                title="Remove selected uploads and all extracted report rows"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting…" : `Delete selected${selectedIds.size ? ` (${selectedIds.size})` : ""}`}
              </Button>
            ) : null}
            {!loading && items.length === 0 && !loadError ? (
              <Button
                onClick={() =>
                  openOrActivate({
                    path: "/upload",
                    title: "Upload Excel"
                  })
                }
              >
                Upload Excel
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-400">
              <tr className="[&>th]:pb-3 [&>th]:font-medium">
                <th className="w-10 pr-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sky-400"
                    checked={allOnPageSelected}
                    disabled={loading || items.length === 0}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all uploads on this page"
                  />
                </th>
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
                  <td className="pr-2 align-middle">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sky-400"
                      checked={selectedIds.has(u.id)}
                      disabled={loading || deleting}
                      onChange={() => toggleSelect(u.id)}
                      aria-label={`Select ${u.report_key} v${u.version_no}`}
                    />
                  </td>
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
                  <td colSpan={7} className="py-8 text-center text-slate-400">
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
                          Click <strong>Clear filters</strong> above to show all uploads, or{" "}
                          <button
                            type="button"
                            onClick={() =>
                              openOrActivate({ path: "/upload", title: "Upload Excel" })
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
