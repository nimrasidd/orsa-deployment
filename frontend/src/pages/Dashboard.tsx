import * as React from "react";
import { listUploads } from "../api/uploads";
import { getChartTable, type ChartTableData, type ChartTableRow, type PeriodGroup } from "../api/reports";
import { listCompanies, type CompanyOut } from "../api/regions";
import { listCompanyModels, type CompanyModelOut } from "../api/companyModels";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { HierarchyCodeCell } from "../components/HierarchyCodeCell";
import { Input } from "../components/Input";
import type { UploadOut } from "../types";
import { toast } from "sonner";
import { RefreshCcw, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useWorkspace } from "../workspace/tabs";
import { useAuth } from "../auth/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import {
  DISPLAY_CURRENCY_CODE,
  formatCompactCurrencyAxis,
  formatCurrencyValue,
} from "../lib/format";
import { withInferredDottedParents } from "../lib/hierarchyTable";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Level from the chart table row — same as `report_nodes.level` at upload time,
 * i.e. the **mapping** level defined for that code in Mappings (not inferred from dots in the UI).
 */
function mappingLevel(row: { level?: number | string | null }): number {
  const n = Number(row.level ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

const CHART_MONTHS = [
  { v: 1, label: "January" },
  { v: 2, label: "February" },
  { v: 3, label: "March" },
  { v: 4, label: "April" },
  { v: 5, label: "May" },
  { v: 6, label: "June" },
  { v: 7, label: "July" },
  { v: 8, label: "August" },
  { v: 9, label: "September" },
  { v: 10, label: "October" },
  { v: 11, label: "November" },
  { v: 12, label: "December" }
];

function chartYearOptions(): number[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 14 }, (_, i) => y - 10 + i);
}

export function Dashboard() {
  const { rename } = useWorkspace();
  const loc = useLocation();
  const { user } = useAuth();
  const [reportKey, setReportKey] = React.useState("");
  const [latestOnly, setLatestOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<UploadOut[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [models, setModels] = React.useState<CompanyModelOut[]>([]);
  const [companies, setCompanies] = React.useState<CompanyOut[]>([]);
  const [modelId, setModelId] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [chartTable, setChartTable] = React.useState<ChartTableData | null>(null);
  const [tableCategoryFilter, setTableCategoryFilter] = React.useState<string>("");

  // Report period bounds for chart (year + month each; API uses YYYY-MM-01 style strings)
  const [periodFromYear, setPeriodFromYear] = React.useState<number | "">("");
  const [periodFromMonth, setPeriodFromMonth] = React.useState<number | "">("");
  const [periodToYear, setPeriodToYear] = React.useState<number | "">("");
  const [periodToMonth, setPeriodToMonth] = React.useState<number | "">("");
  const [periodGroup, setPeriodGroup] = React.useState<PeriodGroup>("quarter");

  const chartDateFrom = React.useMemo(() => {
    if (periodFromYear === "" || periodFromMonth === "") return "";
    return `${periodFromYear}-${String(periodFromMonth).padStart(2, "0")}-01`;
  }, [periodFromYear, periodFromMonth]);

  const chartDateTo = React.useMemo(() => {
    if (periodToYear === "" || periodToMonth === "") return "";
    return `${periodToYear}-${String(periodToMonth).padStart(2, "0")}-01`;
  }, [periodToYear, periodToMonth]);

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
  }, [reportKey, latestOnly, modelId, companyId]);

  React.useEffect(() => {
    listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  React.useEffect(() => {
    if (!user) return;
    if (!user.is_admin && user.company_id) {
      setCompanyId(user.company_id);
    }
  }, [user?.id, user?.is_admin, user?.company_id]);

  // Chart data refetches with the same scope as the uploads filters (company, model, report key, dates, node)
  React.useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    const params = {
      report_key: reportKey.trim() || undefined,
      company_id: companyId || undefined,
      model_id: modelId || undefined,
      latest_only: latestOnly || undefined,
      node_code: nodeCodeFilter.trim() || undefined,
      date_from: chartDateFrom.trim() || undefined,
      date_to: chartDateTo.trim() || undefined,
      period_group: periodGroup,
    };
    getChartTable(params)
      .then((table) => {
        if (!cancelled) setChartTable(table);
      })
      .catch(() => {
        if (!cancelled) setChartTable(null);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => { cancelled = true; };
  }, [
    reportKey,
    companyId,
    modelId,
    latestOnly,
    nodeCodeFilter,
    chartDateFrom,
    chartDateTo,
    periodGroup
  ]);

  const dashboardCompanyAppliedRef = React.useRef<string | null>(null);

  // When company changes: reset model filter.
  React.useEffect(() => {
    if (!companyId) {
      setModelId("");
      dashboardCompanyAppliedRef.current = null;
      return;
    }
    if (!companies.some((c) => c.id === companyId)) return;
    if (dashboardCompanyAppliedRef.current !== companyId) {
      setModelId("");
      dashboardCompanyAppliedRef.current = companyId;
    }
  }, [companyId, companies]);

  // Mapping models (uploads.model_id) — all models for admin + “All companies”, else company-linked list
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

  const tableColumns = React.useMemo(() => {
    if (!chartTable) return [] as string[];
    const p = chartTable.periods;
    if (p && p.length > 0) return p;
    return chartTable.years.map(String);
  }, [chartTable]);

  /** Line chart: one series per code at mapping level 1 only. */
  const levelOneChartRows = React.useMemo(() => {
    if (!chartTable?.rows.length) return [];
    return chartTable.rows.filter((r) => mappingLevel(r) === 1);
  }, [chartTable]);

  const lineChartData = React.useMemo(() => {
    if (!tableColumns.length || !levelOneChartRows.length) return [];
    return tableColumns.map((col) => {
      const point: Record<string, string | number | null> = { xLabel: String(col) };
      for (const row of levelOneChartRows) {
        const v =
          row.values[col] ?? row.values[Number(col) as unknown as keyof typeof row.values];
        point[row.code] = v != null && Number.isFinite(Number(v)) ? Number(v) : null;
      }
      return point;
    });
  }, [tableColumns, levelOneChartRows]);

  const hasLineChartSeries = levelOneChartRows.some((r) =>
    tableColumns.some((col) => {
      const v = r.values[col] ?? r.values[Number(col) as unknown as keyof typeof r.values];
      return v != null && Number.isFinite(Number(v));
    })
  );

  const chartHierarchyRows = React.useMemo((): Array<ChartTableRow & { parent_code: string | null }> => {
    if (!chartTable?.rows.length) return [];
    return withInferredDottedParents(chartTable.rows);
  }, [chartTable]);

  /** Data table: mapping level 2 rows only, optional category filter. */
  const levelTwoChartRows = React.useMemo(() => {
    return chartHierarchyRows.filter((row) => {
      if (mappingLevel(row) !== 2) return false;
      if (tableCategoryFilter) {
        const name = (row.name || "").trim();
        const parent = (row.parent_name || "").trim();
        const cat = tableCategoryFilter.trim();
        return name === cat || parent === cat || name.startsWith(cat) || parent.startsWith(cat);
      }
      return true;
    });
  }, [chartHierarchyRows, tableCategoryFilter]);

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-transparent p-6 ring-1 ring-white/10 shadow-glow backdrop-blur">
        <div className="flex flex-wrap items-center gap-4">
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
                ? <>Data scoped to model <span className="font-medium text-slate-300">{selectedModelLabel}</span>. Browse versions by report key and open a report.</>
                : "Browse versions by report key and open a report."}
            </div>
          </div>
        </div>

        {
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
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
              <div className="mb-1 text-xs text-slate-400">Model</div>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={!user?.is_admin && !companyId}
                title={
                  !user?.is_admin && !companyId
                    ? "Select a company to list mapping models"
                    : "Mapping model (filters chart and scope by model_id)"
                }
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
                setCompanyId(user && !user.is_admin ? (user.company_id ?? "") : "");
                setModelId("");
                setReportKey("");
                setNodeCodeFilter("");
                setTableCategoryFilter("");
                setPeriodFromYear("");
                setPeriodFromMonth("");
                setPeriodToYear("");
                setPeriodToMonth("");
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
            ? (
                <>
                  Filtered for model “{selectedModelLabel}”. Line chart uses mapping level 1; table uses mapping level 2 (same as in Mappings). X-axis: Year, Quarter (default), or Month. Optional From / To (year and month). Node filter applies to both.
                </>
              )
            : (
                <>
                  Line chart: one series per code at <span className="text-slate-300">mapping level 1</span>. Table: <span className="text-slate-300">mapping level 2</span> only. X-axis: Year, Quarter (default), or Month. Optional From / To (year and month).
                </>
              )
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Group by</span>
              <select
                value={periodGroup}
                onChange={(e) => setPeriodGroup(e.target.value as PeriodGroup)}
                className="h-9 min-w-[7rem] rounded-lg bg-white/5 px-2 text-xs text-slate-100 ring-1 ring-white/10"
                title="How the chart and table columns are grouped on the time axis"
              >
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
                <option value="month">Month</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs text-slate-400">From</span>
              <select
                value={periodFromYear === "" ? "" : String(periodFromYear)}
                onChange={(e) => {
                  const v = e.target.value;
                  setPeriodFromYear(v === "" ? "" : parseInt(v, 10));
                  if (v === "") setPeriodFromMonth("");
                }}
                className="h-9 min-w-[5.5rem] rounded-lg bg-white/5 px-2 text-xs text-slate-100 ring-1 ring-white/10"
                aria-label="From year"
              >
                <option value="">Year</option>
                {chartYearOptions().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={periodFromMonth === "" ? "" : String(periodFromMonth)}
                onChange={(e) => {
                  const v = e.target.value;
                  setPeriodFromMonth(v === "" ? "" : parseInt(v, 10));
                }}
                disabled={periodFromYear === ""}
                className="h-9 min-w-[7.5rem] rounded-lg bg-white/5 px-2 text-xs text-slate-100 ring-1 ring-white/10 disabled:opacity-50"
                aria-label="From month"
              >
                <option value="">Month</option>
                {CHART_MONTHS.map((m) => (
                  <option key={m.v} value={m.v}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs text-slate-400">To</span>
              <select
                value={periodToYear === "" ? "" : String(periodToYear)}
                onChange={(e) => {
                  const v = e.target.value;
                  setPeriodToYear(v === "" ? "" : parseInt(v, 10));
                  if (v === "") setPeriodToMonth("");
                }}
                className="h-9 min-w-[5.5rem] rounded-lg bg-white/5 px-2 text-xs text-slate-100 ring-1 ring-white/10"
                aria-label="To year"
              >
                <option value="">Year</option>
                {chartYearOptions().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={periodToMonth === "" ? "" : String(periodToMonth)}
                onChange={(e) => {
                  const v = e.target.value;
                  setPeriodToMonth(v === "" ? "" : parseInt(v, 10));
                }}
                disabled={periodToYear === ""}
                className="h-9 min-w-[7.5rem] rounded-lg bg-white/5 px-2 text-xs text-slate-100 ring-1 ring-white/10 disabled:opacity-50"
                aria-label="To month"
              >
                <option value="">Month</option>
                {CHART_MONTHS.map((m) => (
                  <option key={m.v} value={m.v}>{m.label}</option>
                ))}
              </select>
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
        <div key={`chart-${periodGroup}-${chartDateFrom}-${chartDateTo}`} className="h-[320px] min-h-[320px] w-full min-w-0">
          {chartLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading…</div>
          ) : hasLineChartSeries && lineChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={lineChartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
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
                  width={68}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompactCurrencyAxis(v)}
                  label={{
                    value: `Amount (${DISPLAY_CURRENCY_CODE})`,
                    angle: -90,
                    position: "insideLeft",
                    fill: "#94a3b8",
                    fontSize: 11,
                    style: { textAnchor: "middle" },
                  }}
                />
                <Tooltip
                  contentStyle={{ background: "rgb(15 23 42)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  formatter={(v: number | string | undefined) =>
                    v != null && v !== "" && Number.isFinite(Number(v))
                      ? formatCurrencyValue(Number(v))
                      : "—"
                  }
                  labelFormatter={(label) => `${chartAxisLabel} ${label}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => {
                    const row = levelOneChartRows.find((r) => r.code === value);
                    const label = row?.name ?? value;
                    return label.length > 36 ? `${label.slice(0, 35)}…` : label;
                  }}
                />
                {levelOneChartRows.map((row, i) => (
                  <Line
                    key={row.code}
                    type="monotone"
                    dataKey={row.code}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 1 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <p>No mapping level 1 values for the selected period or filters.</p>
              <p className="text-xs">
                Upload files with <span className="text-slate-300">report date</span> (year/month) set. Ensure Mappings define level 1 codes for the chart and level 2 for the table. Adjust From / To year-month, company, or report key.
              </p>
            </div>
          )}
        </div>

        {chartTable && chartTable.rows.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[11px] leading-snug text-slate-500">
                Table shows <span className="text-slate-400">mapping level 2</span> only; line chart uses <span className="text-slate-400">mapping level 1</span> (same levels as in Mappings).
              </p>
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
                  {levelTwoChartRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, tableColumns.length) + 1}
                        className="border-t border-white/10 px-4 py-8 text-center text-slate-500"
                      >
                        No rows match the current filters.
                      </td>
                    </tr>
                  ) : (
                    levelTwoChartRows.map((row) => (
                      <tr key={row.code} className="border-t border-white/10">
                        <td className="px-4 py-2.5 font-medium text-slate-100">
                          <HierarchyCodeCell
                            code={row.code}
                            displayText={row.name}
                            depth={0}
                            hasChildren={false}
                            isExpanded={false}
                            onToggle={() => {}}
                            textClassName="font-medium text-slate-100"
                          />
                        </td>
                        {tableColumns.map((col) => {
                          const v = row.values[col] ?? row.values[Number(col) as unknown as keyof typeof row.values];
                          return (
                            <td key={col} className="px-4 py-2.5 text-right font-mono text-slate-300">
                              {v != null ? formatCurrencyValue(v) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

