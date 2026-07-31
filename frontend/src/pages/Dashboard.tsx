import * as React from "react";
import { listUploads } from "../api/uploads";
import { getChartTable, type ChartTableData, type ChartTableRow, type PeriodGroup } from "../api/reports";
import { listAllModels, listCompanies, companyLabel, type CompanyOut, type ModelOut } from "../api/regions";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { HierarchyCodeCell } from "../components/HierarchyCodeCell";
import { Input } from "../components/Input";
import type { UploadOut } from "../types";
import { toast } from "sonner";
import { RefreshCcw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useWorkspace } from "../workspace/tabs";
import { useAuth } from "../auth/AuthContext";
import { formControlClass, tableWrapClass, tableClass, theadClass, thClass, trClass, tdClass, headingClass } from "../components/ui";
import { Segmented } from "../components/Segmented";
import { cn } from "../lib/cn";
import {
  AreaChart,
  Area,
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

  const [models, setModels] = React.useState<ModelOut[]>([]);
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

  // Models are global (application models)
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

  /** SHMA mock chart palette */
  const CHART_COLORS = ["#0B4D36", "#1FA97A", "#C97A22", "#0E7A54", "#12905F", "#14b8a6", "#fbbf24", "#fb923c"];

  const chartAxisLabel =
    periodGroup === "year" ? "Year" : periodGroup === "quarter" ? "Quarter" : "Month";

  const tableColumns = React.useMemo(() => {
    if (!chartTable) return [] as string[];
    const p = chartTable.periods;
    if (p && p.length > 0) return p;
    return chartTable.years.map(String);
  }, [chartTable]);

  /** Line chart: prefer mapping level 1; if none, fall back to any rows with numeric values. */
  const levelOneChartRows = React.useMemo(() => {
    if (!chartTable?.rows.length) return [];
    const l1 = chartTable.rows.filter((r) => mappingLevel(r) === 1);
    if (l1.length) return l1;
    // New / flat mappings often lack dotted level-1 codes — still plot whatever has values.
    return chartTable.rows.filter((r) =>
      Object.values(r.values || {}).some((v) => v != null && Number.isFinite(Number(v)))
    );
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

  /** Data table: prefer level 2; if none, show all rows with values. */
  const levelTwoChartRows = React.useMemo(() => {
    const preferL2 = chartHierarchyRows.filter((row) => mappingLevel(row) === 2);
    const base = preferL2.length ? preferL2 : chartHierarchyRows;
    return base.filter((row) => {
      if (tableCategoryFilter) {
        const name = (row.name || "").trim();
        const parent = (row.parent_name || "").trim();
        const cat = tableCategoryFilter.trim();
        return name === cat || parent === cat || name.startsWith(cat) || parent.startsWith(cat);
      }
      return true;
    });
  }, [chartHierarchyRows, tableCategoryFilter]);

  const usingLevelFallback =
    Boolean(chartTable?.rows.length) &&
    !chartTable!.rows.some((r) => mappingLevel(r) === 1);

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={cn(headingClass, "text-2xl")}>
            Dashboard
            {modelId && selectedModelLabel ? (
              <span className="ml-2 align-middle rounded-full bg-brand-100 px-2.5 py-0.5 text-sm font-semibold text-heading dark:bg-brand-500/15 dark:text-brand-200">
                {selectedModelLabel}
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            {modelId && selectedModelLabel
              ? `Data scoped to model “${selectedModelLabel}”. Filter by company, period, and report key.`
              : "Browse report values by period. Start by choosing company and model."}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-panel px-3 py-1.5 text-xs font-semibold text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Live data
        </span>
      </div>

      {/* Compact filter bar (HTML mock) */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-line bg-surface-panel px-4 py-4 shadow-sm dark:bg-surface-2/90">
        <div className="relative min-w-[140px]">
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            disabled={!!user && !user.is_admin}
            title={user && !user.is_admin ? "Your account is limited to your company" : undefined}
            className="h-9 w-full appearance-none rounded-[10px] border border-line bg-surface px-3 pr-8 text-[12.5px] font-semibold text-ink outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            {user?.is_admin ? <option value="">Company: All</option> : null}
            {companies.map((co) => (
              <option key={co.id} value={co.id}>
                Company: {companyLabel(co)}
              </option>
            ))}
          </select>
        </div>

        <div className="relative min-w-[120px]">
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={!user?.is_admin && !companyId}
            className="h-9 w-full appearance-none rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-55"
          >
            <option value="">Model: All</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                Model: {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative min-w-[200px] flex-1">
          <Input
            placeholder="Filter by report key (e.g. APAC-Pakistan-OSRA-2026-01)"
            value={reportKey}
            onChange={(e) => setReportKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
            className="h-9 rounded-[10px] border-line bg-surface text-[12.5px]"
          />
        </div>

        <Segmented
          value={periodGroup}
          onChange={setPeriodGroup}
          items={[
            { value: "year", label: "Year" },
            { value: "quarter", label: "Quarter" },
            { value: "month", label: "Month" },
          ]}
        />

        <button
          type="button"
          role="switch"
          aria-checked={latestOnly}
          onClick={() => setLatestOnly((v) => !v)}
          className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink-muted transition hover:text-ink"
        >
          <span
            className={cn(
              "relative h-[18px] w-8 rounded-full transition",
              latestOnly ? "bg-brand-500" : "bg-line"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition",
                latestOnly ? "right-0.5" : "left-0.5"
              )}
            />
          </span>
          Latest only
        </button>

        <Button variant="ghost" onClick={load} disabled={loading} className="h-9">
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>

        <Button
          variant="ghost"
          className="h-9"
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
            setLatestOnly(false);
          }}
        >
          Clear
        </Button>
      </div>

      {/* Secondary period bounds */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-semibold text-ink">From</span>
        <select
          value={periodFromYear === "" ? "" : String(periodFromYear)}
          onChange={(e) => {
            const v = e.target.value;
            setPeriodFromYear(v === "" ? "" : parseInt(v, 10));
            if (v === "") setPeriodFromMonth("");
          }}
          className={`${formControlClass} h-8 min-w-[5.5rem] text-xs`}
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
          className={`${formControlClass} h-8 min-w-[7rem] text-xs`}
          aria-label="From month"
        >
          <option value="">Month</option>
          {CHART_MONTHS.map((m) => (
            <option key={m.v} value={m.v}>{m.label}</option>
          ))}
        </select>
        <span className="font-semibold text-ink">To</span>
        <select
          value={periodToYear === "" ? "" : String(periodToYear)}
          onChange={(e) => {
            const v = e.target.value;
            setPeriodToYear(v === "" ? "" : parseInt(v, 10));
            if (v === "") setPeriodToMonth("");
          }}
          className={`${formControlClass} h-8 min-w-[5.5rem] text-xs`}
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
          className={`${formControlClass} h-8 min-w-[7rem] text-xs`}
          aria-label="To month"
        >
          <option value="">Month</option>
          {CHART_MONTHS.map((m) => (
            <option key={m.v} value={m.v}>{m.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Node code"
          value={nodeCodeFilter}
          onChange={(e) => setNodeCodeFilter(e.target.value)}
          className={`${formControlClass} h-8 w-36 text-xs`}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <div className={cn(headingClass, "text-[13.5px]")}>
            {modelId && selectedModelLabel
              ? `Values by period · ${selectedModelLabel}`
              : "Values by period"}
          </div>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            Chart uses mapping level 1 · table below uses level 2 · grouped by {chartAxisLabel.toLowerCase()}
          </p>
        </div>

        <div
          key={`chart-${periodGroup}-${chartDateFrom}-${chartDateTo}`}
          className="h-[320px] min-h-[320px] w-full min-w-0 px-3 pb-2 pt-3"
        >
          {chartLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">Loading…</div>
          ) : hasLineChartSeries && lineChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={lineChartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1FA97A" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#1FA97A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="#E1E9E4" vertical={false} />
                <XAxis
                  dataKey="xLabel"
                  stroke="#5B6B63"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#E1E9E4" }}
                />
                <YAxis
                  stroke="#5B6B63"
                  fontSize={10}
                  width={68}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompactCurrencyAxis(v)}
                  label={{
                    value: `Amount (${DISPLAY_CURRENCY_CODE})`,
                    angle: -90,
                    position: "insideLeft",
                    fill: "#5B6B63",
                    fontSize: 11,
                    style: { textAnchor: "middle" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #E1E9E4",
                    borderRadius: "10px",
                    color: "#122019",
                    fontSize: 12,
                  }}
                  formatter={(v: number | string | undefined) =>
                    v != null && v !== "" && Number.isFinite(Number(v))
                      ? formatCurrencyValue(Number(v))
                      : "—"
                  }
                  labelFormatter={(label) => `${chartAxisLabel} ${label}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8, color: "#5B6B63" }}
                  formatter={(value) => {
                    const row = levelOneChartRows.find((r) => r.code === value);
                    const label = row?.name ?? value;
                    return label.length > 36 ? `${label.slice(0, 35)}…` : label;
                  }}
                />
                {levelOneChartRows.map((row, i) => (
                  <Area
                    key={row.code}
                    type="monotone"
                    dataKey={row.code}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2.5}
                    fill={i === 0 ? "url(#dashAreaFill)" : "transparent"}
                    fillOpacity={1}
                    dot={{ r: 2.5, strokeWidth: 1 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-muted">
              <p className="font-semibold text-ink">No chart data for these filters.</p>
              <p className="max-w-lg text-center text-xs leading-relaxed text-ink-muted">
                Check company/model match the upload, mapping cells extract numbers, and report year/month was set.
              </p>
            </div>
          )}
        </div>

        {usingLevelFallback && hasLineChartSeries && (
          <p className="px-5 pb-2 text-xs text-amber-800 dark:text-amber-300">
            Showing all extracted codes because this mapping has no level-1 rows.
          </p>
        )}

        {chartTable && chartTable.rows.length > 0 && (
          <div className="border-t border-line">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <p className="text-xs font-medium text-ink-muted">
                Level 2 table
                {usingLevelFallback ? " (fallback: all codes with values)" : ""}
              </p>
              <select
                value={tableCategoryFilter}
                onChange={(e) => setTableCategoryFilter(e.target.value)}
                className={`${formControlClass} h-8 min-w-[200px] text-xs`}
              >
                <option value="">All categories</option>
                {RISK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className={`max-h-[min(28rem,60vh)] rounded-none border-0 ${tableWrapClass}`}>
              <table className={`${tableClass} min-w-[32rem]`}>
                <thead className={theadClass}>
                  <tr>
                    <th className={`${thClass} text-left`}>Name</th>
                    {tableColumns.map((col) => (
                      <th key={col} className={`${thClass} text-right`}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {levelTwoChartRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, tableColumns.length) + 1}
                        className="px-4 py-8 text-center text-ink-muted"
                      >
                        No rows match the current filters.
                      </td>
                    </tr>
                  ) : (
                    levelTwoChartRows.map((row) => (
                      <tr key={row.code} className={trClass}>
                        <td className={`${tdClass} font-semibold`}>
                          <HierarchyCodeCell
                            code={row.code}
                            displayText={row.name}
                            depth={0}
                            hasChildren={false}
                            isExpanded={false}
                            onToggle={() => {}}
                            textClassName="font-semibold text-ink"
                          />
                        </td>
                        {tableColumns.map((col) => {
                          const v = row.values[col] ?? row.values[Number(col) as unknown as keyof typeof row.values];
                          return (
                            <td key={col} className={`${tdClass} text-right font-mono text-ink`}>
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
    </div>
  );
}

