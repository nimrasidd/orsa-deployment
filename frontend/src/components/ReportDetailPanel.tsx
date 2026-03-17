import * as React from "react";
import { toast } from "sonner";
import { getUploadDebug, getUploadNodes, getUploadTree } from "../api/uploads";
import { ReportTreeDiagram } from "./ReportTreeDiagram";
import { TreeView } from "./TreeView";
import { Input } from "./Input";
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
  const [selected, setSelected] = React.useState<TreeNode | null>(null);
  const [view, setView] = React.useState<"tree" | "nodes" | "diagram">("diagram");
  const [debug, setDebug] = React.useState<{ node_count: number; has_nodes: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [tree, flat] = await Promise.all([getUploadTree(uploadId), getUploadNodes(uploadId)]);
      setRoots(tree);
      setNodes(flat);
      const exp = new Set<string>();
      collectExpandableCodes(tree.slice(0, 3), exp);
      setExpanded(exp);
      setSelected(null);
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

  function onToggle(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-slate-900/50 ring-1 ring-white/5">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
        <span className="truncate text-sm font-medium text-slate-200">{title}</span>
        <div className="flex items-center gap-2">
          <select
            value={view}
            onChange={(e) => setView(e.target.value as "tree" | "nodes" | "diagram")}
            className="h-8 rounded-lg bg-white/5 px-2 text-xs text-slate-100 ring-1 ring-white/10"
          >
            <option value="tree">Tree</option>
            <option value="nodes">Nodes</option>
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
              <ReportTreeDiagram
              roots={roots}
              expanded={expanded}
              onExpandedChange={setExpanded}
              onSelect={setSelected}
            />
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">
              No nodes. {debug != null && `Debug: ${debug.node_count} node(s).`}
            </div>
          )
        ) : view === "tree" ? (
          roots.length ? (
            <TreeView
              roots={roots}
              search={search}
              expanded={expanded}
              onToggle={onToggle}
              selectedCode={selected?.code}
              onSelect={setSelected}
            />
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">No nodes.</div>
          )
        ) : nodes.length ? (
          <div className="overflow-auto">
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
                {nodes
                  .filter((n) => {
                    const q = search.trim().toLowerCase();
                    if (!q) return true;
                    return `${n.code} ${n.description ?? ""}`.toLowerCase().includes(q);
                  })
                  .slice(0, 300)
                  .map((n) => (
                    <tr key={n.id} className="border-t border-white/5">
                      <td className="py-1.5 pr-2 font-medium">{n.code}</td>
                      <td className="py-1.5 pr-2">{n.level}</td>
                      <td className="hidden py-1.5 pr-2 md:table-cell truncate max-w-[120px]">
                        {n.description ?? ""}
                      </td>
                      <td className="py-1.5 text-right text-slate-100">{formatValueToSigFigs(n.value)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {nodes.length > 300 && (
              <div className="mt-2 text-xs text-slate-500">Showing first 300. Use search to narrow.</div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">No nodes found.</div>
        )}
      </div>
    </div>
  );
}
