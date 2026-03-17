import * as React from "react";
import {
  listRegions,
  listCountriesByRegion,
  listModelsByCountry,
  type RegionOut,
  type CountryOut,
  type ApplicationModelOut
} from "../api/regions";
import { getUploadTree, listUploads } from "../api/uploads";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { ReportTreeDiagram } from "../components/ReportTreeDiagram";
import { Segmented } from "../components/Segmented";
import { formatValueToSigFigs } from "../lib/format";
import type { TreeNode, UploadOut } from "../types";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Cpu } from "lucide-react";
import { cn } from "../lib/cn";
import { useNavigate, useLocation } from "react-router-dom";
import { useWorkspace } from "../workspace/tabs";
import { Button } from "../components/Button";
import { Columns2 } from "lucide-react";

export function ModelsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openOrActivate } = useWorkspace();
  const [tab, setTab] = React.useState<"list" | "compare">("list");

  // When returning from side-by-side view, switch to Compare tab
  React.useEffect(() => {
    const state = location.state as { tab?: string } | null;
    if (state?.tab === "compare") {
      setTab("compare");
    }
  }, [location.state]);
  const [regions, setRegions] = React.useState<RegionOut[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedRegion, setExpandedRegion] = React.useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = React.useState<string | null>(null);
  const [countriesByRegion, setCountriesByRegion] = React.useState<Record<string, CountryOut[]>>({});
  const [modelsByCountry, setModelsByCountry] = React.useState<Record<string, ApplicationModelOut[]>>({});

  const [compareReports, setCompareReports] = React.useState<UploadOut[]>([]);
  const [compareLeftId, setCompareLeftId] = React.useState<string | null>(null);
  const [compareRightId, setCompareRightId] = React.useState<string | null>(null);
  const [compareLeftTree, setCompareLeftTree] = React.useState<TreeNode[]>([]);
  const [compareRightTree, setCompareRightTree] = React.useState<TreeNode[]>([]);
  const [compareLeftExpanded, setCompareLeftExpanded] = React.useState<Set<string>>(() => new Set());
  const [compareRightExpanded, setCompareRightExpanded] = React.useState<Set<string>>(() => new Set());
  const [compareLoading, setCompareLoading] = React.useState(false);

  React.useEffect(() => {
    listRegions()
      .then((data) => setRegions(Array.isArray(data) ? data : []))
      .catch(() => setRegions([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (!expandedRegion) return;
    if (countriesByRegion[expandedRegion]) return;
    listCountriesByRegion(expandedRegion)
      .then((data) => {
        setCountriesByRegion((prev) => ({ ...prev, [expandedRegion]: Array.isArray(data) ? data : [] }));
      })
      .catch(() => {
        setCountriesByRegion((prev) => ({ ...prev, [expandedRegion]: [] }));
      });
  }, [expandedRegion, countriesByRegion]);

  React.useEffect(() => {
    if (!expandedCountry) return;
    if (modelsByCountry[expandedCountry]) return;
    listModelsByCountry(expandedCountry)
      .then((data) => {
        setModelsByCountry((prev) => ({ ...prev, [expandedCountry]: Array.isArray(data) ? data : [] }));
      })
      .catch(() => {
        setModelsByCountry((prev) => ({ ...prev, [expandedCountry]: [] }));
      });
  }, [expandedCountry, modelsByCountry]);

  React.useEffect(() => {
    if (tab !== "compare") return;
    listUploads({ latestOnly: false })
      .then((data) => setCompareReports(Array.isArray(data) ? data : []))
      .catch(() => setCompareReports([]));
  }, [tab]);

  React.useEffect(() => {
    if (tab !== "compare") return;
    let cancelled = false;
    const load = async () => {
      setCompareLoading(true);
      try {
        const [left, right] = await Promise.all([
          compareLeftId ? getUploadTree(compareLeftId) : Promise.resolve([]),
          compareRightId ? getUploadTree(compareRightId) : Promise.resolve([])
        ]);
        if (!cancelled) {
          setCompareLeftTree(Array.isArray(left) ? left : []);
          setCompareRightTree(Array.isArray(right) ? right : []);
        }
      } catch {
        if (!cancelled) {
          setCompareLeftTree([]);
          setCompareRightTree([]);
        }
      } finally {
        if (!cancelled) setCompareLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [tab, compareLeftId, compareRightId]);

  function toggleRegion(id: string) {
    setExpandedRegion((prev) => (prev === id ? null : id));
    if (expandedCountry) setExpandedCountry(null);
  }

  function toggleCountry(id: string) {
    setExpandedCountry((prev) => (prev === id ? null : id));
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Application Models</div>
          <div className="mt-1 text-xs text-slate-400">
            Browse regions, countries, and their models. Compare two models side by side.
          </div>
        </div>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as "list" | "compare")}
          items={[
            { value: "list", label: "List" },
            { value: "compare", label: "Compare" }
          ]}
        />
      </div>

      {tab === "compare" ? (
        <Card
          title="Compare Reports"
          subtitle="Select two reports to compare side by side. Displays description and values."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {compareReports.length >= 2 && (
                <span className="text-xs text-slate-500">
                  {compareReports.length} report(s) available
                </span>
              )}
              {compareLeftId && compareRightId && (
                <Button
                  variant="primary"
                  onClick={() => {
                    const path = `/compare/${compareLeftId}/${compareRightId}`;
                    const leftReport = compareReports.find((u) => u.id === compareLeftId);
                    const rightReport = compareReports.find((u) => u.id === compareRightId);
                    const leftTitle = leftReport ? `${leftReport.report_key} v${leftReport.version_no}` : "Left";
                    const rightTitle = rightReport ? `${rightReport.report_key} v${rightReport.version_no}` : "Right";
                    openOrActivate({
                      path,
                      title: `Compare: ${leftReport?.report_key ?? "Left"} vs ${rightReport?.report_key ?? "Right"}`
                    });
                    navigate(path, { state: { leftTitle, rightTitle } });
                  }}
                >
                  <Columns2 className="mr-1.5 h-4 w-4" />
                  Open side by side
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            <div className="text-xs text-slate-500">
              Select two reports to compare side by side. Click nodes to expand/collapse.
            </div>
            {compareReports.length < 2 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                {compareReports.length === 0
                  ? "No reports found. Upload Excel files to get started."
                  : "Need at least 2 reports to compare."}
              </div>
            ) : compareLoading ? (
              <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
            ) : (
              <div className="grid min-h-[min(400px,50vh)] grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex min-h-[min(350px,45vh)] flex-col space-y-2 rounded-xl bg-slate-900/30 p-4 ring-1 ring-white/5">
                  <div className="shrink-0 text-sm font-medium text-slate-300">Left</div>
                  <select
                    value={compareLeftId ?? ""}
                    onChange={(e) => setCompareLeftId(e.target.value || null)}
                    className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  >
                    <option value="">Select report</option>
                    {compareReports.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.report_key} v{u.version_no}
                      </option>
                    ))}
                  </select>
                  {compareLeftTree.length > 0 ? (
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <ReportTreeDiagram
                        roots={compareLeftTree}
                        expanded={compareLeftExpanded}
                        onExpandedChange={setCompareLeftExpanded}
                        onSelect={(node) =>
                          toast.info(node.code, {
                            description: node.description ?? formatValueToSigFigs(node.value)
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-slate-500">
                      {compareLeftId ? "No data for this report" : "Select a report"}
                    </div>
                  )}
                </div>
                <div className="flex min-h-[min(350px,45vh)] flex-col space-y-2 rounded-xl bg-slate-900/30 p-4 ring-1 ring-white/5">
                  <div className="shrink-0 text-sm font-medium text-slate-300">Right</div>
                  <select
                    value={compareRightId ?? ""}
                    onChange={(e) => setCompareRightId(e.target.value || null)}
                    className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  >
                    <option value="">Select report</option>
                    {compareReports.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.report_key} v{u.version_no}
                      </option>
                    ))}
                  </select>
                  {compareRightTree.length > 0 ? (
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <ReportTreeDiagram
                        roots={compareRightTree}
                        expanded={compareRightExpanded}
                        onExpandedChange={setCompareRightExpanded}
                        onSelect={(node) =>
                          toast.info(node.code, {
                            description: node.description ?? formatValueToSigFigs(node.value)
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-slate-500">
                      {compareRightId ? "No data for this report" : "Select a report"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
      <Card
        title="Models"
        subtitle={
          loading
            ? "Loading…"
            : `${regions.length} region(s). Click to expand and see countries and models.`
        }
      >
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading regions…</div>
        ) : regions.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No regions found. Run database migrations to seed master data.
          </div>
        ) : (
          <div className="space-y-1">
            {regions.map((region) => {
              const isRegionOpen = expandedRegion === region.id;
              const countries = countriesByRegion[region.id] ?? [];
              return (
                <div key={region.id} className="rounded-lg ring-1 ring-white/5">
                  <button
                    type="button"
                    onClick={() => toggleRegion(region.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition",
                      "hover:bg-white/5"
                    )}
                  >
                    {isRegionOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="font-medium text-slate-100">{region.name}</span>
                    <Badge className="text-slate-300">
                      {isRegionOpen ? `${countries.length} countries` : "Expand"}
                    </Badge>
                  </button>
                  {isRegionOpen && (
                    <div className="border-t border-white/5 pl-6 pr-3 pb-3 pt-1">
                      {countries.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-500">Loading countries…</div>
                      ) : (
                        <div className="space-y-1">
                          {countries.map((country) => {
                            const isCountryOpen = expandedCountry === country.id;
                            const models = modelsByCountry[country.id] ?? [];
                            return (
                              <div key={country.id} className="rounded-lg ring-1 ring-white/5">
                                <button
                                  type="button"
                                  onClick={() => toggleCountry(country.id)}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                                    "hover:bg-white/5"
                                  )}
                                >
                                  {isCountryOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                                  )}
                                  <span className="text-slate-200">{country.name}</span>
                                  <Badge className="bg-sky-500/15 text-sky-200 ring-sky-400/25 text-xs">
                                    {isCountryOpen ? `${models.length} models` : "Expand"}
                                  </Badge>
                                </button>
                                {isCountryOpen && (
                                  <div className="border-t border-white/5 pl-6 pr-3 pb-3 pt-2">
                                    {models.length === 0 ? (
                                      <div className="py-3 text-center text-xs text-slate-500">
                                        Loading models…
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {models.map((model) => (
                                          <div
                                            key={model.id}
                                            className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 ring-1 ring-white/10"
                                          >
                                            <Cpu className="h-4 w-4 text-sky-300" />
                                            <span className="font-medium text-slate-100">{model.name}</span>
                                            <span className="text-xs text-slate-500">({model.id.slice(0, 8)}…)</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      )}
    </>
  );
}
