import * as React from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { createUpload, previewUpload, type UploadPreviewItem } from "../api/uploads";
import { listMappings } from "../api/mappings";
import type { MappingOut, UploadOut } from "../types";
import { listAllModels, listCompanies, companyLabel, type CompanyOut, type ModelOut } from "../api/regions";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { HierarchyCodeCell } from "../components/HierarchyCodeCell";
import { HierarchyExpandControls } from "../components/HierarchyExpandControls";
import { Input } from "../components/Input";
import { Columns2, FileSpreadsheet, UploadCloud, MapPin } from "lucide-react";
import { cn } from "../lib/cn";
import { formatValueToSigFigs } from "../lib/format";
import { computeHierarchyTableView, withInferredDottedParents } from "../lib/hierarchyTable";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../workspace/tabs";
import { Badge } from "../components/Badge";

const MONTHS = [
  { v: 1, label: "January" }, { v: 2, label: "February" }, { v: 3, label: "March" },
  { v: 4, label: "April" }, { v: 5, label: "May" }, { v: 6, label: "June" },
  { v: 7, label: "July" }, { v: 8, label: "August" }, { v: 9, label: "September" },
  { v: 10, label: "October" }, { v: 11, label: "November" }, { v: 12, label: "December" }
];

type PreviewByModel = Record<
  string,
  { items: UploadPreviewItem[]; file_sheets?: string[] | null; error?: string }
>;

export function UploadPage() {
  const nav = useNavigate();
  const { openOrActivate } = useWorkspace();
  const { user } = useAuth();
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  /** Selected application models (e.g. SCR + FS6). */
  const [selectedModelIds, setSelectedModelIds] = React.useState<string[]>([]);
  /** Per model: "manual" or mapping config_id. Defaults to that model's active mapping. */
  const [extractionByModel, setExtractionByModel] = React.useState<Record<string, string>>({});
  const [mappingsByModel, setMappingsByModel] = React.useState<Record<string, MappingOut[]>>({});

  const [allModels, setAllModels] = React.useState<ModelOut[]>([]);
  const [reportYear, setReportYear] = React.useState<number | "">(new Date().getFullYear());
  const [reportMonth, setReportMonth] = React.useState<number | "">(new Date().getMonth() + 1);
  /** Only used when exactly one model is selected (optional override). */
  const [customReportKey, setCustomReportKey] = React.useState("");

  const [previewByModel, setPreviewByModel] = React.useState<PreviewByModel>({});
  const [previewModelTab, setPreviewModelTab] = React.useState("");
  const [previewTableExpanded, setPreviewTableExpanded] = React.useState<Set<string>>(() => new Set());
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [allCompanies, setAllCompanies] = React.useState<CompanyOut[]>([]);
  const [uploadCompanyId, setUploadCompanyId] = React.useState("");
  const [resolvingModels, setResolvingModels] = React.useState(false);

  const multiModel = selectedModelIds.length > 1;
  const singleModelId = selectedModelIds.length === 1 ? selectedModelIds[0] : "";

  const effectiveCompanyId =
    (user?.is_admin ? uploadCompanyId : user?.company_id) || "";

  const selectedCompany = React.useMemo(
    () => allCompanies.find((c) => c.id === effectiveCompanyId) ?? null,
    [allCompanies, effectiveCompanyId]
  );

  /** Models belonging to the selected company's country. */
  const modelsForCompany = React.useMemo(() => {
    const cid = selectedCompany?.country_id;
    if (!cid) return [] as ModelOut[];
    return allModels.filter((m) => String(m.country_id) === String(cid));
  }, [allModels, selectedCompany?.country_id]);

  const modelsForCompanyKey = modelsForCompany.map((m) => m.id).join("|");

  React.useEffect(() => {
    listCompanies()
      .then((c) => setAllCompanies(Array.isArray(c) ? c : []))
      .catch(() => setAllCompanies([]));
  }, []);

  React.useEffect(() => {
    if (!user?.is_admin) {
      setUploadCompanyId("");
      return;
    }
    const arr = allCompanies;
    setUploadCompanyId((prev) => (prev && arr.some((x) => x.id === prev) ? prev : arr[0]?.id ?? ""));
  }, [user?.is_admin, allCompanies]);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listAllModels()
      .then((data) => {
        if (!cancelled) setAllModels(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setAllModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Auto-select every model for this company's country that has a saved mapping.
  React.useEffect(() => {
    let cancelled = false;
    if (!effectiveCompanyId || !selectedCompany?.country_id) {
      setSelectedModelIds([]);
      setMappingsByModel({});
      setExtractionByModel({});
      setResolvingModels(false);
      return;
    }
    const models = modelsForCompany;
    if (!models.length) {
      setSelectedModelIds([]);
      setMappingsByModel({});
      setExtractionByModel({});
      setResolvingModels(false);
      return;
    }

    setResolvingModels(true);
    void (async () => {
      const nextMaps: Record<string, MappingOut[]> = {};
      const nextExtract: Record<string, string> = {};
      const autoIds: string[] = [];
      await Promise.all(
        models.map(async (m) => {
          try {
            const rows = await listMappings(m.id);
            const arr = Array.isArray(rows) ? rows : [];
            nextMaps[m.id] = arr;
            const active = arr.find((x) => x.is_active);
            const pick = active?.id ?? arr[0]?.id;
            if (pick) {
              nextExtract[m.id] = pick;
              autoIds.push(m.id);
            } else {
              nextExtract[m.id] = "manual";
            }
          } catch {
            nextMaps[m.id] = [];
            nextExtract[m.id] = "manual";
          }
        })
      );
      if (cancelled) return;
      setMappingsByModel(nextMaps);
      setExtractionByModel(nextExtract);
      setSelectedModelIds(autoIds);
      setResolvingModels(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveCompanyId, selectedCompany?.country_id, modelsForCompanyKey]);

  const derivedKeysByModel = React.useMemo(() => {
    const out: Record<string, string> = {};
    if (!reportYear || !reportMonth) return out;
    for (const mid of selectedModelIds) {
      const m = allModels.find((x) => x.id === mid);
      if (!m) continue;
      out[mid] = `${m.name}-${reportYear}-${String(reportMonth).padStart(2, "0")}`;
    }
    return out;
  }, [selectedModelIds, reportYear, reportMonth, allModels]);

  React.useEffect(() => {
    if (singleModelId && derivedKeysByModel[singleModelId]) {
      setCustomReportKey(derivedKeysByModel[singleModelId]);
    }
  }, [singleModelId, derivedKeysByModel]);

  const dz = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx", ".xlsm"],
      "application/vnd.ms-excel": [".xls"]
    },
    multiple: false,
    onDropAccepted: (files) => {
      const f = files[0] ?? null;
      setFile(f);
      setPreviewByModel({});
    },
    onDropRejected: () =>
      toast.error("Please choose a valid Excel workbook (.xlsx, .xlsm, or .xls).")
  });

  // Preview extraction for every selected model that uses cell mapping.
  React.useEffect(() => {
    if (!file || !selectedModelIds.length) {
      setPreviewByModel({});
      setPreviewLoading(false);
      return;
    }

    const targets = selectedModelIds.filter((mid) => {
      const mode = extractionByModel[mid];
      return mode && mode !== "manual";
    });

    if (!targets.length) {
      setPreviewByModel({});
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    void (async () => {
      const next: PreviewByModel = {};
      await Promise.all(
        targets.map(async (mid) => {
          const mappingId = extractionByModel[mid];
          try {
            const r = await previewUpload(file, mid, mappingId);
            next[mid] = { items: r.items, file_sheets: r.file_sheets ?? null };
          } catch (e: any) {
            const msg = e?.message ?? (e?.detail != null ? String(e.detail) : "Preview failed");
            next[mid] = { items: [], error: msg };
          }
        })
      );
      if (cancelled) return;
      setPreviewByModel(next);
      setPreviewModelTab((tab) => (tab && next[tab] ? tab : targets[0] ?? ""));
      setPreviewLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [file, selectedModelIds.join("|"), JSON.stringify(extractionByModel)]);

  React.useEffect(() => {
    setPreviewTableExpanded(new Set());
  }, [previewModelTab, previewByModel]);

  const activePreview = previewModelTab ? previewByModel[previewModelTab] : undefined;
  const previewItems = activePreview?.items ?? null;

  const previewHierarchyRows = React.useMemo(() => {
    if (!previewItems?.length) return [];
    return withInferredDottedParents(previewItems);
  }, [previewItems]);

  const previewTableView = React.useMemo(
    () => computeHierarchyTableView(previewHierarchyRows, previewHierarchyRows, previewTableExpanded, false),
    [previewHierarchyRows, previewTableExpanded]
  );

  const togglePreviewTableRow = React.useCallback((code: string) => {
    setPreviewTableExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const anyCellMapping = selectedModelIds.some((mid) => {
    const mode = extractionByModel[mid];
    return Boolean(mode && mode !== "manual");
  });

  async function onSubmit() {
    if (!file) {
      toast.error("Select an Excel workbook (.xlsx) first.");
      return;
    }
    if (!selectedModelIds.length) {
      toast.error("No models selected. Map this company to a country and add model mappings.");
      return;
    }
    if (reportYear === "" || reportMonth === "") {
      toast.error("Report date (year and month) is required for dashboard filtering.");
      return;
    }
    const resolvedCompanyId = user?.company_id || (user?.is_admin ? uploadCompanyId : "") || "";
    if (!resolvedCompanyId) {
      toast.error(user?.is_admin ? "Select which company this upload belongs to." : "Your account has no company.");
      return;
    }

    // Multi-model requires cell mapping per model (each uses its own sheet/cell definitions).
    if (multiModel) {
      const missing = selectedModelIds.filter((mid) => {
        const mode = extractionByModel[mid];
        return !mode || mode === "manual";
      });
      if (missing.length) {
        const names = missing
          .map((id) => allModels.find((m) => m.id === id)?.name ?? id)
          .join(", ");
        toast.error("Each selected model needs a saved mapping", {
          description: `Add/activate a mapping for: ${names}`
        });
        return;
      }
    }

    setSubmitting(true);
    const created: UploadOut[] = [];
    const errors: string[] = [];
    try {
      for (const mid of selectedModelIds) {
        const model = allModels.find((m) => m.id === mid);
        const mode = extractionByModel[mid] ?? "manual";
        const useCell = mode !== "manual";
        const reportKey =
          !multiModel && customReportKey.trim()
            ? customReportKey.trim()
            : derivedKeysByModel[mid] || `${model?.name ?? "report"}-${reportYear}-${String(reportMonth).padStart(2, "0")}`;

        try {
          const row = await createUpload({
            file,
            report_key: reportKey,
            notes: notes.trim() ? notes.trim() : undefined,
            use_mapping: useCell,
            mapping_config_id: useCell ? mode : undefined,
            model_id: mid,
            company_id: resolvedCompanyId,
            report_year: typeof reportYear === "number" ? reportYear : undefined,
            report_month: typeof reportMonth === "number" ? reportMonth : undefined,
          });
          created.push(row);
        } catch (e: any) {
          const detail = e?.detail;
          const msg =
            e?.message ??
            (detail != null
              ? Array.isArray(detail)
                ? detail.map((x: { msg?: string }) => x?.msg ?? JSON.stringify(x)).join("; ")
                : String(detail)
              : "Unknown error");
          errors.push(`${model?.name ?? mid}: ${msg}`);
        }
      }

      if (created.length) {
        toast.success(
          created.length === 1 ? "Upload created" : `${created.length} uploads created`,
          {
            description: created
              .map((c) => `${c.report_key} v${c.version_no}`)
              .join(" · ")
          }
        );
        const last = created[created.length - 1];
        openOrActivate({
          path: `/uploads/${last.id}`,
          title: `Report • ${last.report_key} v${last.version_no}`
        });
        nav(`/uploads/${last.id}`);
      }
      if (errors.length) {
        toast.error("Some models failed", { description: errors.join(" | ") });
        console.error("Upload errors:", errors);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const subtitle = !effectiveCompanyId
    ? "Select a company. All models mapped to that company's country extract automatically from one Excel file."
    : !selectedModelIds.length
      ? "No models with mappings for this company's country yet. Add them under Mappings."
      : `Will auto-extract ${selectedModelIds.length} model${selectedModelIds.length === 1 ? "" : "s"} for ${selectedCompany?.country_name ?? "this country"} from one workbook.`;

  return (
    <>
      <Card
        title="Upload report workbook"
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {anyCellMapping && (
              <Badge className="bg-green-500/15 text-green-200 ring-green-400/25">
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                Cell mapping
              </Badge>
            )}
            {multiModel && (
              <Badge className="bg-sky-500/15 text-sky-200 ring-sky-400/25">
                {selectedModelIds.length} models
              </Badge>
            )}
            <Button type="button" variant="ghost" onClick={() => nav("/models")}>
              <Columns2 className="h-4 w-4" />
              Compare reports
            </Button>
            <Link to="/">
              <Button variant="ghost">Back</Button>
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            {user?.is_admin ? (
              <div>
                <div className="mb-2 text-xs font-medium text-ink">Company</div>
                <select
                  value={uploadCompanyId}
                  onChange={(e) => setUploadCompanyId(e.target.value)}
                  className="h-11 w-full rounded-xl bg-surface-2 px-4 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                >
                  <option value="">Select company</option>
                  {allCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{companyLabel(c)}</option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-ink-muted">
                  Models/mappings for this company&apos;s country are auto-selected below.
                </div>
              </div>
            ) : user?.company_name ? (
              <div className="space-y-1 rounded-xl bg-surface-2 px-4 py-2 text-sm text-ink">
                <div>
                  <span className="text-ink-muted">Company:</span>{" "}
                  {(() => {
                    const co = allCompanies.find((c) => c.id === user.company_id);
                    return co ? companyLabel(co) : user.company_name;
                  })()}
                </div>
                <div className="text-xs text-ink-muted">
                  Region and country for this upload follow your company&apos;s Settings mapping.
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-2 text-xs font-medium text-ink">
                Auto-extract models
                {selectedCompany?.country_name ? (
                  <span className="font-normal text-ink-muted"> · {selectedCompany.country_name}</span>
                ) : null}
              </div>
              <div className="max-h-48 space-y-1 overflow-auto rounded-xl bg-surface-2 p-2 ring-1 ring-line">
                {resolvingModels ? (
                  <div className="px-2 py-3 text-xs text-ink-muted">Loading mappings for this company…</div>
                ) : !effectiveCompanyId ? (
                  <div className="px-2 py-3 text-xs text-ink-muted">Select a company first.</div>
                ) : !selectedCompany?.country_id ? (
                  <div className="px-2 py-3 text-xs text-amber-700 dark:text-amber-300">
                    This company has no country mapped. Set country in Settings → Companies.
                  </div>
                ) : selectedModelIds.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-ink-muted">
                    No models with mappings for {selectedCompany.country_name ?? "this country"}. Add models +
                    mappings under{" "}
                    <Link to="/mappings" className="text-brand-700 hover:underline dark:text-brand-300">
                      Mappings
                    </Link>
                    .
                  </div>
                ) : (
                  selectedModelIds.map((mid) => {
                    const m = allModels.find((x) => x.id === mid);
                    const maps = mappingsByModel[mid] ?? [];
                    const active = maps.find((x) => x.is_active) ?? maps[0];
                    return (
                      <div
                        key={mid}
                        className="flex items-center justify-between gap-3 rounded-lg bg-brand-500/10 px-3 py-2 text-sm text-ink"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">{m?.name ?? mid}</div>
                          <div className="truncate text-[11px] text-ink-muted">
                            {active
                              ? `${active.name} (v${active.version})${active.is_active ? " · active" : ""}`
                              : "No mapping"}
                            {m?.country_name ? ` · ${m.country_name}` : ""}
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand-800 dark:text-brand-300">
                          Will extract
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-2 text-xs text-ink-muted">
                All models mapped to this company&apos;s country are extracted automatically from one Excel
                file — no selection needed.
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-ink">Report date</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-ink-muted">Year</div>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(e.target.value ? parseInt(e.target.value, 10) : "")}
                    className="h-11 w-full rounded-xl bg-surface-2 px-4 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                  >
                    {[0, -1, -2, 1, 2].map((d) => {
                      const y = new Date().getFullYear() + d;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-xs text-ink-muted">Month</div>
                  <select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value ? parseInt(e.target.value, 10) : "")}
                    className="h-11 w-full rounded-xl bg-surface-2 px-4 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.v} value={m.v}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-2 text-xs text-ink-muted">
                Data is stored with this date. Dashboard graphs filter by date/quarter.
              </div>
            </div>

            {!multiModel && (
              <div>
                <div className="mb-2 text-xs font-medium text-ink">Report key</div>
                <Input
                  placeholder="OSRA-2026-01 or custom"
                  value={customReportKey}
                  onChange={(e) => setCustomReportKey(e.target.value)}
                  disabled={!singleModelId}
                />
                <div className="mt-2 text-xs text-ink-muted">
                  Filled from Model + Year + Month; edit for a custom key. With multiple models, each
                  gets its own key automatically.
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium text-ink">Notes (optional)</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="w-full rounded-xl bg-surface-2 p-4 text-sm text-ink ring-1 ring-line placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                placeholder="What changed in this version?"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="mb-2 text-xs font-medium text-ink">Report workbook (.xlsx)</div>
            <div
              {...dz.getRootProps()}
              className={cn(
                "group grid min-h-[220px] cursor-pointer place-items-center rounded-2xl bg-gradient-to-br from-white/5 to-transparent p-6 text-center ring-1 ring-line transition hover:bg-surface-3",
                dz.isDragActive && "ring-brand-400/40"
              )}
            >
              <input {...dz.getInputProps()} />
              <div>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/25">
                  {file ? (
                    <FileSpreadsheet className="h-6 w-6 text-brand-700 dark:text-brand-300" />
                  ) : (
                    <UploadCloud className="h-6 w-6 text-brand-700 dark:text-brand-300" />
                  )}
                </div>
                <div className="mt-3 text-sm font-medium text-ink">
                  {file ? file.name : "Drop your .xlsx workbook here"}
                </div>
                <div className="mt-1 text-xs text-ink-muted">
                  {file ? "Click to replace" : "or browse — Excel .xlsx / .xlsm / .xls"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={onSubmit} disabled={submitting || resolvingModels || !selectedModelIds.length}>
                {submitting
                  ? "Uploading…"
                  : selectedModelIds.length > 1
                    ? `Create ${selectedModelIds.length} uploads`
                    : "Create upload"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setFile(null)}
                disabled={!file || submitting}
              >
                Clear file
              </Button>
            </div>

            {anyCellMapping && file && (
              <div className="mt-4 rounded-xl border border-line bg-surface-panel/40 p-4">
                <div className="mb-2 text-xs font-medium text-ink">
                  Extraction preview (Sheet + Cell → will be stored)
                </div>
                {Object.keys(previewByModel).length > 1 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {Object.keys(previewByModel).map((mid) => {
                      const name = allModels.find((m) => m.id === mid)?.name ?? mid;
                      const active = previewModelTab === mid;
                      return (
                        <button
                          key={mid}
                          type="button"
                          onClick={() => setPreviewModelTab(mid)}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition",
                            active
                              ? "bg-brand-500/20 text-brand-100 ring-brand-400/40"
                              : "bg-surface-2 text-ink-muted ring-line hover:text-ink"
                          )}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {previewLoading ? (
                  <div className="py-4 text-center text-sm text-ink-muted">Loading preview…</div>
                ) : activePreview?.error ? (
                  <div className="py-4 text-center text-sm text-amber-300">{activePreview.error}</div>
                ) : previewItems && previewItems.length > 0 ? (
                  <>
                    <HierarchyExpandControls
                      canExpand={previewTableView.codesWithChildren.size > 0}
                      onExpandAll={() => setPreviewTableExpanded(new Set(previewTableView.codesWithChildren))}
                      onCollapseAll={() => setPreviewTableExpanded(new Set())}
                      className="mb-2"
                    />
                    <div className="max-h-48 overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-surface-panel text-ink-muted">
                          <tr>
                            <th className="pb-2 pr-2">Code</th>
                            <th className="pb-2 pr-2">Description</th>
                            <th className="pb-2 pr-2">Sheet</th>
                            <th className="pb-2 pr-2">Cell</th>
                            <th className="pb-2">Value</th>
                          </tr>
                        </thead>
                        <tbody className="text-ink">
                          {previewTableView.flat.map(({ row: it, depth }) => {
                            const hasKids = previewTableView.codesWithChildren.has(it.code);
                            const isOpen = previewTableView.expandedForWalk.has(it.code);
                            return (
                              <tr
                                key={`${it.code}-${it.sheet_name}-${it.cell_ref}`}
                                className={`border-t border-line ${it.value == null ? "bg-amber-500/5" : ""}`}
                              >
                                <td className="py-1.5 pr-2 font-mono">
                                  <HierarchyCodeCell
                                    code={it.code}
                                    depth={depth}
                                    hasChildren={hasKids}
                                    isExpanded={isOpen}
                                    onToggle={() => togglePreviewTableRow(it.code)}
                                    textClassName="font-mono text-ink"
                                  />
                                </td>
                                <td className="max-w-[120px] truncate py-1.5 pr-2">{it.description ?? "—"}</td>
                                <td className="py-1.5 pr-2">{it.sheet_name}</td>
                                <td className="py-1.5 pr-2 font-mono">{it.cell_ref}</td>
                                <td className="py-1.5 font-mono font-medium text-brand-800 dark:text-brand-300">{formatValueToSigFigs(it.value) || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : previewItems ? (
                  <div className="py-4 text-center text-sm text-ink-muted">No items extracted.</div>
                ) : (
                  <div className="py-4 text-center text-sm text-ink-muted">
                    Select models with mappings to preview extraction.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
