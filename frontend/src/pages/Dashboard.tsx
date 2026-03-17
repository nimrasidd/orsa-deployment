import * as React from "react";
import { listUploads } from "../api/uploads";
import { getChartData, getChartTable, type ChartDataPoint } from "../api/reports";
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
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import type { UploadOut } from "../types";
import { toast } from "sonner";
import { RefreshCcw, Sparkles } from "lucide-react";
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

export function Dashboard() {
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
  const [chartData, setChartData] = React.useState<ChartDataPoint[]>([]);
  const [chartTable, setChartTable] = React.useState<{ years: number[]; rows: { name: string; code: string; level: number; parent_name: string; values: Record<number, number> }[] } | null>(null);
  const [tableLevelFilter, setTableLevelFilter] = React.useState<"all" | "main" | "sub" | "subsub">("all");
  const [tableCategoryFilter, setTableCategoryFilter] = React.useState<string>("");

  // Time period for charts - from date to date
  const [chartDateFrom, setChartDateFrom] = React.useState("");
  const [chartDateTo, setChartDateTo] = React.useState("");

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
        company_id: companyId || undefined,
        report_year: reportYear !== "" ? reportYear : undefined,
        report_month: reportMonth !== "" ? reportMonth : undefined
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
  }, [reportKey, latestOnly, regionId, countryId, modelId, companyId, reportYear, reportMonth]);

  React.useEffect(() => {
    listRegions().then(setRegions).catch(() => setRegions([]));
    listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  React.useEffect(() => {
    if (user?.company_id) setCompanyId(user.company_id);
  }, [user?.company_id]);

  // Chart data refetches automatically when time period or filters change
  React.useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    const params = {
      report_key: reportKey.trim() || undefined,
      company_id: companyId || undefined,
      node_code: nodeCodeFilter.trim() || undefined,
      date_from: chartDateFrom.trim() || undefined,
      date_to: chartDateTo.trim() || undefined,
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
  }, [reportKey, companyId, nodeCodeFilter, chartDateFrom, chartDateTo]);

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

  // Load models when country is set
  React.useEffect(() => {
    if (!countryId) {
      setModels([]);
      setModelId("");
      return;
    }
    listModelsByCountry(countryId).then(setModels).catch(() => setModels([]));
    setModelId("");
  }, [countryId]);

  const CHART_COLORS = ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#2dd4bf", "#fb923c"];

  const yearChartData = React.useMemo(
    () =>
      chartData.map((d, i) => ({
        year: String(d.year),
        value: d.value,
        valueLabel: formatChartValue(d.value),
        fill: CHART_COLORS[i % CHART_COLORS.length]
      })),
    [chartData]
  );

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-transparent p-6 ring-1 ring-white/10 shadow-glow backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Sparkles className="h-4 w-4 text-sky-300" />
              Uploads dashboard
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Browse versions by report key and open a tree view.
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            <div>
              <div className="mb-1 text-xs text-slate-400">Company</div>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="h-10 w-full rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10"
              >
                <option value="">All</option>
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
                setCompanyId("");
                setRegionId("");
                setCountryId("");
                setModelId("");
                setReportYear("");
                setReportMonth("");
                setReportKey("");
                setNodeCodeFilter("");
                setTableLevelFilter("all");
                setTableCategoryFilter("");
                setChartDateFrom("");
                setChartDateTo("");
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
        }
      </div>

      <Card
        title="Values by financial year"
        subtitle="Projections filtered by date range. Select From date and To date to filter."
        actions={
          <div className="flex flex-wrap items-center gap-3">
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
        <div className="h-[280px] w-full">
          {chartLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading…</div>
          ) : yearChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearChartData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} tickLine={false} label={{ value: "Year", position: "insideBottom", offset: -4, fill: "#94a3b8", fontSize: 11 }} />
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
                  labelFormatter={(y) => `Year ${y}`}
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Level:</span>
                <select
                  value={tableLevelFilter}
                  onChange={(e) => setTableLevelFilter(e.target.value as "all" | "main" | "sub" | "subsub")}
                  className="h-8 rounded-lg bg-white/5 px-3 text-xs text-slate-100 ring-1 ring-white/10"
                >
                  <option value="all">All components</option>
                  <option value="main">Main (level 0–1)</option>
                  <option value="sub">Sub (level 2)</option>
                  <option value="subsub">Sub-sub (level 3+)</option>
                </select>
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
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    {chartTable.years.map((y) => (
                      <th key={y} className="px-4 py-3 font-medium text-right">
                        {y}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {chartTable.rows
                    .filter((row) => {
                      const lvl = row.level ?? 0;
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
                    {chartTable.years.map((y) => (
                      <td key={y} className="px-4 py-2.5 text-right font-mono text-slate-300">
                        {row.values[y] != null ? formatChartValue(row.values[y]) : "—"}
                      </td>
                    ))}
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

