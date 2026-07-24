import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getUploadDebug, getUploadNodes, getUploadTree } from "../api/uploads";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Segmented } from "../components/Segmented";
import { HierarchyCodeCell } from "../components/HierarchyCodeCell";
import { HierarchyExpandControls } from "../components/HierarchyExpandControls";
import { ReportTreeDiagram } from "../components/ReportTreeDiagram";
import { computeHierarchyTableView } from "../lib/hierarchyTable";
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
  const [view, setView] = React.useState<"table" | "diagram">("table");
  const [debug, setDebug] = React.useState<{ node_count: number; has_nodes: boolean } | null>(null);
  const [tableExpanded, setTableExpanded] = React.useState<Set<string>>(() => new Set());

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const tableFlatLimited = React.useMemo(() => tableView.flat.slice(0, 500), [tableView.flat]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">Report</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
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
        subtitle={loading ? "Loading…" : "Switch between Table and Diagram. Search applies to the active view."}
        actions={
              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                  value={view}
                  onChange={(v) => setView(v as "table" | "diagram")}
                  items={[
                    { value: "table", label: "Table" },
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
              <div className="py-10 text-center text-sm text-ink-muted">Loading…</div>
            ) : view === "diagram" ? (
              roots.length ? (
                <ReportTreeDiagram
                  roots={roots}
                  expanded={expanded}
                  onExpandedChange={setExpanded}
                />
              ) : (
                <div className="py-10 text-center text-sm text-ink-muted">
                  <p>No data for diagram view.</p>
                  {debug != null && (
                    <p className="mt-2 text-xs text-ink-muted">Debug: server reports {debug.node_count} row(s).</p>
                  )}
                  <Link to="/upload" className="mt-4 inline-block text-brand-400 hover:text-brand-300">
                    Re-upload file
                  </Link>
                </div>
              )
            ) : nodes.length ? (
              <div className="space-y-3">
                <HierarchyExpandControls
                  canExpand={tableView.codesWithChildren.size > 0}
                  onExpandAll={() => setTableExpanded(new Set(tableView.codesWithChildren))}
                  onCollapseAll={() => setTableExpanded(new Set())}
                />
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-ink-muted">
                      <tr className="[&>th]:pb-3 [&>th]:font-medium">
                        <th>Code</th>
                        <th>Level</th>
                        <th className="hidden md:table-cell">Description</th>
                        <th className="text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="text-ink">
                      {filteredTableRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="border-t border-line py-8 text-center text-sm text-ink-muted">
                            No rows match your search.
                          </td>
                        </tr>
                      ) : (
                        tableFlatLimited.map(({ row: n, depth }) => {
                          const hasKids = tableView.codesWithChildren.has(n.code);
                          const isOpen = tableView.expandedForWalk.has(n.code);
                          return (
                            <tr key={n.id} className="border-t border-line [&>td]:py-2">
                              <td className="pr-3 font-medium">
                                <HierarchyCodeCell
                                  code={n.code}
                                  depth={depth}
                                  hasChildren={hasKids}
                                  isExpanded={isOpen}
                                  onToggle={() => toggleTableRow(n.code)}
                                  textClassName="font-medium text-ink"
                                />
                              </td>
                              <td className="pr-3 text-ink">{n.level}</td>
                              <td className="hidden pr-3 text-ink md:table-cell">
                                <span className="line-clamp-1">{n.description ?? ""}</span>
                              </td>
                              <td className="text-right text-ink">{formatValueToSigFigs(n.value)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  {tableView.flat.length > 500 ? (
                    <div className="mt-3 text-xs text-ink-muted">
                      Showing first 500 visible rows. Use search or collapse sections to narrow results.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-ink-muted">
                <p>No rows for this upload.</p>
                <p className="mt-2 text-xs">
                  This can happen if the upload failed partway (e.g. numeric overflow) or the database connection fell back to SQLite while you query Supabase.
                </p>
                {debug != null && (
                  <p className="mt-2 text-xs text-ink-muted">
                    Debug: server reports {debug.node_count} row(s).
                  </p>
                )}
                <Link to="/upload" className="mt-4 inline-block text-brand-400 hover:text-brand-300">
                  Re-upload file
                </Link>
              </div>
            )}
      </Card>
    </>
  );
}

