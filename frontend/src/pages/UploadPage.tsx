import * as React from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { createUpload, previewUpload } from "../api/uploads";
import { getActiveMappingItems } from "../api/mappings";
import { listCompanyModels, type CompanyModelOut } from "../api/companyModels";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { FileSpreadsheet, UploadCloud, MapPin } from "lucide-react";
import { cn } from "../lib/cn";
import { formatValueToSigFigs } from "../lib/format";
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
  const [useMapping, setUseMapping] = React.useState(true);
  const [hasActiveMapping, setHasActiveMapping] = React.useState(false);

  const [companyModels, setCompanyModels] = React.useState<CompanyModelOut[]>([]);
  const [modelId, setModelId] = React.useState("");
  const [reportYear, setReportYear] = React.useState<number | "">(new Date().getFullYear());
  const [reportMonth, setReportMonth] = React.useState<number | "">(new Date().getMonth() + 1);
  const [previewItems, setPreviewItems] = React.useState<
    { code: string; description?: string | null; sheet_name: string; cell_ref: string; value: string | null }[] | null
  >(null);
  const [previewFileSheets, setPreviewFileSheets] = React.useState<string[] | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  React.useEffect(() => {
    getActiveMappingItems(modelId || undefined)
      .then((items) => setHasActiveMapping(items.length > 0))
      .catch(() => setHasActiveMapping(false));
  }, [modelId]);

  React.useEffect(() => {
    listCompanyModels().then(setCompanyModels).catch(() => setCompanyModels([]));
  }, []);

  const derivedReportKey = React.useMemo(() => {
    if (!modelId || !reportYear || !reportMonth) return "";
    const m = companyModels.find((x) => x.id === modelId);
    if (!m) return "";
    return `${m.name}-${reportYear}-${String(reportMonth).padStart(2, "0")}`;
  }, [modelId, reportYear, reportMonth, companyModels]);

  React.useEffect(() => {
    if (derivedReportKey) setReportKey(derivedReportKey);
  }, [derivedReportKey]);

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
      if (f && hasActiveMapping && useMapping) {
        setPreviewLoading(true);
        previewUpload(f, modelId || undefined)
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
      }
    },
    onDropRejected: () => toast.error("Please choose a valid Excel file (.xlsx, .xlsm, or .xls).")
  });

  React.useEffect(() => {
    if (file && hasActiveMapping && useMapping && !previewItems && !previewLoading) {
      setPreviewLoading(true);
      previewUpload(file, modelId || undefined)
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
    } else if (!file || !useMapping) {
      setPreviewItems(null);
      setPreviewFileSheets(null);
    }
  }, [file, hasActiveMapping, useMapping, modelId]);

  async function onSubmit() {
    if (!file) {
      toast.error("Select an Excel file first.");
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
    setSubmitting(true);
    try {
      const created = await createUpload({
        file,
        report_key: reportKey.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
        use_mapping: useMapping,
        model_id: modelId || undefined,
        company_id: user?.company_id || undefined,
        report_year: reportYear !== "" ? reportYear : undefined,
        report_month: reportMonth !== "" ? reportMonth : undefined,
      });
      toast.success("Upload created", {
        description: `Version v${created.version_no}${useMapping && hasActiveMapping ? " (using mapping)" : ""}`
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
        title="Upload Excel"
        subtitle={
          hasActiveMapping
            ? "Values will be extracted using the active mapping configuration."
            : "No active mapping. Upload file must contain Code, Description, Value columns."
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {hasActiveMapping && (
              <Badge className="bg-green-500/15 text-green-200 ring-green-400/25">
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                Mapping active
              </Badge>
            )}
            <Link to="/">
              <Button variant="ghost">Back</Button>
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            {user?.company_name && (
              <div className="rounded-xl bg-white/5 px-4 py-2 text-sm text-slate-300">
                <span className="text-slate-500">Company:</span> {user.company_name}
              </div>
            )}
            <div>
              <div className="mb-2 text-xs font-medium text-slate-300">Model</div>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="h-11 w-full rounded-xl bg-white/5 px-4 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
              >
                <option value="">Select model</option>
                {companyModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <div className="mt-2 text-xs text-slate-400">
                Create models in <Link to="/mappings" className="text-sky-400 hover:text-sky-300">Mappings</Link> if none listed.
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
                    className="h-11 w-full rounded-xl bg-white/5 px-4 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
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
                    className="h-11 w-full rounded-xl bg-white/5 px-4 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
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
                Auto-generated from Model/Year/Month, or enter custom.
              </div>
            </div>

            {hasActiveMapping && (
              <div>
                <label className="flex h-11 items-center justify-between gap-3 rounded-xl bg-white/5 px-4 text-sm ring-1 ring-white/10">
                  <span className="text-slate-300">Use active mapping</span>
                  <input
                    type="checkbox"
                    checked={useMapping}
                    onChange={(e) => setUseMapping(e.target.checked)}
                    className="h-4 w-4 accent-sky-400"
                  />
                </label>
                <div className="mt-2 text-xs text-slate-400">
                  When enabled, values are extracted from uploaded file based on mapping (Code → Sheet, Cell).
                  When disabled, file must contain Code, Description, Value columns.
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium text-slate-300">Notes (optional)</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="w-full rounded-xl bg-white/5 p-4 text-sm text-slate-100 ring-1 ring-white/10 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                placeholder="What changed in this version?"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="mb-2 text-xs font-medium text-slate-300">Excel file</div>
            <div
              {...dz.getRootProps()}
              className={cn(
                "group grid min-h-[220px] cursor-pointer place-items-center rounded-2xl bg-gradient-to-br from-white/5 to-transparent p-6 text-center ring-1 ring-white/10 transition hover:bg-white/[0.06]",
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
                  {file ? file.name : "Drop your Excel here"}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {file ? "Click to replace" : "or click to browse (.xlsx, .xlsm, .xls)"}
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

            {hasActiveMapping && useMapping && file && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
                <div className="mb-2 text-xs font-medium text-slate-300">
                  Extraction preview (read from Sheet + Cell → will be stored in DB)
                </div>
                {previewLoading ? (
                  <div className="py-4 text-center text-sm text-slate-400">Loading preview…</div>
                ) : previewItems && previewItems.length > 0 ? (
                  <>
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
                          {previewItems.map((it, i) => (
                            <tr key={i} className={`border-t border-white/5 ${it.value == null ? "bg-amber-500/5" : ""}`}>
                              <td className="py-1.5 pr-2 font-mono">{it.code}</td>
                              <td className="py-1.5 pr-2 truncate max-w-[120px]">{it.description ?? "—"}</td>
                              <td className="py-1.5 pr-2">{it.sheet_name}</td>
                              <td className="py-1.5 pr-2 font-mono">{it.cell_ref}</td>
                              <td className="py-1.5 font-mono text-sky-200">{formatValueToSigFigs(it.value) || "—"}</td>
                            </tr>
                          ))}
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

