import * as React from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  activateMapping,
  createMapping,
  deleteMapping,
  getMappingItems,
  listMappings
} from "../api/mappings";
import { listCompanyModels, createCompanyModel, type CompanyModelOut } from "../api/companyModels";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import type { MappingItemOut, MappingOut } from "../types";
import { MappingTreeDiagram, buildMappingTree } from "../components/MappingTreeDiagram";
import { Segmented } from "../components/Segmented";
import { CheckCircle2, Eye, FileSpreadsheet, MapPin, Plus, Trash2, UploadCloud, XCircle } from "lucide-react";
import { cn } from "../lib/cn";
function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function MappingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [mappings, setMappings] = React.useState<MappingOut[]>([]);
  const [showUpload, setShowUpload] = React.useState(false);
  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [tab, setTab] = React.useState<"models" | "list" | "view">("models");

  // Company models (user's company - no region/country)
  const [companyModels, setCompanyModels] = React.useState<CompanyModelOut[]>([]);
  const [modelId, setModelId] = React.useState("");
  const [showCreateModel, setShowCreateModel] = React.useState(false);
  const [newModelName, setNewModelName] = React.useState("");
  const [creatingModel, setCreatingModel] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"table" | "diagram" | "compare">("table");
  const [viewMappingId, setViewMappingId] = React.useState<string | null>(null);
  const [viewItems, setViewItems] = React.useState<MappingItemOut[]>([]);
  const [viewLoading, setViewLoading] = React.useState(false);
  const [compareLeftId, setCompareLeftId] = React.useState<string | null>(null);
  const [compareRightId, setCompareRightId] = React.useState<string | null>(null);
  const [compareLeftItems, setCompareLeftItems] = React.useState<MappingItemOut[]>([]);
  const [compareRightItems, setCompareRightItems] = React.useState<MappingItemOut[]>([]);
  const [compareLoading, setCompareLoading] = React.useState(false);

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
    listCompanyModels().then(setCompanyModels).catch(() => setCompanyModels([]));
  }, []);

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

  async function handleCreateModel() {
    if (!newModelName.trim()) {
      toast.error("Enter a model name.");
      return;
    }
    setCreatingModel(true);
    try {
      const created = await createCompanyModel(newModelName.trim());
      toast.success("Model created", { description: created.name });
      setCompanyModels((prev) => [...prev, created]);
      setModelId(created.id);
      setShowCreateModel(false);
      setNewModelName("");
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
      toast.success("Mapping created", { description: name.trim() });
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

  const activeMapping = Array.isArray(mappings) ? mappings.find((m) => m.is_active) : undefined;
  const viewMapping = mappings.find((m) => m.id === viewMappingId);

  function openView(mappingId?: string) {
    if (mappingId) setViewMappingId(mappingId);
    setTab("view");
  }

  const selectedModel = companyModels.find((m) => m.id === modelId);
  const selectedModelLabel = selectedModel?.name ?? "";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Model-based Mapping</div>
          <div className="mt-1 text-xs text-slate-400">
            Create a model, then upload its mapping Excel (Code → Sheet, Cell Reference).
          </div>
        </div>
        <div className="flex items-center gap-3">
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
      </div>

      {tab === "models" && (
        <Card
          title="Models"
          subtitle="Create a model for your company, then upload its mapping in the Mappings tab."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              {showCreateModel ? (
                <>
                  <div>
                    <div className="mb-1 text-xs text-slate-400">Model name</div>
                    <Input
                      placeholder="e.g. OSRA, SCR, Annual Report"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <Button onClick={handleCreateModel} disabled={creatingModel || !newModelName.trim()}>
                    {creatingModel ? "Creating…" : "Create Model"}
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowCreateModel(false); setNewModelName(""); }}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setShowCreateModel(true)}>
                  <Plus className="h-4 w-4" /> Create model
                </Button>
              )}
            </div>
            <div className="rounded-lg border border-white/10">
              <div className="border-b border-white/10 px-4 py-2 text-xs font-medium text-slate-400">Your company models</div>
              <div className="max-h-48 overflow-y-auto p-2">
                {companyModels.length === 0 ? (
                  <div className="py-4 text-center text-sm text-slate-500">No models yet. Create one above.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {companyModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setModelId(m.id); setTab("list"); }}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-sm ring-1 transition",
                          modelId === m.id
                            ? "bg-sky-500/15 text-sky-200 ring-sky-400/30"
                            : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
                        )}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
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
                className="h-10 rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10"
              >
                {companyModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <span className="text-xs text-slate-500">Upload mapping Excel for this model below.</span>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Go to the <button type="button" onClick={() => setTab("models")} className="text-sky-400 hover:text-sky-300 underline">Models</button> tab to create or select a model.
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
                    className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
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
                </div>
              ) : null}
            </div>
          }
        >
          {viewLoading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading mapping items…</div>
          ) : viewItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              {viewMappingId ? "No items in this mapping." : "Select a mapping to view."}
            </div>
          ) : viewMode === "compare" ? (
            <div className="space-y-4">
              <div className="text-xs text-slate-500">
                Select two mappings to compare side by side. Click nodes to expand/collapse.
              </div>
              {compareLoading ? (
                <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2 rounded-xl bg-slate-900/30 p-4 ring-1 ring-white/5">
                    <div className="text-sm font-medium text-slate-300">Left</div>
                    <select
                      value={compareLeftId ?? ""}
                      onChange={(e) => setCompareLeftId(e.target.value || null)}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
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
                      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-slate-500">
                        {compareLeftId ? "No items" : "Select a mapping"}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 rounded-xl bg-slate-900/30 p-4 ring-1 ring-white/5">
                    <div className="text-sm font-medium text-slate-300">Right</div>
                    <select
                      value={compareRightId ?? ""}
                      onChange={(e) => setCompareRightId(e.target.value || null)}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
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
                      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-slate-500">
                        {compareRightId ? "No items" : "Select a mapping"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === "diagram" ? (
            <div className="rounded-xl bg-slate-900/30 p-4 ring-1 ring-white/5">
              <div className="mb-3 text-xs text-slate-500">
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr className="[&>th]:pb-3 [&>th]:font-medium">
                    <th>Code</th>
                    <th>Description</th>
                    <th>Sheet</th>
                    <th>Cell Reference</th>
                    <th>Level</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {viewItems.map((item) => (
                    <tr key={item.id} className="border-t border-white/10 [&>td]:py-3">
                      <td className="pr-4 font-mono text-sky-200">{item.code}</td>
                      <td className="pr-4 text-slate-300">{item.description ?? "—"}</td>
                      <td className="pr-4 text-slate-300">{item.sheet_name}</td>
                      <td className="pr-4 font-mono text-slate-300">{item.cell_ref}</td>
                      <td className="pr-4 text-slate-400">{item.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "list" && showUpload && (
        <Card
          title="Upload Mapping Excel"
          subtitle="Upload a file with columns: Code, Description, Sheet, Cell Reference"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <div className="mb-2 text-xs font-medium text-slate-300">Mapping name</div>
                <Input
                  placeholder="SCR Mapping v1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="mt-2 text-xs text-slate-400">
                  A descriptive name for this mapping configuration.
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-slate-300">Notes (optional)</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl bg-white/5 p-4 text-sm text-slate-100 ring-1 ring-white/10 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  placeholder="What does this mapping cover?"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="mb-2 text-xs font-medium text-slate-300">Mapping Excel file</div>
              <div
                {...dz.getRootProps()}
                className={cn(
                  "group grid min-h-[200px] cursor-pointer place-items-center rounded-2xl bg-gradient-to-br from-white/5 to-transparent p-6 text-center ring-1 ring-white/10 transition hover:bg-white/[0.06]",
                  dz.isDragActive && "ring-sky-400/40"
                )}
              >
                <input {...dz.getInputProps()} />
                <div>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sky-500/15 ring-1 ring-sky-400/25">
                    {file ? (
                      <FileSpreadsheet className="h-6 w-6 text-sky-200" />
                    ) : (
                      <UploadCloud className="h-6 w-6 text-sky-200" />
                    )}
                  </div>
                  <div className="mt-3 text-sm font-medium text-slate-100">
                    {file ? file.name : "Drop mapping Excel here"}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {file ? "Click to replace" : "or click to browse (.xlsx / .xls)"}
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
          <div className="py-10 text-center text-sm text-slate-400">Loading mappings…</div>
        ) : mappings.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No mappings yet. Upload a mapping Excel file to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr className="[&>th]:pb-3 [&>th]:font-medium">
                  <th>Name</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Uploaded</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {mappings.map((m) => (
                  <tr key={m.id} className="border-t border-white/10 [&>td]:py-3">
                    <td className="pr-4">
                      <div className="font-medium">{m.name}</div>
                      {m.notes ? (
                        <div className="mt-1 text-xs text-slate-400 line-clamp-1">{m.notes}</div>
                      ) : null}
                    </td>
                    <td className="pr-4">
                      <Badge>v{m.version}</Badge>
                    </td>
                    <td className="pr-4">
                      {m.is_active ? (
                        <Badge className="bg-green-500/15 text-green-200 ring-green-400/25">
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-500/15 text-slate-300 ring-slate-400/25">
                          <XCircle className="mr-1 inline h-3.5 w-3.5" />
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="pr-4 text-slate-300">{m.item_count ?? 0} items</td>
                    <td className="pr-4 text-slate-300">{formatDate(m.uploaded_at)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openView(m.id)}>
                          <Eye className="h-4 w-4" /> View
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
                          className="text-rose-400 hover:text-rose-300"
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
    </>
  );
}
