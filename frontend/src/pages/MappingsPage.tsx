import * as React from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  activateMapping,
  createMapping,
  deleteMapping,
  downloadMappingWorkbook,
  getMappingItems,
  listMappings
} from "../api/mappings";
import { createModel, deleteModel, listAllModels, listAllCountries, type CountryOut, type ModelOut } from "../api/regions";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import type { MappingItemOut, MappingOut } from "../types";
import { HierarchyCodeCell } from "../components/HierarchyCodeCell";
import { HierarchyExpandControls } from "../components/HierarchyExpandControls";
import { MappingTreeDiagram, buildMappingTree } from "../components/MappingTreeDiagram";
import { Segmented } from "../components/Segmented";
import { computeHierarchyTableView } from "../lib/hierarchyTable";
import { CheckCircle2, Download, Eye, FileSpreadsheet, MapPin, Plus, Trash2, UploadCloud, XCircle } from "lucide-react";
import { cn } from "../lib/cn";
import {
  PageHeader,
  formControlClass,
  labelClass,
  tableWrapClass,
  tableClass,
  theadClass,
  thClass,
  trClass,
  tdClass,
} from "../components/ui";
function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function formatCreatedBy(_: ModelOut): string {
  return "—";
}

export function MappingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [mappings, setMappings] = React.useState<MappingOut[]>([]);
  const [showUpload, setShowUpload] = React.useState(false);
  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [tab, setTab] = React.useState<"models" | "list" | "view">("models");

  // Global models (application models)
  const [companyModels, setCompanyModels] = React.useState<ModelOut[]>([]);
  const [modelId, setModelId] = React.useState("");
  const [showCreateModel, setShowCreateModel] = React.useState(false);
  const [newModelName, setNewModelName] = React.useState("");
  const [newModelCountryId, setNewModelCountryId] = React.useState("");
  const [countries, setCountries] = React.useState<CountryOut[]>([]);
  const [creatingModel, setCreatingModel] = React.useState(false);
  const [deletingModelId, setDeletingModelId] = React.useState<string | null>(null);
  const [mappingDownloadId, setMappingDownloadId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"table" | "diagram" | "compare">("table");
  const [viewMappingId, setViewMappingId] = React.useState<string | null>(null);
  const [viewItems, setViewItems] = React.useState<MappingItemOut[]>([]);
  const [viewLoading, setViewLoading] = React.useState(false);
  const [compareLeftId, setCompareLeftId] = React.useState<string | null>(null);
  const [compareRightId, setCompareRightId] = React.useState<string | null>(null);
  const [compareLeftItems, setCompareLeftItems] = React.useState<MappingItemOut[]>([]);
  const [compareRightItems, setCompareRightItems] = React.useState<MappingItemOut[]>([]);
  const [compareLoading, setCompareLoading] = React.useState(false);
  const [mappingViewTableExpanded, setMappingViewTableExpanded] = React.useState<Set<string>>(() => new Set());

  const dz = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"]
    },
    multiple: false,
    onDropAccepted: (files) => setFile(files[0] ?? null),
    onDropRejected: () => toast.error("Please choose a valid Excel file (.xlsx / .xls).")
  });

  async function load() {
    setLoading(true);
    try {
      const data = await listMappings(modelId || undefined);
      setMappings(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error("Failed to load mappings", {
        description: e?.detail ? String(e.detail) : String(e?.message ?? e)
      });
      setMappings([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!user) return;
    listAllCountries()
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        arr.sort((a, b) => a.name.localeCompare(b.name));
        setCountries(arr);
        setNewModelCountryId((prev) => (prev && arr.some((c) => c.id === prev) ? prev : ""));
      })
      .catch(() => setCountries([]));
  }, [user?.id]);

  React.useEffect(() => {
    if (!user) return;
    listAllModels()
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setCompanyModels(arr);
        setModelId((mid) => (mid && arr.some((m) => m.id === mid) ? mid : ""));
      })
      .catch(() => {
        setCompanyModels([]);
        setModelId("");
      });
  }, [user?.id, user?.is_admin]);

  React.useEffect(() => {
    if (modelId) void load();
    else setMappings([]);
  }, [modelId]);

  // Sync viewMappingId: default to active mapping when mappings load, reset if deleted
  React.useEffect(() => {
    if (mappings.length === 0) {
      setViewMappingId(null);
      return;
    }
    const exists = viewMappingId && mappings.some((m) => m.id === viewMappingId);
    if (!exists) {
      const active = mappings.find((m) => m.is_active);
      setViewMappingId(active?.id ?? mappings[0].id);
    }
  }, [mappings, viewMappingId]);

  // Load mapping items when viewing
  React.useEffect(() => {
    if (tab !== "view" || !viewMappingId) return;
    let cancelled = false;
    setViewLoading(true);
    getMappingItems(viewMappingId)
      .then((data) => {
        if (!cancelled) setViewItems(Array.isArray(data) ? data : []);
      })
      .catch((e: any) => {
        if (!cancelled) {
          toast.error("Failed to load mapping items", {
            description: e?.detail ? String(e.detail) : String(e?.message ?? e)
          });
          setViewItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setViewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, viewMappingId]);

  React.useEffect(() => {
    setMappingViewTableExpanded(new Set());
  }, [viewMappingId]);

  const mappingViewRows = React.useMemo(
    () =>
      viewItems.map((it) => ({
        ...it,
        parent_code: it.parent_code?.trim() || null
      })),
    [viewItems]
  );

  const mappingTableView = React.useMemo(
    () => computeHierarchyTableView(mappingViewRows, mappingViewRows, mappingViewTableExpanded, false),
    [mappingViewRows, mappingViewTableExpanded]
  );

  const toggleMappingTableRow = React.useCallback((code: string) => {
    setMappingViewTableExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  // Load compare items when in compare mode
  React.useEffect(() => {
    if (tab !== "view" || viewMode !== "compare") return;
    let cancelled = false;
    setCompareLoading(true);
    const load = async () => {
      try {
        const [left, right] = await Promise.all([
          compareLeftId ? getMappingItems(compareLeftId) : Promise.resolve([]),
          compareRightId ? getMappingItems(compareRightId) : Promise.resolve([])
        ]);
        if (!cancelled) {
          setCompareLeftItems(Array.isArray(left) ? left : []);
          setCompareRightItems(Array.isArray(right) ? right : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          toast.error("Failed to load mappings for compare", {
            description: e?.detail ? String(e.detail) : String(e?.message ?? e)
          });
        }
      } finally {
        if (!cancelled) setCompareLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tab, viewMode, compareLeftId, compareRightId]);

  async function handleDeleteModel(model: ModelOut) {
    if (!confirm(`Delete model "${model.name}" and all of its mappings? This cannot be undone.`)) return;
    setDeletingModelId(model.id);
    try {
      await deleteModel(model.id);
      toast.success("Model deleted", { description: model.name });
      const all = await listAllModels();
      setCompanyModels(Array.isArray(all) ? all : []);
      if (modelId === model.id) {
        setModelId("");
        setTab("list");
      }
    } catch (e: any) {
      toast.error("Failed to delete model", {
        description: e?.detail ? String(e.detail) : String(e?.message ?? e),
      });
    } finally {
      setDeletingModelId(null);
    }
  }

  async function handleDownloadMapping(configId: string) {
    setMappingDownloadId(configId);
    try {
      await downloadMappingWorkbook(configId);
      toast.success("Download started");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
      toast.error("Download failed", { description: msg });
    } finally {
      setMappingDownloadId(null);
    }
  }

  async function handleCreateModel() {
    if (!newModelName.trim()) {
      toast.error("Enter a model name.");
      return;
    }
    if (!newModelCountryId) {
      toast.error("Select a country for this model.");
      return;
    }
    setCreatingModel(true);
    try {
      const created = await createModel(newModelCountryId, newModelName.trim());
      toast.success("Model created", { description: created.name });
      const all = await listAllModels();
      setCompanyModels(Array.isArray(all) ? all : []);
      setModelId(created.id);
      setShowCreateModel(false);
      setNewModelName("");
      setNewModelCountryId("");
    } catch (e: any) {
      toast.error("Failed to create model", {
        description: e?.detail ? String(e.detail) : String(e?.message ?? e)
      });
    } finally {
      setCreatingModel(false);
    }
  }

  async function onSubmit() {
    if (!file) {
      toast.error("Select a mapping Excel file first.");
      return;
    }
    if (!name.trim()) {
      toast.error("Mapping name is required.");
      return;
    }
    if (!modelId) {
      toast.error("Select a model first.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createMapping({
        file,
        name: name.trim(),
        model_id: modelId,
        notes: notes.trim() ? notes.trim() : undefined
      });
      toast.success("Mapping created", {
        description: `${created.name} v${created.version} — set as active mapping for this model.`
      });
      setShowUpload(false);
      setFile(null);
      setName("");
      setNotes("");
      await load();
      if (created?.id) {
        setViewMappingId(created.id);
        setTab("view");
      }
    } catch (e: any) {
      toast.error("Upload failed", {
        description: e?.detail ? String(e.detail) : String(e?.message ?? e)
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate(mappingId: string) {
    try {
      await activateMapping(mappingId);
      toast.success("Mapping activated");
      await load();
      setViewMappingId(mappingId);
      setTab("view");
    } catch (e: any) {
      toast.error("Failed to activate", {
        description: e?.detail ? String(e.detail) : String(e?.message ?? e)
      });
    }
  }

  async function handleDelete(mappingId: string) {
    if (!confirm("Delete this mapping? This cannot be undone.")) return;
    try {
      await deleteMapping(mappingId);
      toast.success("Mapping deleted");
      void load();
    } catch (e: any) {
      toast.error("Failed to delete", {
        description: e?.detail ? String(e.detail) : String(e?.message ?? e)
      });
    }
  }

  /** Prefer newest upload if multiple rows still show active (legacy data). */
  const activeMapping = React.useMemo(() => {
    if (!Array.isArray(mappings)) return undefined;
    const actives = mappings.filter((m) => m.is_active);
    if (actives.length === 0) return undefined;
    return [...actives].sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    )[0];
  }, [mappings]);
  const viewMapping = mappings.find((m) => m.id === viewMappingId);

  function openView(mappingId?: string) {
    if (mappingId) setViewMappingId(mappingId);
    setTab("view");
  }

  const selectedModel = companyModels.find((m) => m.id === modelId);
  const selectedModelLabel = selectedModel?.name ?? "";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mappings"
        subtitle="Create a model (name + country), then upload its mapping workbook (Code → Sheet, Cell)."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={tab}
              onChange={(v) => setTab(v as "models" | "list" | "view")}
              items={[
                { value: "models", label: "Models" },
                { value: "list", label: "Mappings" },
                { value: "view", label: "View" }
              ]}
            />
            {tab === "list" && modelId && (
              <Button onClick={() => setShowUpload(!showUpload)}>
                <UploadCloud className="h-4 w-4" /> {showUpload ? "Cancel" : "Upload Mapping"}
              </Button>
            )}
          </div>
        }
      />

      {tab === "models" && (
        <Card
          title="Models"
          subtitle="Each model is tied to a country. Models are shared across companies."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              {showCreateModel ? (
                <>
                  <div>
                    <label className={labelClass}>Model name</label>
                    <Input
                      placeholder="e.g. OSRA, SCR, Annual Report"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Country</label>
                    <select
                      value={newModelCountryId}
                      onChange={(e) => setNewModelCountryId(e.target.value)}
                      className={`min-w-[12rem] ${formControlClass}`}
                    >
                      <option value="">Select country</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={() => void handleCreateModel()}
                    disabled={creatingModel || !newModelName.trim()}
                  >
                    {creatingModel ? "Creating…" : "Create Model"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowCreateModel(false);
                      setNewModelName("");
                      setNewModelCountryId("");
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setShowCreateModel(true)}>
                  <Plus className="h-4 w-4" /> Create model
                </Button>
              )}
            </div>
            <div className={tableWrapClass}>
              <div className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Available mapping models
              </div>
              <div className="max-h-[min(28rem,60vh)] overflow-auto [scrollbar-gutter:stable] [scrollbar-width:thin]">
                {companyModels.length === 0 ? (
                  <div className="py-8 text-center text-sm text-ink-muted">No models yet. Create one above.</div>
                ) : (
                  <table className={tableClass}>
                    <thead className={theadClass}>
                      <tr>
                        <th className={thClass}>Model name</th>
                        <th className={thClass}>Country</th>
                        <th className={thClass}>Created</th>
                        <th className={thClass}>Created by</th>
                        <th className={`${thClass} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyModels.map((m) => (
                        <tr
                          key={m.id}
                          className={cn(
                            trClass,
                            modelId === m.id && "bg-brand-700/[0.08] dark:bg-brand-500/10"
                          )}
                        >
                          <td className={`${tdClass} font-semibold`}>{m.name}</td>
                          <td className={`${tdClass} text-xs text-ink-muted`}>
                            {m.country_name ?? "—"}
                          </td>
                          <td className={`${tdClass} text-xs text-ink-muted`}>
                            {m.created_at ? formatDate(m.created_at) : "—"}
                          </td>
                          <td className={`max-w-[14rem] truncate ${tdClass} text-xs text-ink-muted`} title={formatCreatedBy(m)}>
                            {formatCreatedBy(m)}
                          </td>
                          <td className={`${tdClass} text-right`}>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant={modelId === m.id ? "primary" : "ghost"}
                                onClick={() => {
                                  setModelId(m.id);
                                  setTab("list");
                                }}
                              >
                                {modelId === m.id ? "Selected" : "Select"}
                              </Button>
                              {user?.is_admin ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-rose-600 hover:text-rose-500 dark:text-rose-400"
                                  disabled={deletingModelId !== null}
                                  onClick={() => void handleDeleteModel(m)}
                                  title="Delete model and all its mappings"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === "list" && (
        <Card
          title="Select model"
          subtitle={modelId ? `Mappings for ${selectedModelLabel}` : "Select a model in the Models tab first."}
        >
          {modelId ? (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className={cn(formControlClass, "w-auto min-w-[14rem]")}
              >
                {companyModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.country_name ? ` · ${m.country_name}` : ""}
                  </option>
                ))}
              </select>
              <span className="text-xs text-ink-muted">Upload an .xlsx mapping workbook for this model below.</span>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              Go to the <button type="button" onClick={() => setTab("models")} className="font-semibold text-brand-700 underline hover:text-brand-600 dark:text-brand-300">Models</button> tab to create or select a model.
            </p>
          )}
        </Card>
      )}

      {tab === "view" && (
        <Card
          title="View Mapping"
          subtitle={
            viewMapping
              ? `${viewMapping.name} v${viewMapping.version}${viewMapping.is_active ? " (Active)" : ""}`
              : "Select a mapping to view its items."
          }
          actions={
            <div className="flex items-center gap-3">
              <Segmented
                value={viewMode}
                onChange={(v) => {
                  const mode = v as "table" | "diagram" | "compare";
                  setViewMode(mode);
                  if (mode === "compare" && mappings.length >= 2 && !compareLeftId && !compareRightId) {
                    setCompareLeftId(mappings[0].id);
                    setCompareRightId(mappings[1].id);
                  }
                }}
                items={[
                  { value: "table", label: "Table" },
                  { value: "diagram", label: "Diagram" },
                  { value: "compare", label: "Compare" }
                ]}
              />
              {mappings.length > 0 ? (
                <div className="flex items-center gap-2">
                  <select
                    value={viewMappingId ?? ""}
                    onChange={(e) => setViewMappingId(e.target.value || null)}
                    className={cn(formControlClass, "w-auto min-w-[16rem]")}
                  >
                    {mappings.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} v{m.version}{m.is_active ? " (Active)" : ""}
                      </option>
                    ))}
                  </select>
                  {activeMapping && viewMappingId !== activeMapping.id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMappingId(activeMapping.id)}
                    >
                      Show active
                    </Button>
                  ) : null}
                  {viewMappingId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={mappingDownloadId !== null}
                      onClick={() => void handleDownloadMapping(viewMappingId)}
                      title="Download this mapping as .xlsx"
                    >
                      <Download className="h-4 w-4" />
                      Download .xlsx
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          }
        >
          {viewLoading ? (
            <div className="py-10 text-center text-sm text-ink-muted">Loading mapping items…</div>
          ) : viewItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-muted">
              {viewMappingId ? "No items in this mapping." : "Select a mapping to view."}
            </div>
          ) : viewMode === "compare" ? (
            <div className="space-y-4">
              <div className="text-xs text-ink-muted">
                Select two mappings to compare side by side. Click nodes to expand/collapse.
              </div>
              {compareLoading ? (
                <div className="py-10 text-center text-sm text-ink-muted">Loading…</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-line bg-surface-3/40 p-4">
                    <div className="text-sm font-semibold text-ink">Left</div>
                    <select
                      value={compareLeftId ?? ""}
                      onChange={(e) => setCompareLeftId(e.target.value || null)}
                      className={formControlClass}
                    >
                      <option value="">Select mapping</option>
                      {mappings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} v{m.version}
                        </option>
                      ))}
                    </select>
                    {compareLeftItems.length > 0 ? (
                      <MappingTreeDiagram
                        roots={buildMappingTree(compareLeftItems)}
                        onSelect={(item) =>
                          toast.info(`${item.code}`, {
                            description: item.description ?? `${item.sheet_name} → ${item.cell_ref}`
                          })
                        }
                      />
                    ) : (
                      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-line text-sm text-ink-muted">
                        {compareLeftId ? "No items" : "Select a mapping"}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 rounded-xl border border-line bg-surface-3/40 p-4">
                    <div className="text-sm font-semibold text-ink">Right</div>
                    <select
                      value={compareRightId ?? ""}
                      onChange={(e) => setCompareRightId(e.target.value || null)}
                      className={formControlClass}
                    >
                      <option value="">Select mapping</option>
                      {mappings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} v{m.version}
                        </option>
                      ))}
                    </select>
                    {compareRightItems.length > 0 ? (
                      <MappingTreeDiagram
                        roots={buildMappingTree(compareRightItems)}
                        onSelect={(item) =>
                          toast.info(`${item.code}`, {
                            description: item.description ?? `${item.sheet_name} → ${item.cell_ref}`
                          })
                        }
                      />
                    ) : (
                      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-line text-sm text-ink-muted">
                        {compareRightId ? "No items" : "Select a mapping"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === "diagram" ? (
            <div className="rounded-xl border border-line bg-surface-3/40 p-4">
              <div className="mb-3 text-xs text-ink-muted">
                Click nodes to expand/collapse. Subnodes are also clickable.
              </div>
              <MappingTreeDiagram
                roots={buildMappingTree(viewItems)}
                onSelect={(item) =>
                  toast.info(`${item.code}`, {
                    description: item.description ?? `${item.sheet_name} → ${item.cell_ref}`
                  })
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              <HierarchyExpandControls
                canExpand={mappingTableView.codesWithChildren.size > 0}
                onExpandAll={() => setMappingViewTableExpanded(new Set(mappingTableView.codesWithChildren))}
                onCollapseAll={() => setMappingViewTableExpanded(new Set())}
              />
              <div className={tableWrapClass}>
                <table className={`${tableClass} min-w-[40rem]`}>
                  <thead className={theadClass}>
                    <tr>
                      <th className={thClass}>Code</th>
                      <th className={thClass}>Description</th>
                      <th className={thClass}>Sheet</th>
                      <th className={thClass}>Cell Reference</th>
                      <th className={thClass}>Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingTableView.flat.map(({ row: item, depth }) => {
                      const hasKids = mappingTableView.codesWithChildren.has(item.code);
                      const isOpen = mappingTableView.expandedForWalk.has(item.code);
                      return (
                        <tr key={item.id} className={trClass}>
                          <td className={`${tdClass} font-mono text-brand-800 dark:text-brand-200`}>
                            <HierarchyCodeCell
                              code={item.code}
                              depth={depth}
                              hasChildren={hasKids}
                              isExpanded={isOpen}
                              onToggle={() => toggleMappingTableRow(item.code)}
                              textClassName="font-mono text-brand-800 dark:text-brand-200"
                            />
                          </td>
                          <td className={`${tdClass} text-ink-muted`}>{item.description ?? "—"}</td>
                          <td className={`${tdClass} text-ink-muted`}>{item.sheet_name}</td>
                          <td className={`${tdClass} font-mono text-ink-muted`}>{item.cell_ref}</td>
                          <td className={`${tdClass} text-ink-soft`}>{item.level}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === "list" && showUpload && (
        <Card
          title="Upload mapping (.xlsx)"
          subtitle="Use an Excel workbook (.xlsx or .xls) with columns: Code, Description, Sheet, Cell Reference. Versions are numbered per model (v1, v2, …). New uploads become the active mapping; use Activate in the list for an older config."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <div className="mb-2 text-xs font-semibold text-ink">Mapping name</div>
                <Input
                  placeholder="SCR Mapping v1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="mt-2 text-xs text-ink-muted">
                  Descriptive label for this file; the version number is assigned automatically per model.
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-ink">Notes (optional)</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-line bg-surface-2 p-4 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  placeholder="What does this mapping cover?"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="mb-2 text-xs font-semibold text-ink">Mapping workbook (.xlsx / .xls)</div>
              <div
                {...dz.getRootProps()}
                className={cn(
                  "group grid min-h-[200px] cursor-pointer place-items-center rounded-2xl bg-gradient-to-br from-surface-3 to-transparent p-6 text-center border border-line transition hover:bg-surface-3",
                  dz.isDragActive && "ring-brand-400/40"
                )}
              >
                <input {...dz.getInputProps()} />
                <div>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/25">
                    {file ? (
                      <FileSpreadsheet className="h-6 w-6 text-brand-700 dark:text-brand-200" />
                    ) : (
                      <UploadCloud className="h-6 w-6 text-brand-700 dark:text-brand-200" />
                    )}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-ink">
                    {file ? file.name : "Drop mapping Excel here"}
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">
                    {file ? "Click to replace" : "or click to browse — .xlsx mapping workbook"}
                  </div>
                </div>
              </div>

              <Button onClick={onSubmit} disabled={submitting}>
                {submitting ? "Uploading…" : "Create Mapping"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tab === "list" && modelId && (
      <Card
        title="Mappings"
        subtitle={
          loading
            ? "Loading…"
            : activeMapping
              ? `Active: ${activeMapping.name} v${activeMapping.version}`
              : "Upload and activate a mapping to use it for file uploads."
        }
      >
        {loading ? (
          <div className="py-10 text-center text-sm text-ink-muted">Loading mappings…</div>
        ) : mappings.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-muted">
            No mappings yet. Upload an .xlsx mapping workbook to get started.
          </div>
        ) : (
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Version</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Items</th>
                  <th className={thClass}>Uploaded</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} className={trClass}>
                    <td className={tdClass}>
                      <div className="font-semibold">{m.name}</div>
                      {m.notes ? (
                        <div className="mt-1 text-xs text-ink-muted line-clamp-1">{m.notes}</div>
                      ) : null}
                    </td>
                    <td className={tdClass}>
                      <Badge>v{m.version}</Badge>
                    </td>
                    <td className={tdClass}>
                      {m.is_active ? (
                        <Badge className="bg-brand-500/15 text-brand-800 ring-brand-500/25 dark:text-brand-200 dark:ring-brand-400/25">
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-surface-3 text-ink-muted">
                          <XCircle className="mr-1 inline h-3.5 w-3.5" />
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className={`${tdClass} text-ink-muted`}>{m.item_count ?? 0} items</td>
                    <td className={`${tdClass} text-ink-muted`}>{formatDate(m.uploaded_at)}</td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openView(m.id)}>
                          <Eye className="h-4 w-4" /> View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={mappingDownloadId !== null}
                          onClick={() => void handleDownloadMapping(m.id)}
                          title="Download .xlsx"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {!m.is_active && (
                          <Button variant="ghost" size="sm" onClick={() => handleActivate(m.id)}>
                            <MapPin className="h-4 w-4" /> Activate
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(m.id)}
                          className="text-rose-600 hover:text-rose-500 dark:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      )}
    </div>
  );
}
