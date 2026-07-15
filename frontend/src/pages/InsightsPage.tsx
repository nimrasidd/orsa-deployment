import * as React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  FileUp,
  LayoutDashboard,
  MapPin,
  RefreshCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getInsightsSummary, type InsightsSummary, type InsightMetric } from "../api/insights";
import { getChartTable, type ChartTableData } from "../api/reports";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { cn } from "../lib/cn";
import { formatCurrencyValue } from "../lib/format";

type ViewData = {
  company_name: string | null;
  reporting_period: string | null;
  headline_metrics: InsightMetric[];
  top_movers: InsightMetric[];
  alerts: string[];
  narrative: string;
  llm_used: boolean;
};

function buildClientSideInsights(
  chartData: ChartTableData,
  companyName: string | null
): ViewData {
  const periods = chartData.periods ?? chartData.years.map(String);
  const latestPeriod = periods[periods.length - 1] ?? "Latest";
  const prevPeriod = periods.length >= 2 ? periods[periods.length - 2] : null;

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

  const improving = headlines.filter(m => (m.change_pct ?? 0) > 0).length;
  const declining = headlines.filter(m => (m.change_pct ?? 0) < 0).length;
  const trend = improving > declining ? "an improving trend" : declining > improving ? "areas requiring attention" : "a stable position";

  let narrative = `Solvency Overview for ${latestPeriod}: ${companyName || "Your company"} shows ${trend} across ${headlines.length} key capital metrics.\n\nKey Figures:`;
  for (const m of headlines.slice(0, 4)) {
    if (m.value != null) {
      const valStr = Math.abs(m.value) >= 1000 ? m.value.toLocaleString("en-US", { maximumFractionDigits: 0 }) : m.value.toFixed(2);
      let changeStr = "";
      if (m.change_pct != null) {
        const dir = m.change_pct > 0 ? "increased" : "decreased";
        changeStr = ` - ${dir} ${Math.abs(m.change_pct).toFixed(1)}% vs prior period`;
      }
      narrative += `\n  - ${m.name}: ${valStr}${changeStr}`;
    }
  }
  if (alerts.length > 0) {
    narrative += "\n\nSuggested KRIs to monitor:";
    for (const a of alerts.slice(0, 3)) {
      narrative += `\n  - ${a}`;
    }
  }
  narrative += "\n\nRecommendation: Review flagged metrics and ensure capital buffers remain within risk appetite thresholds.";

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

export function InsightsPage() {
  const { user } = useAuth();
  const [data, setData] = React.useState<ViewData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const companyId = user?.is_admin ? undefined : user?.company_id ?? undefined;
  const companyName = user?.company_name ?? null;

  const load = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await getInsightsSummary({ company_id: companyId });
      if (result && (result.headline_metrics?.length > 0 || result.narrative)) {
        setData(result);
        setLoading(false);
        setRefreshing(false);
        return;
      }
    } catch {
      // Insights endpoint failed — fall through to chart-table
    }

    try {
      const chartData = await getChartTable({
        company_id: companyId,
        period_group: "quarter",
      });
      if (chartData && chartData.rows.length > 0) {
        setData(buildClientSideInsights(chartData, companyName));
      } else {
        setError("No report data found. The insights will populate once reports are available in the system.");
      }
    } catch {
      setError("Unable to load data. Please try refreshing or check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, companyName]);

  React.useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-line bg-gradient-to-br from-brand-600/10 via-surface-panel to-surface-panel p-5 shadow-sm dark:from-brand-500/15 dark:via-surface-panel/80 dark:to-surface-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-base font-semibold tracking-tight text-ink">
              {companyName || "Solvency"} Overview
            </h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              AI-powered summary of your latest capital and risk position
            </p>
          </div>
          {data?.reporting_period && (
            <span className="rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-800 dark:text-brand-200">
              Period: {data.reporting_period}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-line bg-surface-2/50" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <div className="flex flex-col items-center py-6 text-center">
            <TrendingUp className="h-8 w-8 text-ink-muted/40" />
            <p className="mt-3 max-w-md text-[13px] text-ink-muted">{error}</p>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => void load()}>
              <RefreshCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </Card>
      ) : data ? (
        <>
          {/* KPI Cards */}
          {data.headline_metrics.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.headline_metrics.map((m) => (
                <KpiCard key={m.code} metric={m} />
              ))}
            </div>
          )}

          {/* AI Narrative */}
          <Card>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/15 ring-1 ring-brand-400/20">
                <Sparkles className="h-4 w-4 text-brand-700 dark:text-brand-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-semibold text-ink">AI Analysis</h3>
                  {data.llm_used && (
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-ink-muted">AI-generated</span>
                  )}
                </div>
                <div className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-muted">
                  {data.narrative || "No analysis available."}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void load(true)}
                    disabled={refreshing}
                  >
                    <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                    {refreshing ? "Refreshing..." : "Refresh analysis"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-ink">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                Key Risk Indicators
              </div>
              <ul className="mt-2 space-y-1.5">
                {data.alerts.map((alert, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-ink-muted">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    {alert}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Top movers */}
          {data.top_movers.length > 0 && (
            <Card title="Top Movers" subtitle="Largest changes in risk sub-categories">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {data.top_movers.map((m) => (
                  <div
                    key={m.code}
                    className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
                  >
                    <span className="truncate text-[12px] font-medium text-ink">{m.name}</span>
                    <ChangeBadge pct={m.change_pct} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : null}

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" desc="Charts and detailed data table" />
        <QuickLink to="/reports" icon={FileUp} label="Reports" desc="View and upload reports" />
        <QuickLink to="/mappings" icon={MapPin} label="Mappings" desc="Manage extraction mappings" />
      </div>
    </div>
  );
}

function KpiCard({ metric }: { metric: InsightMetric }) {
  const formatted = metric.value != null ? formatCurrencyValue(metric.value) : "\u2014";
  return (
    <div className="rounded-xl border border-line bg-surface-panel p-4 shadow-sm dark:bg-surface-2/90">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {metric.name}
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-ink">
            {formatted}
          </div>
        </div>
        <ChangeBadge pct={metric.change_pct} />
      </div>
    </div>
  );
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const positive = pct > 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        positive
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  desc,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-line bg-surface-panel p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-md dark:bg-surface-2/90"
    >
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 ring-1 ring-brand-400/20 transition group-hover:scale-105">
          <Icon className="h-4 w-4 text-brand-700 dark:text-brand-300" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink">{label}</div>
          <div className="text-[11px] text-ink-muted">{desc}</div>
        </div>
      </div>
    </Link>
  );
}
