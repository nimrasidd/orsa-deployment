import * as React from "react";
import { listAllModels, type ModelOut } from "../api/regions";
import { getUploadTree, listUploads } from "../api/uploads";
import { Card } from "../components/Card";
import { ReportTreeDiagram } from "../components/ReportTreeDiagram";
import { Segmented } from "../components/Segmented";
import { formatValueToSigFigs } from "../lib/format";
import type { TreeNode, UploadOut } from "../types";
import { toast } from "sonner";
import { Cpu } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWorkspace } from "../workspace/tabs";
import { Button } from "../components/Button";
import { Columns2 } from "lucide-react";

export function ModelsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openOrActivate } = useWorkspace();
  const [tab, setTab] = React.useState<"list" | "compare">("list");

  React.useEffect(() => {
    const state = location.state as { tab?: string } | null;
    if (state?.tab === "compare") {
      setTab("compare");
    }
  }, [location.state]);

  const [allModels, setAllModels] = React.useState<ModelOut[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [compareReports, setCompareReports] = React.useState<UploadOut[]>([]);
  const [compareLeftId, setCompareLeftId] = React.useState<string | null>(null);
  const [compareRightId, setCompareRightId] = React.useState<string | null>(null);
  const [compareLeftTree, setCompareLeftTree] = React.useState<TreeNode[]>([]);
  const [compareRightTree, setCompareRightTree] = React.useState<TreeNode[]>([]);
  const [compareLeftExpanded, setCompareLeftExpanded] = React.useState<Set<string>>(() => new Set());
  const [compareRightExpanded, setCompareRightExpanded] = React.useState<Set<string>>(() => new Set());
  const [compareLoading, setCompareLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    listAllModels()
      .then((data) => setAllModels(Array.isArray(data) ? data : []))
      .catch(() => setAllModels([]))
      .finally(() => setLoading(false));
  }, []);

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
    return () => {
      cancelled = true;
    };
  }, [tab, compareLeftId, compareRightId]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Application Models</div>
          <div className="mt-1 text-xs text-slate-400">
            All regional application models in one list. Compare two uploaded reports side by side on the Compare tab.
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
              : `${allModels.length} application model(s). Sorted by region, country, and name.`
          }
        >
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading models…</div>
          ) : allModels.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No application models found. Seed regions/countries/models or create models per country.
            </div>
          ) : (
            <div className="max-h-[min(32rem,70vh)] overflow-auto rounded-lg border border-white/10 [scrollbar-gutter:stable] [scrollbar-width:thin]">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-slate-950/95 text-xs text-slate-400 backdrop-blur-sm">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Country</th>
                    <th className="px-4 py-3 font-medium">Region</th>
                    <th className="px-4 py-3 font-medium font-mono text-[11px]">ID</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {allModels.map((m) => (
                    <tr key={m.id} className="border-t border-white/10 hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2 font-medium text-slate-100">
                          <Cpu className="h-4 w-4 shrink-0 text-sky-400" />
                          {m.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">{m.country_name}</td>
                      <td className="px-4 py-2.5 text-slate-400">{m.region_name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{m.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
