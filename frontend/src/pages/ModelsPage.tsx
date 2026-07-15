import * as React from "react";
import { getUploadNodes, getUploadTree, listUploads } from "../api/uploads";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { HierarchyCodeCell } from "../components/HierarchyCodeCell";
import { HierarchyExpandControls } from "../components/HierarchyExpandControls";
import { Input } from "../components/Input";
import { computeHierarchyTableView } from "../lib/hierarchyTable";
import { ReportTreeDiagram } from "../components/ReportTreeDiagram";
import { formatCurrencyValue, formatValueToSigFigs } from "../lib/format";
import type { ReportNodeOut, TreeNode, UploadOut } from "../types";
import { toast } from "sonner";

function displayFileLabel(u: UploadOut | null, fallback: string): string {
  if (!u) return fallback;
  const name = (u.original_filename || "").trim();
  if (name) return name;
  return `${u.report_key} v${u.version_no}`;
}

function truncateFileName(name: string, max = 32): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function parseComparableNumber(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

type CompareRow = {
  code: string;
  description: string | null;
  aVal: string | number | null;
  bVal: string | number | null;
  diff: number | null;
  level: number;
  parent_code: string | null;
};

/** Full outer join on `code`: all codes from A ∪ B, sorted. */
function buildCompareRows(a: ReportNodeOut[], b: ReportNodeOut[]): CompareRow[] {
  const mapA = new Map(a.map((n) => [n.code, n]));
  const mapB = new Map(b.map((n) => [n.code, n]));
  const codes = [...new Set([...mapA.keys(), ...mapB.keys()])];
  codes.sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));

  return codes.map((code) => {
    const na = mapA.get(code);
    const nb = mapB.get(code);
    const aVal = na?.value ?? null;
    const bVal = nb?.value ?? null;
    const naNum = parseComparableNumber(aVal);
    const nbNum = parseComparableNumber(bVal);
    const diff = naNum !== null && nbNum !== null ? nbNum - naNum : null;
    const level = na?.level ?? nb?.level ?? 0;
    const rawParent = na?.parent_code ?? nb?.parent_code ?? null;
    const parentTrim = rawParent != null && String(rawParent).trim() !== "" ? String(rawParent).trim() : null;
    return {
      code,
      description: na?.description ?? nb?.description ?? null,
      aVal,
      bVal,
      diff,
      level,
      parent_code: parentTrim
    };
  });
}

export function ModelsPage() {
  const [compareReports, setCompareReports] = React.useState<UploadOut[]>([]);
  const [compareLeftId, setCompareLeftId] = React.useState<string | null>(null);
  const [compareRightId, setCompareRightId] = React.useState<string | null>(null);
  const [compareLeftTree, setCompareLeftTree] = React.useState<TreeNode[]>([]);
  const [compareRightTree, setCompareRightTree] = React.useState<TreeNode[]>([]);
  const [compareLeftNodes, setCompareLeftNodes] = React.useState<ReportNodeOut[]>([]);
  const [compareRightNodes, setCompareRightNodes] = React.useState<ReportNodeOut[]>([]);
  const [compareLeftExpanded, setCompareLeftExpanded] = React.useState<Set<string>>(() => new Set());
  const [compareRightExpanded, setCompareRightExpanded] = React.useState<Set<string>>(() => new Set());
  const [compareLoading, setCompareLoading] = React.useState(false);
  const [tableSearch, setTableSearch] = React.useState("");
  const [diffFilter, setDiffFilter] = React.useState<"all" | "nonzero" | "missing">("all");
  const [showCompareDiagrams, setShowCompareDiagrams] = React.useState(false);
  const [compareTableExpanded, setCompareTableExpanded] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    listUploads({ latestOnly: false })
      .then((data) => setCompareReports(Array.isArray(data) ? data : []))
      .catch(() => setCompareReports([]));
  }, []);

  const leftUpload = compareLeftId ? compareReports.find((u) => u.id === compareLeftId) ?? null : null;
  const rightUpload = compareRightId ? compareReports.find((u) => u.id === compareRightId) ?? null : null;

  const modelCheck = React.useMemo(() => {
    if (!leftUpload || !rightUpload) return { ok: false as const, message: null as string | null };
    if (leftUpload.id === rightUpload.id) {
      return { ok: false as const, message: "Choose two different uploads." };
    }
    if (!leftUpload.model_id || !rightUpload.model_id) {
      return {
        ok: false as const,
        message: "Both uploads must have a model assigned. Re-upload with a model selected if needed."
      };
    }
    if (leftUpload.model_id !== rightUpload.model_id) {
      return {
        ok: false as const,
        message: "These uploads belong to different models. Select two uploads from the same model to compare values."
      };
    }
    return { ok: true as const, message: null };
  }, [leftUpload, rightUpload]);

  React.useEffect(() => {
    setShowCompareDiagrams(false);
    setCompareTableExpanded(new Set());
  }, [compareLeftId, compareRightId]);

  React.useEffect(() => {
    if (!compareLeftId && !compareRightId) {
      setCompareLeftTree([]);
      setCompareRightTree([]);
      setCompareLeftNodes([]);
      setCompareRightNodes([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setCompareLoading(true);
      try {
        const [leftTree, rightTree, leftNodes, rightNodes] = await Promise.all([
          compareLeftId ? getUploadTree(compareLeftId) : Promise.resolve([]),
          compareRightId ? getUploadTree(compareRightId) : Promise.resolve([]),
          compareLeftId ? getUploadNodes(compareLeftId) : Promise.resolve([]),
          compareRightId ? getUploadNodes(compareRightId) : Promise.resolve([])
        ]);
        if (!cancelled) {
          setCompareLeftTree(Array.isArray(leftTree) ? leftTree : []);
          setCompareRightTree(Array.isArray(rightTree) ? rightTree : []);
          setCompareLeftNodes(Array.isArray(leftNodes) ? leftNodes : []);
          setCompareRightNodes(Array.isArray(rightNodes) ? rightNodes : []);
        }
      } catch {
        if (!cancelled) {
          setCompareLeftTree([]);
          setCompareRightTree([]);
          setCompareLeftNodes([]);
          setCompareRightNodes([]);
        }
      } finally {
        if (!cancelled) setCompareLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [compareLeftId, compareRightId]);

  const compareRows = React.useMemo(() => {
    if (!modelCheck.ok) return [];
    return buildCompareRows(compareLeftNodes, compareRightNodes);
  }, [modelCheck.ok, compareLeftNodes, compareRightNodes]);

  const filteredCompareRows = React.useMemo(() => {
    let rows = compareRows;
    const q = tableSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.code.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q)
      );
    }
    if (diffFilter === "nonzero") {
      rows = rows.filter((r) => r.diff !== null && r.diff !== 0);
    }
    if (diffFilter === "missing") {
      rows = rows.filter((r) => r.aVal == null || r.aVal === "" || r.bVal == null || r.bVal === "");
    }
    return rows;
  }, [compareRows, tableSearch, diffFilter]);

  const hasCompareRowFilter =
    tableSearch.trim() !== "" || diffFilter === "nonzero" || diffFilter === "missing";

  const compareTableView = React.useMemo(
    () => computeHierarchyTableView(compareRows, filteredCompareRows, compareTableExpanded, hasCompareRowFilter),
    [compareRows, filteredCompareRows, compareTableExpanded, hasCompareRowFilter]
  );
  const codesWithChildren = compareTableView.codesWithChildren;

  const toggleCompareTableRow = React.useCallback((code: string) => {
    setCompareTableExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const leftFileLabel = displayFileLabel(leftUpload, "First file");
  const rightFileLabel = displayFileLabel(rightUpload, "Second file");

  return (
    <Card
      title="Compare uploads"
      subtitle="Pick two uploads from the same model. Values are joined on code; difference is second file minus first."
      actions={
        compareReports.length >= 2 ? (
          <span className="text-xs text-slate-500">{compareReports.length} upload(s) available</span>
        ) : null
      }
    >
        <div className="space-y-4">
          {compareReports.length < 2 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              {compareReports.length === 0
                ? "No uploads found. Create uploads from the Upload page first."
                : "Need at least 2 uploads to compare."}
            </div>
          ) : compareLoading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col space-y-2 rounded-xl bg-slate-900/30 p-4 ring-1 ring-white/5">
                  <div
                    className="shrink-0 text-sm font-medium text-slate-300 truncate"
                    title={leftUpload ? leftUpload.original_filename : undefined}
                  >
                    {leftFileLabel}
                  </div>
                  <select
                    value={compareLeftId ?? ""}
                    onChange={(e) => setCompareLeftId(e.target.value || null)}
                    className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                  >
                    <option value="">Select first upload</option>
                    {compareReports.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.report_key} v{u.version_no}
                        {u.model_id ? "" : " · no model"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col space-y-2 rounded-xl bg-slate-900/30 p-4 ring-1 ring-white/5">
                  <div
                    className="shrink-0 text-sm font-medium text-slate-300 truncate"
                    title={rightUpload ? rightUpload.original_filename : undefined}
                  >
                    {rightFileLabel}
                  </div>
                  <select
                    value={compareRightId ?? ""}
                    onChange={(e) => setCompareRightId(e.target.value || null)}
                    className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                  >
                    <option value="">Select second upload</option>
                    {compareReports.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.report_key} v{u.version_no}
                        {u.model_id ? "" : " · no model"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {modelCheck.message && compareLeftId && compareRightId ? (
                <div
                  className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                  role="status"
                >
                  {modelCheck.message}
                </div>
              ) : null}

              {modelCheck.ok && compareRows.length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                  <div className="mb-3 flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                      <div className="text-sm font-medium text-slate-200">
                        Comparison table
                        <span className="ml-2 font-normal text-xs text-slate-500">
                          {compareTableView.flat.length} of {compareRows.length} row
                          {compareRows.length !== 1 ? "s" : ""} visible
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xl sm:flex-row sm:items-center">
                        <Input
                          placeholder="Filter by code or description…"
                          value={tableSearch}
                          onChange={(e) => setTableSearch(e.target.value)}
                          className="h-10 w-full sm:min-w-[200px] sm:flex-1"
                        />
                        <select
                          value={diffFilter}
                          onChange={(e) => setDiffFilter(e.target.value as "all" | "nonzero" | "missing")}
                          className="h-10 shrink-0 rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                        >
                          <option value="all">All rows</option>
                          <option value="nonzero">Non-zero difference</option>
                          <option value="missing">Missing value on either side</option>
                        </select>
                      </div>
                    </div>
                    <HierarchyExpandControls
                      canExpand={codesWithChildren.size > 0}
                      onExpandAll={() => setCompareTableExpanded(new Set(codesWithChildren))}
                      onCollapseAll={() => setCompareTableExpanded(new Set())}
                    />
                  </div>
                  <div className="max-h-[min(28rem,50vh)] overflow-auto rounded-lg border border-white/10 [scrollbar-gutter:stable]">
                    <table className="w-full min-w-[42rem] text-left text-sm">
                      <thead className="sticky top-0 z-[1] bg-slate-950/95 text-xs text-slate-400">
                        <tr className="border-b border-white/10">
                          <th className="px-3 py-2 font-medium">Code</th>
                          <th className="max-w-[12rem] px-3 py-2 font-medium">Description</th>
                          <th className="max-w-[11rem] px-3 py-2 text-right font-medium" title={leftUpload?.original_filename}>
                            <span className="block truncate">
                              {leftUpload ? truncateFileName(leftUpload.original_filename || leftFileLabel) : leftFileLabel}
                            </span>
                            {leftUpload ? (
                              <span className="mt-0.5 block font-normal text-[10px] text-slate-500">
                                v{leftUpload.version_no} · {leftUpload.report_key}
                              </span>
                            ) : null}
                          </th>
                          <th className="max-w-[11rem] px-3 py-2 text-right font-medium" title={rightUpload?.original_filename}>
                            <span className="block truncate">
                              {rightUpload ? truncateFileName(rightUpload.original_filename || rightFileLabel) : rightFileLabel}
                            </span>
                            {rightUpload ? (
                              <span className="mt-0.5 block font-normal text-[10px] text-slate-500">
                                v{rightUpload.version_no} · {rightUpload.report_key}
                              </span>
                            ) : null}
                          </th>
                          <th className="px-3 py-2 text-right font-medium">Difference</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-200">
                        {filteredCompareRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="border-t border-white/10 px-3 py-12 text-center text-sm text-slate-500">
                              No rows match your filters. Clear the search or set the row filter to &quot;All rows&quot;.
                            </td>
                          </tr>
                        ) : (
                          compareTableView.flat.map(({ row, depth }) => {
                            const hasKids = codesWithChildren.has(row.code);
                            const isOpen = compareTableView.expandedForWalk.has(row.code);
                            return (
                              <tr key={row.code} className="border-t border-white/10">
                                <td className="px-3 py-2 font-mono text-brand-200">
                                  <HierarchyCodeCell
                                    code={row.code}
                                    depth={depth}
                                    hasChildren={hasKids}
                                    isExpanded={isOpen}
                                    onToggle={() => toggleCompareTableRow(row.code)}
                                    textClassName="font-mono text-brand-200"
                                  />
                                </td>
                                <td className="max-w-[12rem] px-3 py-2 text-xs text-slate-400">
                                  <span className="line-clamp-2">{row.description ?? "—"}</span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-slate-100">
                                  {row.aVal != null && row.aVal !== "" ? formatValueToSigFigs(row.aVal) : "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-slate-100">
                                  {row.bVal != null && row.bVal !== "" ? formatValueToSigFigs(row.bVal) : "—"}
                                </td>
                                <td
                                  className={`px-3 py-2 text-right font-mono ${
                                    row.diff === null
                                      ? "text-slate-500"
                                      : row.diff === 0
                                        ? "text-slate-400"
                                        : row.diff > 0
                                          ? "text-emerald-300"
                                          : "text-rose-300"
                                  }`}
                                >
                                  {row.diff === null ? "—" : formatCurrencyValue(row.diff)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Difference (second file minus first) when both values are numeric. Rows include codes from either upload.
                  </p>
                </div>
              ) : null}

              {modelCheck.ok && compareLeftId && compareRightId && compareRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-slate-400">
                  No rows to compare (empty node lists).
                </div>
              ) : null}

              {compareLeftId && compareRightId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCompareDiagrams((v) => !v)}
                    aria-expanded={showCompareDiagrams}
                  >
                    {showCompareDiagrams ? "Hide tree diagrams" : "Show tree diagrams"}
                  </Button>
                </div>
              ) : null}

              {showCompareDiagrams && compareLeftId && compareRightId ? (
                <>
                  <div className="text-xs font-medium text-slate-500">Tree diagrams</div>
                  <div className="grid min-h-[min(400px,50vh)] grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="flex min-h-[min(350px,45vh)] flex-col space-y-2 rounded-xl bg-slate-900/30 p-4 ring-1 ring-white/5">
                      <div className="shrink-0 text-xs text-slate-500 truncate" title={leftUpload?.original_filename}>
                        {leftFileLabel}
                      </div>
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
                          {compareLeftId ? "No tree data for this upload" : "Select first upload"}
                        </div>
                      )}
                    </div>
                    <div className="flex min-h-[min(350px,45vh)] flex-col space-y-2 rounded-xl bg-slate-900/30 p-4 ring-1 ring-white/5">
                      <div className="shrink-0 text-xs text-slate-500 truncate" title={rightUpload?.original_filename}>
                        {rightFileLabel}
                      </div>
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
                          {compareRightId ? "No tree data for this upload" : "Select second upload"}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
    </Card>
  );
}
