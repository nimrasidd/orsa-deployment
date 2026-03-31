import * as React from "react";
import { listUploads } from "../api/uploads";
import { getChartData, getChartTable, type ChartDataPoint, type ChartTableData, type PeriodGroup } from "../api/reports";
import { listRegions, listCountriesByRegion, listCompanies, type RegionOut, type CountryOut, type CompanyOut } from "../api/regions";
import { listCompanyModels, type CompanyModelOut } from "../api/companyModels";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import type { UploadOut } from "../types";
import { toast } from "sonner";
import { RefreshCcw, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useWorkspace } from "../workspace/tabs";
import { useAuth } from "../auth/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function formatChartValue(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}bn`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return String(v);
}

/** Stored `level` = number of dot-separated segments in Code (backend derive_hierarchy). */
function chartRowLevel(row: { level?: number | string | null }): number {
  const n = Number(row.level ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function Dashboard() {
  const { openOrActivate, rename } = useWorkspace();
  const loc = useLocation();
  const { user } = useAuth();
  const [reportKey, setReportKey] = React.useState("");
  const [latestOnly, setLatestOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<UploadOut[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [regions, setRegions] = React.useState<RegionOut[]>([]);
  const [countries, setCountries] = React.useState<CountryOut[]>([]);
  const [models, setModels] = React.useState<CompanyModelOut[]>([]);
  const [companies, setCompanies] = React.useState<CompanyOut[]>([]);
  const [regionId, setRegionId] = React.useState("");
  const [countryId, setCountryId] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [chartData, setChartData] = React.useState<ChartDataPoint[]>([]);
  const [chartTable, setChartTable] = React.useState<ChartTableData | null>(null);
  const [tableLevelFilter, setTableLevelFilter] = React.useState<"all" | "main" | "sub" | "subsub">("all");
  const [tableCategoryFilter, setTableCategoryFilter] = React.useState<string>("");

  // Time period for charts - from date to date; X-axis bucket (default quarterly)
  const [chartDateFrom, setChartDateFrom] = React.useState("");
  const [chartDateTo, setChartDateTo] = React.useState("");
  const [periodGroup, setPeriodGroup] = React.useState<PeriodGroup>("quarter");

  const RISK_CATEGORIES = [
    "Underwriting Risk - Property and Liability Takaful",
    "Underwriting Risk - Family Takaful",
    "Underwriting Risk - Health Insurance",
    "Credit Risk",
    "Investment Risk",
    "Operational Risk"
  ];
  const [chartLoading, setChartLoading] = React.useState(false);
  const [nodeCodeFilter, setNodeCodeFilter] = React.useState("");

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
        company_id: companyId || undefined
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg = e?.detail ? String(e.detail) : String(e?.message ?? e);
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
  }, [reportKey, latestOnly, regionId, countryId, modelId, companyId]);

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

  // Chart data refetches with the same scope as the uploads filters (company, region, country, model, report key, dates, node)
  React.useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    const params = {
      report_key: reportKey.trim() || undefined,
      company_id: companyId || undefined,
      region_id: regionId || undefined,
      country_id: countryId || undefined,
      model_id: modelId || undefined,
      latest_only: latestOnly || undefined,
      node_code: nodeCodeFilter.trim() || undefined,
      date_from: chartDateFrom.trim() || undefined,
      date_to: chartDateTo.trim() || undefined,
      period_group: periodGroup,
    };
    Promise.all([getChartData(params), getChartTable(params)])
      .then(([data, table]) => {
        if (!cancelled) {
          setChartData(Array.isArray(data) ? data : []);
          setChartTable(table);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChartData([]);
          setChartTable(null);
        }
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => { cancelled = true; };
  }, [
    reportKey,
    companyId,
    regionId,
    countryId,
    modelId,
    latestOnly,
    nodeCodeFilter,
    chartDateFrom,
    chartDateTo,
    periodGroup
  ]);

  // When company is selected, auto-fill region and country (for filtering)
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

  // Load countries when region is set
  React.useEffect(() => {
    if (!regionId) {
      setCountries([]);
      return;
    }
    listCountriesByRegion(regionId).then(setCountries).catch(() => setCountries([]));
  }, [regionId]);

  // Mapping models for uploads (same `models` table as Upload page) — scoped by company
  React.useEffect(() => {
    if (!companyId) {
      setModels([]);
      setModelId("");
      return;
    }
    listCompanyModels(companyId).then(setModels).catch(() => setModels([]));
    setModelId("");
  }, [companyId]);

  const selectedModel = React.useMemo(
    () => models.find((m) => m.id === modelId),
    [models, modelId]
  );
  const selectedModelLabel = selectedModel?.name ?? "";

  // Workspace tab title reflects selected model (same idea as Mappings)
  React.useEffect(() => {
    const tabId = loc.pathname || "/";
    if (modelId && selectedModelLabel) {
      rename(tabId, `Dashboard · ${selectedModelLabel}`);
    } else {
      rename(tabId, "Dashboard");
    }
  }, [loc.pathname, modelId, selectedModelLabel, rename]);

  const CHART_COLORS = ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#2dd4bf", "#fb923c"];

  const chartAxisLabel =
    periodGroup === "year" ? "Year" : periodGroup === "quarter" ? "Quarter" : "Month";

  const yearChartData = React.useMemo(
    () =>
      chartData.map((d, i) => ({
        xLabel: String(d.period ?? d.year),
        value: d.value,
        valueLabel: formatChartValue(d.value),
        fill: CHART_COLORS[i % CHART_COLORS.length]
      })),
    [chartData]
  );

  const tableColumns = React.useMemo(() => {
    if (!chartTable) return [] as string[];
    const p = chartTable.periods;
    if (p && p.length > 0) return p;
    return chartTable.years.map(String);
  }, [chartTable]);

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-transparent p-6 ring-1 ring-white/10 shadow-glow backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Sparkles className="h-4 w-4 text-sky-300" />
              {modelId && selectedModelLabel ? (
                <>
                  Uploads dashboard
                  <span className="font-normal text-sky-200/90">· {selectedModelLabel}</span>
                </>
              ) : (
                "Uploads dashboard"
              )}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {modelId && selectedModelLabel
                ? <>Data scoped to model <span className="font-medium text-slate-300">{selectedModelLabel}</span>. Browse versions by report key and open a tree view.</>
                : "Browse versions by report key and open a tree view."}
            </div>
          </div>
          <div className="flex items-center gap-3">
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
          </div>
        </div>

        {
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
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
                disabled={!companyId}
                title={!companyId ? "Select a company to list mapping models" : undefined}
                className="h-10 w-full rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10 disabled:opacity-50"
              >
                <option value="">All</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Filter by report key (e.g. APAC-Pakistan-OSRA-2026-01)"
              value={reportKey}
              onChange={(e) => setReportKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
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
                setReportKey("");
                setNodeCodeFilter("");
                setTableLevelFilter("all");
                setTableCategoryFilter("");
                setChartDateFrom("");
                setChartDateTo("");
                setPeriodGroup("quarter");
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
        }
      </div>

      <Card
        title={
          modelId && selectedModelLabel
            ? `Values by period · ${selectedModelLabel}`
            : "Values by period"
        }
        subtitle={
          modelId && selectedModelLabel
            ? `Filtered for model “${selectedModelLabel}”. X-axis buckets: Year, Quarter (default), or Month. Optional From / To dates narrow which uploads are included.`
            : "X-axis buckets: Year, Quarter (default), or Month. Optional From / To dates narrow which uploads are included."
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Group by</span>
              <select
                value={periodGroup}
                onChange={(e) => setPeriodGroup(e.target.value as PeriodGroup)}
                className="h-9 min-w-[7rem] rounded-lg bg-white/5 px-2 text-xs text-slate-100 ring-1 ring-white/10"
                title="How bars and table columns are grouped on the time axis"
              >
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
                <option value="month">Month</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">From date</span>
              <input
                type="date"
                value={chartDateFrom}
                onChange={(e) => setChartDateFrom(e.target.value)}
                className="h-9 rounded-lg bg-white/5 px-2 text-xs text-slate-100 ring-1 ring-white/10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">To date</span>
              <input
                type="date"
                value={chartDateTo}
                onChange={(e) => setChartDateTo(e.target.value)}
                className="h-9 rounded-lg bg-white/5 px-2 text-xs text-slate-100 ring-1 ring-white/10"
              />
            </div>
            <input
              type="text"
              placeholder="Node code (e.g. Gross Written)"
              value={nodeCodeFilter}
              onChange={(e) => setNodeCodeFilter(e.target.value)}
              className="h-9 w-40 rounded-lg bg-white/5 px-3 text-xs text-slate-100 ring-1 ring-white/10 placeholder:text-slate-500"
            />
          </div>
        }
      >
        <div key={`chart-${periodGroup}-${chartDateFrom}-${chartDateTo}`} className="h-[280px] min-h-[280px] w-full min-w-0">
          {chartLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading…</div>
          ) : yearChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={yearChartData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="xLabel"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  label={{
                    value: chartAxisLabel,
                    position: "insideBottom",
                    offset: -4,
                    fill: "#94a3b8",
                    fontSize: 11
                  }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatChartValue(v)}
                  label={{ value: "Value", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ background: "rgb(15 23 42)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(), "Value"]}
                  labelFormatter={(label) => `${chartAxisLabel} ${label}`}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} label={{ position: "top", fill: "#e2e8f0", fontSize: 11, formatter: (v: unknown) => formatChartValue(Number(v ?? 0)) }}>
                  {yearChartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <p>No data for the selected time period.</p>
              <p className="text-xs">
                Upload files with <span className="text-slate-300">report date</span> (year/month) set. Adjust From date / To date or Company/Report key.
              </p>
            </div>
          )}
        </div>

        {chartTable && chartTable.rows.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <span className="text-xs text-slate-400">Level:</span>
                <div className="flex flex-col gap-1">
                  <select
                    value={tableLevelFilter}
                    onChange={(e) => setTableLevelFilter(e.target.value as "all" | "main" | "sub" | "subsub")}
                    className="h-8 rounded-lg bg-white/5 px-3 text-xs text-slate-100 ring-1 ring-white/10"
                  >
                    <option value="all">All components</option>
                    <option value="main">Top / main (code depth ≤ 1 segment)</option>
                    <option value="sub">Sub (2 segments, e.g. A.B)</option>
                    <option value="subsub">Sub-sub (3+ segments, e.g. A.B.C)</option>
                  </select>
                  <p className="max-w-xl text-[11px] leading-snug text-slate-500">
                    Depth matches your <span className="text-slate-400">Code</span> column: each dot adds a level. Empty or odd rows may show as 0.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Category:</span>
                <select
                  value={tableCategoryFilter}
                  onChange={(e) => setTableCategoryFilter(e.target.value)}
                  className="h-8 min-w-[220px] rounded-lg bg-white/5 px-3 text-xs text-slate-100 ring-1 ring-white/10"
                >
                  <option value="">All categories</option>
                  {RISK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="max-h-[min(28rem,60vh)] overflow-auto rounded-lg border border-white/10 [scrollbar-gutter:stable] [scrollbar-width:thin]">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-slate-950/95 text-xs text-slate-400 backdrop-blur-sm">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 font-medium">Name</th>
                    {tableColumns.map((col) => (
                      <th key={col} className="px-4 py-3 font-medium text-right">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {chartTable.rows
                    .filter((row) => {
                      const lvl = chartRowLevel(row);
                      if (tableLevelFilter !== "all") {
                        if (tableLevelFilter === "main" && lvl > 1) return false;
                        if (tableLevelFilter === "sub" && lvl !== 2) return false;
                        if (tableLevelFilter === "subsub" && lvl < 3) return false;
                      }
                      if (tableCategoryFilter) {
                        const name = (row.name || "").trim();
                        const parent = (row.parent_name || "").trim();
                        const cat = tableCategoryFilter.trim();
                        return name === cat || parent === cat || name.startsWith(cat) || parent.startsWith(cat);
                      }
                      return true;
                    })
                    .map((row) => (
                  <tr key={row.code} className="border-t border-white/10">
                    <td className="px-4 py-2.5 font-medium text-slate-100">{row.name}</td>
                    {tableColumns.map((col) => {
                      const v = row.values[col] ?? row.values[Number(col) as unknown as keyof typeof row.values];
                      return (
                        <td key={col} className="px-4 py-2.5 text-right font-mono text-slate-300">
                          {v != null ? formatChartValue(v) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

