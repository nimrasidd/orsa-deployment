import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getUploadDebug, getUploadNodes, getUploadTree } from "../api/uploads";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Segmented } from "../components/Segmented";
import { ReportTreeDiagram } from "../components/ReportTreeDiagram";
import { TreeView } from "../components/TreeView";
import { formatValueToSigFigs } from "../lib/format";
import type { ReportNodeOut, TreeNode } from "../types";
import { RefreshCcw } from "lucide-react";

function collectExpandableCodes(nodes: TreeNode[], set: Set<string>) {
  for (const n of nodes) {
    if (n.children.length) set.add(n.code);
    collectExpandableCodes(n.children, set);
  }
}

export function UploadDetail() {
  const { uploadId } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [roots, setRoots] = React.useState<TreeNode[]>([]);
  const [nodes, setNodes] = React.useState<ReportNodeOut[]>([]);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<TreeNode | null>(null);
  const [view, setView] = React.useState<"tree" | "nodes" | "diagram">("tree");
  const [debug, setDebug] = React.useState<{ node_count: number; has_nodes: boolean } | null>(null);

  async function load() {
    if (!uploadId) return;
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
      toast.error("Failed to load tree", {
        description: e?.detail ? String(e.detail) : String(e?.message ?? e)
      });
      setDebug(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Report tree</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <Badge>upload: {uploadId?.slice(0, 10)}</Badge>
            <span>Explore hierarchy from your Excel upload.</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Link to="/">
            <Button variant="ghost">Back</Button>
          </Link>
          <Button variant="ghost" onClick={load} disabled={loading}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <Card
        title="Workspace"
        subtitle={loading ? "Loading…" : "Switch between Tree and Nodes. Search applies to the active view."}
        actions={
              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                  value={view}
                  onChange={(v) => setView(v as "tree" | "nodes" | "diagram")}
                  items={[
                    { value: "tree", label: "Tree" },
                    { value: "nodes", label: "Nodes" },
                    { value: "diagram", label: "Diagram" }
                  ]}
                />
                <div className="w-[260px]">
                  <Input
                    placeholder="Search code or description…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
        }
      >
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
            ) : view === "diagram" ? (
              roots.length ? (
                <ReportTreeDiagram
                  roots={roots}
                  expanded={expanded}
                  onExpandedChange={setExpanded}
                  onSelect={setSelected}
                />
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">
                  <p>No nodes found for this upload.</p>
                  {debug != null && (
                    <p className="mt-2 text-xs text-slate-500">Debug: server reports {debug.node_count} node(s).</p>
                  )}
                  <Link to="/upload" className="mt-4 inline-block text-sky-400 hover:text-sky-300">
                    Re-upload file
                  </Link>
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
                <div className="py-10 text-center text-sm text-slate-400">
                  <p>No nodes found for this upload.</p>
                  {debug != null && (
                    <p className="mt-2 text-xs text-slate-500">Debug: server reports {debug.node_count} node(s).</p>
                  )}
                  <Link to="/upload" className="mt-4 inline-block text-sky-400 hover:text-sky-300">
                    Re-upload file
                  </Link>
                </div>
              )
            ) : nodes.length ? (
              <div className="overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-400">
                    <tr className="[&>th]:pb-3 [&>th]:font-medium">
                      <th>Code</th>
                      <th>Level</th>
                      <th className="hidden md:table-cell">Description</th>
                      <th className="text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {nodes
                      .filter((n) => {
                        const q = search.trim().toLowerCase();
                        if (!q) return true;
                        return `${n.code} ${n.description ?? ""}`.toLowerCase().includes(q);
                      })
                      .slice(0, 500)
                      .map((n) => (
                        <tr key={n.id} className="border-t border-white/10 [&>td]:py-2">
                          <td className="pr-3 font-medium">{n.code}</td>
                          <td className="pr-3 text-slate-300">{n.level}</td>
                          <td className="hidden pr-3 text-slate-300 md:table-cell">
                            <span className="line-clamp-1">{n.description ?? ""}</span>
                          </td>
                          <td className="text-right text-slate-100">{formatValueToSigFigs(n.value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {nodes.length > 500 ? (
                  <div className="mt-3 text-xs text-slate-400">
                    Showing first 500 rows. Use search to narrow results.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-slate-400">
                <p>No nodes found for this upload.</p>
                <p className="mt-2 text-xs">
                  This can happen if the upload failed partway (e.g. numeric overflow) or the database connection fell back to SQLite while you query Supabase.
                </p>
                {debug != null && (
                  <p className="mt-2 text-xs text-slate-500">
                    Debug: server reports {debug.node_count} node(s).
                  </p>
                )}
                <Link to="/upload" className="mt-4 inline-block text-sky-400 hover:text-sky-300">
                  Re-upload file
                </Link>
              </div>
            )}
      </Card>
    </>
  );
}

