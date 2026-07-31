import * as React from "react";
import { deleteUpload, listUploads } from "../api/uploads";
import { ApiError } from "../api/http";
import { listAllModels, listCompanies, companyLabel, type CompanyOut, type ModelOut } from "../api/regions";
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

  const [models, setModels] = React.useState<ModelOut[]>([]);
  const [companies, setCompanies] = React.useState<CompanyOut[]>([]);
  const [modelId, setModelId] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [reportYear, setReportYear] = React.useState<number | "">("");
  const [reportMonth, setReportMonth] = React.useState<number | "">("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listUploads({
        report_key: reportKey.trim() ? reportKey.trim() : undefined,
        latestOnly,
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
  }, [reportKey, latestOnly, modelId, companyId, reportYear, reportMonth]);

  React.useEffect(() => {
    listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  React.useEffect(() => {
    if (!user) return;
    if (!user.is_admin && user.company_id) {
      setCompanyId(user.company_id);
    }
  }, [user?.id, user?.is_admin, user?.company_id]);

  const reportsCompanyAppliedRef = React.useRef<string | null>(null);

  // When company changes: reset model filter.
  React.useEffect(() => {
    if (!companyId) {
      setModelId("");
      reportsCompanyAppliedRef.current = null;
      return;
    }
    if (!companies.some((c) => c.id === companyId)) return;
    if (reportsCompanyAppliedRef.current !== companyId) {
      setModelId("");
      reportsCompanyAppliedRef.current = companyId;
    }
  }, [companyId, companies]);

  /** Models are global (application models). */
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const data = await listAllModels();
        if (!cancelled) setModels(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setModels([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function getCompanyName(upload: UploadOut): string {
    if (!upload.company_id) return "—";
    const c = companies.find((x) => x.id === upload.company_id);
    return c?.name ?? "—";
  }

  async function handleDeleteOne(u: UploadOut) {
    if (deletingId) return;
    if (
      !window.confirm(
        `Delete “${u.report_key}” v${u.version_no} and all report data? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(u.id);
    try {
      await deleteUpload(u.id);
      toast.success("Upload deleted");
      await load();
    } catch (e) {
      const detail = e instanceof ApiError ? String(e.detail ?? e.message) : String((e as Error)?.message ?? e);
      toast.error("Delete failed", { description: detail });
      void load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-brand-500/12 via-emerald-500/8 to-transparent p-6 ring-1 ring-line shadow-sm backdrop-blur dark:from-brand-500/15 dark:via-emerald-500/10 dark:ring-white/10 dark:shadow-brandGlow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-ink">Upload</div>
            <div className="mt-1 text-xs text-ink-muted">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <div className="mb-1 text-xs font-medium text-ink-muted">Company</div>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={!!user && !user.is_admin}
                title={user && !user.is_admin ? "Your account is limited to your company" : undefined}
                className="h-10 w-full rounded-lg border border-line bg-surface-panel px-3 text-sm text-ink disabled:opacity-70 dark:bg-surface-2"
              >
                {user?.is_admin ? <option value="">All</option> : null}
                {companies.map((co) => (
                  <option key={co.id} value={co.id}>{companyLabel(co)}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-ink-muted">Model</div>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={!user?.is_admin && !companyId}
                title={
                  !user?.is_admin && !companyId
                    ? "Select a company first"
                    : "Mapping model (filters uploads by model_id)"
                }
                className="h-10 w-full rounded-lg border border-line bg-surface-panel px-3 text-sm text-ink disabled:opacity-50 dark:bg-surface-2"
              >
                <option value="">All</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-ink-muted">Year</div>
              <input
                type="number"
                placeholder="All"
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value ? parseInt(e.target.value, 10) : "")}
                className="h-10 w-full rounded-lg border border-line bg-surface-panel px-3 text-sm text-ink dark:bg-surface-2"
                min={2020}
                max={2030}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-ink-muted">Month</div>
              <select
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value ? parseInt(e.target.value, 10) : "")}
                className="h-10 w-full rounded-lg border border-line bg-surface-panel px-3 text-sm text-ink dark:bg-surface-2"
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
            <label className="flex h-10 items-center justify-between gap-3 rounded-lg border border-line bg-surface-panel px-4 text-sm dark:bg-surface-2">
              <span className="text-ink-muted">Latest only</span>
              <input
                type="checkbox"
                checked={latestOnly}
                onChange={(e) => setLatestOnly(e.target.checked)}
                className="h-4 w-4 accent-brand-600"
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
          !loading && items.length === 0 && !loadError ? (
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
          ) : null
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs font-medium text-ink-muted">
              <tr className="[&>th]:pb-3 [&>th]:font-medium">
                <th>Company</th>
                <th>Report key</th>
                <th>Version</th>
                <th>Filename</th>
                <th>Uploaded</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-line transition hover:bg-surface-2/50 [&>td]:py-3"
                >
                  <td className="pr-4 text-ink">{getCompanyName(u)}</td>
                  <td className="pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{u.report_key}</span>
                      <Badge>id: {u.id.slice(0, 8)}</Badge>
                    </div>
                    {u.notes ? (
                      <div className="mt-1 text-xs text-ink-muted line-clamp-1">{u.notes}</div>
                    ) : null}
                  </td>
                  <td className="pr-4">
                    <Badge>v{u.version_no}</Badge>
                  </td>
                  <td className="pr-4 text-ink">{u.original_filename}</td>
                  <td className="pr-4 text-ink-muted">{formatDate(u.uploaded_at)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 shrink-0 p-0 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                        onClick={() => void handleDeleteOne(u)}
                        disabled={loading || deletingId !== null}
                        aria-label={`Delete ${u.report_key} v${u.version_no}`}
                        title="Delete upload and all report rows"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    {loadError ? (
                      <div className="space-y-2">
                        <p className="text-ink">{loadError}</p>
                        <p className="text-xs">
                          Ensure the backend is running at{" "}
                          <span className="font-mono text-ink">http://127.0.0.1:8000</span>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p>No results.</p>
                        <p className="text-xs">
                          Click <strong className="text-ink">Clear filters</strong> above to show all uploads, or{" "}
                          <button
                            type="button"
                            onClick={() =>
                              openOrActivate({ path: "/upload", title: "Upload Excel" })
                            }
                            className="font-medium text-brand-700 hover:text-brand-600 underline dark:text-brand-400"
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
