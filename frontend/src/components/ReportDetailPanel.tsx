import * as React from "react";
import { toast } from "sonner";
import { getUploadDebug, getUploadNodes, getUploadTree } from "../api/uploads";
import { HierarchyCodeCell } from "./HierarchyCodeCell";
import { HierarchyExpandControls } from "./HierarchyExpandControls";
import { ReportTreeDiagram } from "./ReportTreeDiagram";
import { Input } from "./Input";
import { computeHierarchyTableView } from "../lib/hierarchyTable";
import { formatValueToSigFigs } from "../lib/format";
import type { ReportNodeOut, TreeNode } from "../types";

function collectExpandableCodes(nodes: TreeNode[], set: Set<string>) {
  for (const n of nodes) {
    if (n.children.length) set.add(n.code);
    collectExpandableCodes(n.children, set);
  }
}

type Props = {
  uploadId: string;
  title: string;
  compact?: boolean;
};

export function ReportDetailPanel({ uploadId, title, compact }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [roots, setRoots] = React.useState<TreeNode[]>([]);
  const [nodes, setNodes] = React.useState<ReportNodeOut[]>([]);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState<"table" | "diagram">("diagram");
  const [debug, setDebug] = React.useState<{ node_count: number; has_nodes: boolean } | null>(null);
  const [tableExpanded, setTableExpanded] = React.useState<Set<string>>(() => new Set());

  async function load() {
    setLoading(true);
    try {
      const [tree, flat] = await Promise.all([getUploadTree(uploadId), getUploadNodes(uploadId)]);
      setRoots(tree);
      setNodes(flat);
      const exp = new Set<string>();
      collectExpandableCodes(tree.slice(0, 3), exp);
      setExpanded(exp);
      setTableExpanded(new Set());
      if (tree.length === 0 && flat.length === 0) {
        getUploadDebug(uploadId)
          .then((d) => setDebug({ node_count: d.node_count, has_nodes: d.has_nodes }))
          .catch(() => setDebug(null));
      } else {
        setDebug(null);
      }
    } catch (e: any) {
      toast.error("Failed to load report", {
        description: e?.detail ? String(e.detail) : String(e?.message ?? e)
      });
      setDebug(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, [uploadId]);

  const tableHierarchyRows = React.useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        parent_code: n.parent_code?.trim() || null
      })),
    [nodes]
  );

  const filteredTableRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tableHierarchyRows;
    return tableHierarchyRows.filter((n) =>
      `${n.code} ${n.description ?? ""}`.toLowerCase().includes(q)
    );
  }, [tableHierarchyRows, search]);

  const tableView = React.useMemo(
    () =>
      computeHierarchyTableView(tableHierarchyRows, filteredTableRows, tableExpanded, search.trim() !== ""),
    [tableHierarchyRows, filteredTableRows, tableExpanded, search]
  );

  const toggleTableRow = React.useCallback((code: string) => {
    setTableExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const tableFlatLimited = React.useMemo(() => tableView.flat.slice(0, 300), [tableView.flat]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-slate-900/50 ring-1 ring-white/5">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
        <span className="truncate text-sm font-medium text-slate-200">{title}</span>
        <div className="flex items-center gap-2">
          <select
            value={view}
            onChange={(e) => setView(e.target.value as "table" | "diagram")}
            className="h-8 rounded-lg bg-white/5 px-2 text-xs text-slate-100 ring-1 ring-white/10"
          >
            <option value="table">Table</option>
            <option value="diagram">Diagram</option>
          </select>
          {!compact && (
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-32 text-xs"
            />
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-500">Loading…</div>
        ) : view === "diagram" ? (
          roots.length ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-auto">
              <ReportTreeDiagram roots={roots} expanded={expanded} onExpandedChange={setExpanded} />
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">
              No hierarchy to diagram. {debug != null && `Debug: ${debug.node_count} row(s).`}
            </div>
          )
        ) : nodes.length ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <HierarchyExpandControls
              canExpand={tableView.codesWithChildren.size > 0}
              onExpandAll={() => setTableExpanded(new Set(tableView.codesWithChildren))}
              onCollapseAll={() => setTableExpanded(new Set())}
            />
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-2 pr-2">Code</th>
                    <th className="pb-2 pr-2">Level</th>
                    <th className="hidden pb-2 pr-2 md:table-cell">Description</th>
                    <th className="pb-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {filteredTableRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border-t border-white/5 py-6 text-center text-slate-500">
                        No rows match your search.
                      </td>
                    </tr>
                  ) : (
                    tableFlatLimited.map(({ row: n, depth }) => {
                      const hasKids = tableView.codesWithChildren.has(n.code);
                      const isOpen = tableView.expandedForWalk.has(n.code);
                      return (
                        <tr key={n.id} className="border-t border-white/5">
                          <td className="py-1.5 pr-2 font-medium">
                            <HierarchyCodeCell
                              code={n.code}
                              depth={depth}
                              hasChildren={hasKids}
                              isExpanded={isOpen}
                              onToggle={() => toggleTableRow(n.code)}
                              textClassName="font-medium text-slate-100"
                            />
                          </td>
                          <td className="py-1.5 pr-2">{n.level}</td>
                          <td className="hidden max-w-[120px] truncate py-1.5 pr-2 md:table-cell">
                            {n.description ?? ""}
                          </td>
                          <td className="py-1.5 text-right text-slate-100">{formatValueToSigFigs(n.value)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {tableView.flat.length > 300 ? (
                <div className="mt-2 text-xs text-slate-500">Showing first 300 visible rows. Use search or collapse.</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">No rows to show.</div>
        )}
      </div>
    </div>
  );
}
