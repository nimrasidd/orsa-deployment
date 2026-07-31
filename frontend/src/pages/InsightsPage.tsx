import * as React from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  RefreshCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getInsightsSummary, type InsightsSummary, type InsightMetric } from "../api/insights";
import { getChartTable, type ChartTableData } from "../api/reports";
import { listAllModels, listCompanies, companyLabel, type CompanyOut, type ModelOut } from "../api/regions";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { formControlClass, labelClass } from "../components/ui";
import { cn } from "../lib/cn";
import { formatCompactCurrencyAxis, formatCurrencyValue } from "../lib/format";

type ViewData = {
  company_name: string | null;
  reporting_period: string | null;
  headline_metrics: InsightMetric[];
  top_movers: InsightMetric[];
  alerts: string[];
  narrative: string;
  llm_used: boolean;
};

type KriItem = {
  name: string;
  change_pct: number;
  severity: "high" | "med";
};

const SOLVENCY_RATIO_RE =
  /solvency\s*ratio|scr\s*ratio|coverage\s*ratio|own\s*funds\s*to\s*(?:solvency|scr)|to\s*solvency\s*capital\s*requirement/i;
const SOLVENCY_TARGET = 150;

function findSolvencyRatio(metrics: InsightMetric[]): InsightMetric | null {
  return metrics.find((m) => SOLVENCY_RATIO_RE.test(m.name)) ?? null;
}

function splitNarrative(narrative: string): { summary: string; recommendation: string | null } {
  const marker = /Recommendation:\s*/i;
  const idx = narrative.search(marker);
  if (idx < 0) {
    const firstPara = narrative.split(/\n\n/)[0]?.trim() ?? narrative;
    return { summary: firstPara, recommendation: null };
  }
  const summary = narrative.slice(0, idx).trim().replace(/\n\nKey Figures:[\s\S]*$/i, "").trim();
  const recommendation = narrative.slice(idx).replace(marker, "").trim();
  return {
    summary: summary || narrative.split(/\n\n/)[0]?.trim() || narrative,
    recommendation: recommendation || null,
  };
}

function buildKris(headlines: InsightMetric[], movers: InsightMetric[]): KriItem[] {
  const seen = new Set<string>();
  const out: KriItem[] = [];
  const push = (m: InsightMetric) => {
    if (m.change_pct == null || seen.has(m.code)) return;
    const abs = Math.abs(m.change_pct);
    if (abs < 5) return;
    seen.add(m.code);
    out.push({
      name: m.name,
      change_pct: m.change_pct,
      severity: abs >= 50 || m.change_pct <= -10 ? "high" : "med",
    });
  };
  for (const m of headlines) push(m);
  for (const m of movers) push(m);
  out.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
  return out.slice(0, 6);
}

function seriesForMetric(
  chartData: ChartTableData | null,
  code: string
): (number | null)[] {
  if (!chartData) return [];
  const periods = chartData.periods ?? chartData.years.map(String);
  const row = chartData.rows.find((r) => r.code === code);
  if (!row) return [];
  return periods.map((p) => {
    const v = row.values[p];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  });
}

function buildClientSideInsights(
  chartData: ChartTableData,
  companyName: string | null,
  selectedPeriod?: string | null
): ViewData {
  const periods = chartData.periods ?? chartData.years.map(String);
  const latestPeriod =
    selectedPeriod && periods.includes(selectedPeriod)
      ? selectedPeriod
      : periods[periods.length - 1] ?? "Latest";
  const latestIdx = periods.indexOf(latestPeriod);
  const prevPeriod = latestIdx > 0 ? periods[latestIdx - 1] : null;

  const headlines: InsightMetric[] = [];
  const movers: InsightMetric[] = [];

  for (const row of chartData.rows) {
    const latestVal = row.values[latestPeriod] ?? null;
    const prevVal = prevPeriod ? (row.values[prevPeriod] ?? null) : null;
    let changePct: number | null = null;
    if (latestVal != null && prevVal != null && prevVal !== 0) {
      changePct = Math.round(((latestVal - prevVal) / Math.abs(prevVal)) * 1000) / 10;
    }

    const metric: InsightMetric = {
      code: row.code,
      name: row.name,
      value: latestVal,
      change_pct: changePct,
      period: latestPeriod,
    };

    if (row.level === 1) {
      headlines.push(metric);
    } else if (row.level === 2 && changePct != null) {
      movers.push(metric);
    }
  }

  // Fallback: if no level-1 rows have values, use any rows with values as headlines
  if (!headlines.some((h) => h.value != null)) {
    for (const row of chartData.rows) {
      if (headlines.some((h) => h.code === row.code)) continue;
      const latestVal = row.values[latestPeriod] ?? null;
      if (latestVal == null) continue;
      const prevVal = prevPeriod ? (row.values[prevPeriod] ?? null) : null;
      let changePct: number | null = null;
      if (prevVal != null && prevVal !== 0) {
        changePct = Math.round(((latestVal - prevVal) / Math.abs(prevVal)) * 1000) / 10;
      }
      headlines.push({
        code: row.code,
        name: row.name,
        value: latestVal,
        change_pct: changePct,
        period: latestPeriod,
      });
      if (headlines.length >= 8) break;
    }
  }

  movers.sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0));

  const alerts: string[] = [];
  for (const m of headlines) {
    if (m.change_pct == null) continue;
    if (m.change_pct <= -10) alerts.push(`${m.name} dropped ${Math.abs(m.change_pct).toFixed(1)}% - review required`);
    else if (m.change_pct >= 20) alerts.push(`${m.name} increased ${m.change_pct.toFixed(1)}% - significant growth`);
    else if (m.change_pct <= -5) alerts.push(`${m.name} decreased ${Math.abs(m.change_pct).toFixed(1)}%`);
  }
  for (const m of movers.slice(0, 3)) {
    if (m.change_pct != null && Math.abs(m.change_pct) >= 15) {
      const dir = m.change_pct > 0 ? "up" : "down";
      alerts.push(`${m.name} moved ${dir} ${Math.abs(m.change_pct).toFixed(1)}%`);
    }
  }

  const improving = headlines.filter((m) => (m.change_pct ?? 0) > 0).length;
  const declining = headlines.filter((m) => (m.change_pct ?? 0) < 0).length;
  const trend =
    improving > declining
      ? "an improving trend"
      : declining > improving
        ? "areas requiring attention"
        : "a stable position";

  const topNamed = headlines.filter((m) => m.value != null).slice(0, 3);
  let narrative = `Your company shows ${trend} across ${headlines.length} key capital metrics this quarter`;
  if (topNamed.length) {
    const sharpest = [...topNamed].sort(
      (a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0)
    )[0];
    if (sharpest?.change_pct != null && Math.abs(sharpest.change_pct) >= 10) {
      narrative += `, with the sharpest move in ${sharpest.name.toLowerCase()}`;
    }
  }
  narrative +=
    ". Growth of this scale is worth a quick sanity check against source data before it's reported.";
  narrative +=
    "\n\nRecommendation: Review flagged metrics and confirm capital buffers remain within risk appetite thresholds before this period is finalized.";

  return {
    company_name: companyName,
    reporting_period: latestPeriod,
    headline_metrics: headlines.slice(0, 8),
    top_movers: movers.slice(0, 5),
    alerts: alerts.slice(0, 6),
    narrative,
    llm_used: false,
  };
}

function formatRelativeTime(ts: number | null): string {
  if (!ts) return "Just now";
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return "Updated just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `Updated ${min} min ago`;
  const hr = Math.round(min / 60);
  return `Updated ${hr}h ago`;
}

function formatChipValue(m: InsightMetric): string {
  const val =
    m.value == null
      ? "—"
      : Math.abs(m.value) >= 1000
        ? formatCompactCurrencyAxis(m.value)
        : formatCurrencyValue(m.value);
  if (m.change_pct == null) return val;
  const arrow = m.change_pct > 0 ? "▲" : "▼";
  return `${val} · ${arrow}${Math.abs(m.change_pct).toFixed(1)}%`;
}

export function InsightsPage() {
  const { user } = useAuth();
  const [chartData, setChartData] = React.useState<ChartTableData | null>(null);
  const [apiFallback, setApiFallback] = React.useState<ViewData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState<number | null>(null);

  const [companies, setCompanies] = React.useState<CompanyOut[]>([]);
  const [models, setModels] = React.useState<ModelOut[]>([]);
  const [companyId, setCompanyId] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [period, setPeriod] = React.useState("");

  React.useEffect(() => {
    listCompanies()
      .then((c) => setCompanies(Array.isArray(c) ? c : []))
      .catch(() => setCompanies([]));
    listAllModels()
      .then((m) => setModels(Array.isArray(m) ? m : []))
      .catch(() => setModels([]));
  }, []);

  React.useEffect(() => {
    if (!user) return;
    if (!user.is_admin && user.company_id) {
      setCompanyId(user.company_id);
      return;
    }
    setCompanyId((prev) => {
      if (prev && companies.some((c) => c.id === prev)) return prev;
      return companies[0]?.id ?? "";
    });
  }, [user?.id, user?.is_admin, user?.company_id, companies]);

  const selectedCompanyName =
    companies.find((c) => c.id === companyId)?.name ??
    (!user?.is_admin ? user?.company_name ?? null : null);

  const availablePeriods = React.useMemo(
    () => chartData?.periods ?? chartData?.years?.map(String) ?? [],
    [chartData]
  );

  React.useEffect(() => {
    if (!availablePeriods.length) {
      setPeriod("");
      return;
    }
    setPeriod((prev) =>
      prev && availablePeriods.includes(prev) ? prev : availablePeriods[availablePeriods.length - 1]
    );
  }, [availablePeriods]);

  const load = React.useCallback(
    async (isRefresh = false) => {
      if (!companyId) {
        setChartData(null);
        setApiFallback(null);
        setError("Select a company to view solvency overview for one entity and period.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const nextChart = await getChartTable({
          company_id: companyId,
          model_id: modelId || undefined,
          period_group: "quarter",
        });

        if (nextChart && nextChart.rows.length > 0) {
          setChartData(nextChart);
          setApiFallback(null);
          setUpdatedAt(Date.now());
          setLoading(false);
          setRefreshing(false);
          return;
        }

        setChartData(null);
        try {
          const result: InsightsSummary = await getInsightsSummary({
            company_id: companyId,
            model_id: modelId || undefined,
          });
          if (result && (result.headline_metrics?.length > 0 || result.narrative)) {
            setApiFallback(result);
            setUpdatedAt(Date.now());
            setLoading(false);
            setRefreshing(false);
            return;
          }
        } catch {
          // ignore
        }

        setApiFallback(null);
        setError("No report data found for this company. Upload a report first.");
      } catch {
        setChartData(null);
        setApiFallback(null);
        setError("Unable to load data. Please try refreshing or check your connection.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId, modelId]
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const data = React.useMemo(() => {
    if (chartData && period) {
      return buildClientSideInsights(chartData, selectedCompanyName, period);
    }
    return apiFallback;
  }, [chartData, period, selectedCompanyName, apiFallback]);

  const kpiMetrics = data?.headline_metrics.slice(0, 3) ?? [];
  const solvencyMetric = data ? findSolvencyRatio(data.headline_metrics) : null;
  const { summary, recommendation } = data
    ? splitNarrative(data.narrative)
    : { summary: "", recommendation: null };
  const kris = data ? buildKris(data.headline_metrics, data.top_movers) : [];
  const maxMoverAbs = Math.max(
    1,
    ...(data?.top_movers.map((m) => Math.abs(m.change_pct ?? 0)) ?? [1])
  );

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Topline */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-heading">
            Solvency Overview
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            AI-powered summary of your latest capital and risk position
            {selectedCompanyName ? ` · ${selectedCompanyName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {updatedAt != null && !loading && !error && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-panel px-3 py-1.5 text-xs font-semibold text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              {formatRelativeTime(updatedAt)}
            </span>
          )}
          {(data?.reporting_period || period) && (
            <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-900 dark:bg-brand-500/15 dark:text-brand-200">
              Period: {data?.reporting_period || period}
            </span>
          )}
        </div>
      </div>

      {/* Compact filters */}
      <div className="rounded-2xl border border-line bg-surface-panel p-4 shadow-sm dark:bg-surface-2/90">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={!!user && !user.is_admin}
              title={user && !user.is_admin ? "Your account is limited to your company" : undefined}
              className={formControlClass}
            >
              {user?.is_admin ? <option value="">Select company</option> : null}
              {companies.map((co) => (
                <option key={co.id} value={co.id}>
                  {companyLabel(co)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Model (optional)</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className={formControlClass}
            >
              <option value="">All models</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Quarter</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={!availablePeriods.length}
              className={formControlClass}
            >
              {!availablePeriods.length ? <option value="">No periods yet</option> : null}
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
            <div className="h-52 animate-pulse rounded-2xl border border-line bg-surface-2/50" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-line bg-surface-2/50" />
              ))}
            </div>
          </div>
          <div className="h-48 animate-pulse rounded-2xl border border-line bg-surface-2/50" />
        </div>
      ) : error ? (
        <Card>
          <div className="flex flex-col items-center py-8 text-center">
            <TrendingUp className="h-8 w-8 text-ink-soft" />
            <p className="mt-3 max-w-md text-[13px] text-ink-muted">{error}</p>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => void load()}>
              <RefreshCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </Card>
      ) : data ? (
        <>
          {/* Hero: ring + KPIs */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
            <SolvencyRing metric={solvencyMetric} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {kpiMetrics.length ? (
                kpiMetrics.map((m) => (
                  <KpiCard
                    key={m.code}
                    metric={m}
                    series={seriesForMetric(chartData, m.code)}
                  />
                ))
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-line bg-surface-panel px-4 py-8 text-center text-sm text-ink-muted dark:bg-surface-2/90">
                  No headline metrics for this period yet.
                </div>
              )}
            </div>
          </div>

          {/* AI analysis */}
          <div className="rounded-2xl border border-line bg-surface-panel p-5 shadow-sm dark:bg-surface-2/90">
            <div className="mb-3.5 flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-brand-500 to-brand-900 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[14.5px] font-bold text-heading">
                  AI Analysis{data.reporting_period ? ` — ${data.reporting_period}` : ""}
                </div>
                <div className="text-[11.5px] text-ink-soft">
                  Generated from {Math.min(3, data.headline_metrics.length)} key capital metrics
                  {data.llm_used ? " · AI-generated" : ""}
                </div>
              </div>
            </div>

            <p className="mb-3.5 text-[13.5px] leading-relaxed text-ink-muted">{summary}</p>

            {kpiMetrics.length > 0 && (
              <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {kpiMetrics.map((m) => (
                  <div
                    key={m.code}
                    className="rounded-[10px] border border-line bg-surface px-3 py-2.5 dark:bg-surface-3/40"
                  >
                    <div className="mb-0.5 text-[11px] text-ink-soft">{m.name}</div>
                    <div
                      className={cn(
                        "font-mono text-[13px] font-semibold",
                        (m.change_pct ?? 0) > 0
                          ? "text-brand-700 dark:text-brand-300"
                          : (m.change_pct ?? 0) < 0
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-ink"
                      )}
                    >
                      {formatChipValue(m)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2.5 rounded-[10px] bg-brand-900 px-3.5 py-3 text-[12.5px] leading-snug text-brand-50 dark:bg-brand-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div>
                <span className="font-semibold text-white">Recommendation. </span>
                {recommendation ||
                  "Review flagged metrics and confirm capital buffers remain within risk appetite thresholds before this period is finalized."}
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="mt-3.5"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing…" : "Refresh analysis"}
            </Button>
          </div>

          {/* KRI + Top movers */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-line bg-surface-panel p-5 shadow-sm dark:bg-surface-2/90">
              <div className="mb-0.5 flex items-center gap-2 text-[13.5px] font-bold text-heading">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Key Risk Indicators
              </div>
              <p className="mb-3.5 text-[11.5px] text-ink-soft">
                Metrics flagged for significant period-over-period movement
              </p>
              {kris.length ? (
                <div className="flex flex-col">
                  {kris.map((k) => (
                    <div
                      key={k.name}
                      className="flex items-center gap-2.5 border-b border-surface py-2.5 text-[12.5px] last:border-b-0 dark:border-line/40"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          k.severity === "high" ? "bg-amber-500" : "bg-brand-500"
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{k.name}</span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[11.5px] font-semibold",
                          k.change_pct >= 0
                            ? "text-brand-700 dark:text-brand-300"
                            : "text-rose-700 dark:text-rose-300"
                        )}
                      >
                        {k.change_pct >= 0 ? "▲" : "▼"}
                        {Math.abs(k.change_pct).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12.5px] text-ink-muted">No significant movements flagged for this period.</p>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-surface-panel p-5 shadow-sm dark:bg-surface-2/90">
              <div className="mb-0.5 text-[13.5px] font-bold text-heading">Top Movers</div>
              <p className="mb-3.5 text-[11.5px] text-ink-soft">Largest changes in risk sub-categories</p>
              {data.top_movers.length ? (
                <div className="space-y-2.5">
                  {data.top_movers.slice(0, 4).map((m) => {
                    const abs = Math.abs(m.change_pct ?? 0);
                    const width = Math.min(100, Math.round((abs / maxMoverAbs) * 100));
                    return (
                      <div
                        key={m.code}
                        className="rounded-[10px] border border-line bg-surface px-3.5 py-3 dark:bg-surface-3/40"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2 text-[12.5px]">
                          <b className="min-w-0 truncate font-semibold text-ink">{m.name}</b>
                          <span
                            className={cn(
                              "shrink-0 font-bold",
                              (m.change_pct ?? 0) >= 0
                                ? "text-brand-700 dark:text-brand-300"
                                : "text-rose-700 dark:text-rose-300"
                            )}
                          >
                            {(m.change_pct ?? 0) >= 0 ? "▲" : "▼"}
                            {abs.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-900"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12.5px] text-ink-muted">No level-2 movers for this period.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SolvencyRing({ metric }: { metric: InsightMetric | null }) {
  const value = metric?.value ?? null;
  // Treat values like 1.78 as 178%, or 178 as already percent
  const pct =
    value == null
      ? null
      : Math.abs(value) <= 5
        ? value * 100
        : value;

  const circumference = 2 * Math.PI * 62;
  const clamped = pct == null ? 0 : Math.max(0, Math.min(100, (pct / (SOLVENCY_TARGET * 1.4)) * 100));
  const offset = circumference - (clamped / 100) * circumference;
  const label =
    pct == null
      ? "—"
      : `${pct >= 10 ? Math.round(pct) : pct.toFixed(1)}%`;

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface-panel px-5 py-6 shadow-sm dark:bg-surface-2/90">
      <div className="relative grid place-items-center">
        <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden>
          <circle cx="75" cy="75" r="62" fill="none" className="stroke-brand-100 dark:stroke-brand-900/50" strokeWidth="14" />
          <circle
            cx="75"
            cy="75"
            r="62"
            fill="none"
            stroke="url(#solvencyRingGrad)"
            strokeWidth="14"
            strokeDasharray={circumference}
            strokeDashoffset={pct == null ? circumference : offset}
            strokeLinecap="round"
            transform="rotate(-90 75 75)"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
          <defs>
            <linearGradient id="solvencyRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#16b36a" />
              <stop offset="100%" stopColor="#06452a" />
            </linearGradient>
          </defs>
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="font-display text-[26px] font-bold tracking-tight text-ink">{label}</div>
        </div>
      </div>
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
        Solvency Ratio
      </div>
      <div className="text-[11px] text-ink-muted">
        {metric ? `Target ≥ ${SOLVENCY_TARGET}%` : "No ratio metric in this model"}
      </div>
    </div>
  );
}

function KpiCard({
  metric,
  series,
}: {
  metric: InsightMetric;
  series: (number | null)[];
}) {
  const formatted = metric.value != null ? formatCurrencyValue(metric.value) : "—";
  // Amber for very large positive swings (sanity-check vibe from mock), green otherwise when up
  const deltaTone =
    metric.change_pct == null
      ? null
      : metric.change_pct < 0
        ? "down"
        : Math.abs(metric.change_pct) >= 200
          ? "warn"
          : "up";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-panel px-[18px] pb-3.5 pt-[18px] shadow-sm dark:bg-surface-2/90">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] font-semibold uppercase tracking-[0.05em] text-ink-soft">
          {metric.name}
        </span>
        <ChangeBadge pct={metric.change_pct} tone={deltaTone} />
      </div>
      <div className="font-display text-[21px] font-bold tracking-tight text-ink">{formatted}</div>
      <Sparkline series={series} tone={deltaTone === "warn" ? "warn" : deltaTone === "down" ? "down" : "up"} />
    </div>
  );
}

function ChangeBadge({
  pct,
  tone,
}: {
  pct: number | null;
  tone?: "up" | "down" | "warn" | null;
}) {
  if (pct == null) return null;
  const positive = pct > 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  const resolved = tone ?? (positive ? "up" : "down");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold",
        resolved === "up" && "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
        resolved === "warn" && "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        resolved === "down" && "bg-rose-500/15 text-rose-800 dark:text-rose-300"
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function Sparkline({
  series,
  tone,
}: {
  series: (number | null)[];
  tone: "up" | "down" | "warn";
}) {
  const nums = series.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length < 2) {
    return <div className="h-[34px]" />;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const w = 200;
  const h = 40;
  const pad = 2;
  const pts = series
    .map((v, i) => {
      if (v == null || !Number.isFinite(v)) return null;
      const x = (i / Math.max(1, series.length - 1)) * w;
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");

  const stroke =
    tone === "warn" ? "#C97A22" : tone === "down" ? "#e11d48" : "#1FA34A";

  return (
    <svg className="block h-[34px] w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
