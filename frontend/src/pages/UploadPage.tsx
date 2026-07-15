import * as React from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { createUpload, previewUpload } from "../api/uploads";
import { listMappings } from "../api/mappings";
import type { MappingOut } from "../types";
import { listAllModels, listCompanies, type CompanyOut, type ModelOut } from "../api/regions";
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

export function UploadPage() {
  const nav = useNavigate();
  const { openOrActivate } = useWorkspace();
  const { user } = useAuth();
  const [reportKey, setReportKey] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [modelMappings, setModelMappings] = React.useState<MappingOut[]>([]);
  /** "manual" or mapping config_id (uuid). */
  const [extractionMode, setExtractionMode] = React.useState<"manual" | string>("manual");

  const [companyModels, setCompanyModels] = React.useState<ModelOut[]>([]);
  const [modelId, setModelId] = React.useState("");
  const [reportYear, setReportYear] = React.useState<number | "">(new Date().getFullYear());
  const [reportMonth, setReportMonth] = React.useState<number | "">(new Date().getMonth() + 1);
  const [previewItems, setPreviewItems] = React.useState<
    { code: string; description?: string | null; sheet_name: string; cell_ref: string; value: string | null }[] | null
  >(null);
  const [previewTableExpanded, setPreviewTableExpanded] = React.useState<Set<string>>(() => new Set());
  const [previewFileSheets, setPreviewFileSheets] = React.useState<string[] | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [allCompanies, setAllCompanies] = React.useState<CompanyOut[]>([]);
  const [uploadCompanyId, setUploadCompanyId] = React.useState("");

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
    if (!modelId) {
      setModelMappings([]);
      setExtractionMode("manual");
      return;
    }
    setModelMappings([]);
    setExtractionMode("manual");
    let cancelled = false;
    listMappings(modelId)
      .then((rows) => {
        if (cancelled) return;
        const arr = Array.isArray(rows) ? rows : [];
        setModelMappings(arr);
        const active = arr.find((m) => m.is_active);
        const pick = active?.id ?? arr[0]?.id;
        setExtractionMode(pick ?? "manual");
      })
      .catch(() => {
        if (!cancelled) {
          setModelMappings([]);
          setExtractionMode("manual");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const run = async () => {
      try {
        const data = await listAllModels();
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        setCompanyModels(arr);
        setModelId((mid) => (mid && arr.some((m) => m.id === mid) ? mid : ""));
      } catch {
        if (!cancelled) {
          setCompanyModels([]);
          setModelId("");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const derivedReportKey = React.useMemo(() => {
    if (!modelId || !reportYear || !reportMonth) return "";
    const m = companyModels.find((x) => x.id === modelId);
    if (!m) return "";
    return `${m.name}-${reportYear}-${String(reportMonth).padStart(2, "0")}`;
  }, [modelId, reportYear, reportMonth, companyModels]);

  React.useEffect(() => {
    if (derivedReportKey) setReportKey(derivedReportKey);
  }, [derivedReportKey]);

  const useCellMapping = extractionMode !== "manual";
  const selectedMappingConfigId = useCellMapping ? extractionMode : undefined;

  const dz = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx", ".xlsm"],
      "application/vnd.ms-excel": [".xls"]
    },
    multiple: false,
    onDropAccepted: (files) => {
      const f = files[0] ?? null;
      setFile(f);
      setPreviewItems(null);
      setPreviewFileSheets(null);
    },
    onDropRejected: () =>
      toast.error("Please choose a valid Excel workbook (.xlsx, .xlsm, or .xls).")
  });

  React.useEffect(() => {
    if (!file || !useCellMapping || !selectedMappingConfigId) {
      setPreviewItems(null);
      setPreviewFileSheets(null);
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    previewUpload(file, modelId || undefined, selectedMappingConfigId)
      .then((r) => {
        setPreviewItems(r.items);
        setPreviewFileSheets(r.file_sheets ?? null);
      })
      .catch((e: any) => {
        setPreviewItems(null);
        setPreviewFileSheets(null);
        const msg = e?.message ?? (e?.detail != null ? String(e.detail) : "Preview failed");
        toast.error("Preview failed", { description: msg });
      })
      .finally(() => setPreviewLoading(false));
  }, [file, useCellMapping, selectedMappingConfigId, modelId]);

  React.useEffect(() => {
    setPreviewTableExpanded(new Set());
  }, [previewItems]);

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

  async function onSubmit() {
    if (!file) {
      toast.error("Select an Excel workbook (.xlsx) first.");
      return;
    }
    if (!reportKey.trim()) {
      toast.error("Report key is required.");
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
    setSubmitting(true);
    try {
      const created = await createUpload({
        file,
        report_key: reportKey.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
        use_mapping: useCellMapping,
        mapping_config_id: selectedMappingConfigId,
        model_id: modelId || undefined,
        company_id: resolvedCompanyId,
        report_year: typeof reportYear === "number" ? reportYear : undefined,
        report_month: typeof reportMonth === "number" ? reportMonth : undefined,
      });
      toast.success("Upload created", {
        description: `Version v${created.version_no}${useCellMapping ? " (mapping)" : ""}`
      });
      openOrActivate({
        path: `/uploads/${created.id}`,
        title: `Report • ${created.report_key} v${created.version_no}`
      });
      nav(`/uploads/${created.id}`);
    } catch (e: any) {
      const detail = e?.detail;
      const msg =
        e?.message ??
        (detail != null
          ? Array.isArray(detail)
            ? detail.map((x: { msg?: string }) => x?.msg ?? JSON.stringify(x)).join("; ")
            : String(detail)
          : "Unknown error");
      toast.error("Upload failed", { description: msg });
      console.error("Upload error:", msg, e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card
        title="Upload report workbook"
        subtitle={
          !modelId
            ? "Use an Excel .xlsx workbook (or .xlsm / .xls). Choose a model, then pick a saved mapping or Manual."
            : useCellMapping
              ? "Extraction uses the mapping below: each code is read from its Sheet + Cell in your workbook."
              : "Manual: the workbook must include Code, Description, Value columns (no cell mapping)."
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {useCellMapping && (
              <Badge className="bg-green-500/15 text-green-200 ring-green-400/25">
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                Cell mapping
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
                <div className="mb-2 text-xs font-medium text-slate-300">Company</div>
                <select
                  value={uploadCompanyId}
                  onChange={(e) => setUploadCompanyId(e.target.value)}
                  className="h-11 w-full rounded-xl bg-white/5 px-4 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                >
                  <option value="">Select company</option>
                  {allCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-slate-500">
                  Upload is stored under this company. Region and country on the report come from this
                  company&apos;s mapping in Settings → Companies (no separate country step).
                </div>
              </div>
            ) : user?.company_name ? (
              <div className="space-y-1 rounded-xl bg-white/5 px-4 py-2 text-sm text-slate-300">
                <div>
                  <span className="text-slate-500">Company:</span> {user.company_name}
                </div>
                <div className="text-xs text-slate-500">
                  Region and country for this upload follow your company&apos;s Settings mapping.
                </div>
              </div>
            ) : null}
            <div>
              <div className="mb-2 text-xs font-medium text-slate-300">Model</div>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="h-11 w-full rounded-xl bg-white/5 px-4 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
              >
                <option value="">Select model</option>
                {companyModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <div className="mt-2 text-xs text-slate-400">
                {user?.is_admin ? (
                  <>
                    Add mapping models under{" "}
                    <Link to="/mappings" className="text-brand-400 hover:text-brand-300">
                      Mappings
                    </Link>{" "}
                    → Models if none are listed.
                  </>
                ) : (
                  "If no models appear, ask your administrator."
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-slate-300">
                Mapping for this model <span className="font-normal text-slate-500">(dropdown)</span>
              </div>
              <select
                value={extractionMode}
                onChange={(e) => setExtractionMode(e.target.value as "manual" | string)}
                disabled={!modelId}
                className="h-11 w-full rounded-xl bg-white/5 px-4 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="manual">
                  Manual — file has Code, Description, Value (and sheet/cell columns as needed)
                </option>
                {modelMappings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (v{m.version}){m.is_active ? " • active" : ""} — Code → Sheet, Cell
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-slate-400">
                {modelId
                  ? "Pick a saved mapping for the selected model to extract values by Code → Sheet, Cell. Choose Manual if the workbook already has values in columns instead."
                  : "Select a model first; all mappings defined for that model appear in this list."}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-slate-300">Report date</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-slate-500">Year</div>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(e.target.value ? parseInt(e.target.value, 10) : "")}
                    className="h-11 w-full rounded-xl bg-white/5 px-4 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                  >
                    {[0, -1, -2, 1, 2].map((d) => {
                      const y = new Date().getFullYear() + d;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-xs text-slate-500">Month</div>
                  <select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value ? parseInt(e.target.value, 10) : "")}
                    className="h-11 w-full rounded-xl bg-white/5 px-4 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.v} value={m.v}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Data is stored with this date. Dashboard graphs filter by date/quarter.
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-slate-300">Report key</div>
              <Input
                placeholder="OSRA-2026-01 or custom"
                value={reportKey}
                onChange={(e) => setReportKey(e.target.value)}
              />
              <div className="mt-2 text-xs text-slate-400">
                Filled from Model + Year + Month above; edit to use a custom key.
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-slate-300">Notes (optional)</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="w-full rounded-xl bg-white/5 p-4 text-sm text-slate-100 ring-1 ring-white/10 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400/60"
                placeholder="What changed in this version?"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="mb-2 text-xs font-medium text-slate-300">Report workbook (.xlsx)</div>
            <div
              {...dz.getRootProps()}
              className={cn(
                "group grid min-h-[220px] cursor-pointer place-items-center rounded-2xl bg-gradient-to-br from-white/5 to-transparent p-6 text-center ring-1 ring-white/10 transition hover:bg-white/[0.06]",
                dz.isDragActive && "ring-brand-400/40"
              )}
            >
              <input {...dz.getInputProps()} />
              <div>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/25">
                  {file ? (
                    <FileSpreadsheet className="h-6 w-6 text-brand-200" />
                  ) : (
                    <UploadCloud className="h-6 w-6 text-brand-200" />
                  )}
                </div>
                <div className="mt-3 text-sm font-medium text-slate-100">
                  {file ? file.name : "Drop your .xlsx workbook here"}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {file ? "Click to replace" : "or browse — Excel .xlsx / .xlsm / .xls"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={onSubmit} disabled={submitting}>
                {submitting ? "Uploading…" : "Create upload"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setFile(null)}
                disabled={!file || submitting}
              >
                Clear file
              </Button>
            </div>

            {useCellMapping && file && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
                <div className="mb-2 text-xs font-medium text-slate-300">
                  Extraction preview (read from Sheet + Cell → will be stored in DB)
                </div>
                {previewLoading ? (
                  <div className="py-4 text-center text-sm text-slate-400">Loading preview…</div>
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
                        <thead className="sticky top-0 bg-slate-900 text-slate-400">
                          <tr>
                            <th className="pb-2 pr-2">Code</th>
                            <th className="pb-2 pr-2">Description</th>
                            <th className="pb-2 pr-2">Sheet</th>
                            <th className="pb-2 pr-2">Cell</th>
                            <th className="pb-2">Value</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-300">
                          {previewTableView.flat.map(({ row: it, depth }) => {
                            const hasKids = previewTableView.codesWithChildren.has(it.code);
                            const isOpen = previewTableView.expandedForWalk.has(it.code);
                            return (
                              <tr
                                key={`${it.code}-${it.sheet_name}-${it.cell_ref}`}
                                className={`border-t border-white/5 ${it.value == null ? "bg-amber-500/5" : ""}`}
                              >
                                <td className="py-1.5 pr-2 font-mono">
                                  <HierarchyCodeCell
                                    code={it.code}
                                    depth={depth}
                                    hasChildren={hasKids}
                                    isExpanded={isOpen}
                                    onToggle={() => togglePreviewTableRow(it.code)}
                                    textClassName="font-mono text-slate-300"
                                  />
                                </td>
                                <td className="max-w-[120px] truncate py-1.5 pr-2">{it.description ?? "—"}</td>
                                <td className="py-1.5 pr-2">{it.sheet_name}</td>
                                <td className="py-1.5 pr-2 font-mono">{it.cell_ref}</td>
                                <td className="py-1.5 font-mono text-brand-200">{formatValueToSigFigs(it.value) || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : previewItems ? (
                  <div className="py-4 text-center text-sm text-slate-400">No items extracted.</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}

