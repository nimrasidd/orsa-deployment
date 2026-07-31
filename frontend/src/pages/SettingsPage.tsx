import * as React from "react";
import { toast } from "sonner";
import {
  createCompany,
  deleteCompany,
  listAllModels,
  listCompanies,
  listCountriesByRegion,
  listRegions,
  companyLabel,
  type CompanyOut,
  type CountryOut,
  type ModelOut,
  type RegionOut
} from "../api/regions";
import { createSettingsUser, deleteSettingsUser, listSettingsUsers, updateUserCompany, type UserListOut } from "../api/settings";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { useAuth } from "../auth/AuthContext";
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

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [regions, setRegions] = React.useState<RegionOut[]>([]);
  const [companies, setCompanies] = React.useState<CompanyOut[]>([]);
  const [models, setModels] = React.useState<ModelOut[]>([]);
  const [users, setUsers] = React.useState<UserListOut[]>([]);

  const [coName, setCoName] = React.useState("");
  const [coRegionId, setCoRegionId] = React.useState("");
  const [coCountryId, setCoCountryId] = React.useState("");
  const [coCountries, setCoCountries] = React.useState<CountryOut[]>([]);
  const [savingCo, setSavingCo] = React.useState(false);

  const [uEmail, setUEmail] = React.useState("");
  const [uPassword, setUPassword] = React.useState("");
  const [uName, setUName] = React.useState("");
  const [uCompanyId, setUCompanyId] = React.useState("");
  const [savingUser, setSavingUser] = React.useState(false);

  const [mappingUserId, setMappingUserId] = React.useState<string | null>(null);

  const regionName = React.useMemo(() => {
    const m = new Map(regions.map((r) => [r.id, r.name]));
    return (id: string) => m.get(id) ?? id;
  }, [regions]);

  async function refresh() {
    const [r, c, u, m] = await Promise.all([
      listRegions(),
      listCompanies(),
      listSettingsUsers(),
      listAllModels().catch(() => [] as ModelOut[]),
    ]);
    setRegions(Array.isArray(r) ? r : []);
    setCompanies(Array.isArray(c) ? c : []);
    setUsers(Array.isArray(u) ? u : []);
    setModels(Array.isArray(m) ? m : []);
  }

  /** Flattened rows: each model × companies that share its country. */
  const modelCompanyCountryRows = React.useMemo(() => {
    const rows: Array<{
      key: string;
      modelName: string;
      companyName: string;
      countryName: string;
      regionName: string;
    }> = [];
    for (const model of models) {
      const cos = companies.filter((c) => c.country_id && String(c.country_id) === String(model.country_id));
      if (!cos.length) {
        rows.push({
          key: `${model.id}-none`,
          modelName: model.name,
          companyName: "— (no company in this country)",
          countryName: model.country_name ?? "—",
          regionName: model.region_name ?? "—",
        });
        continue;
      }
      for (const co of cos) {
        rows.push({
          key: `${model.id}-${co.id}`,
          modelName: model.name,
          companyName: co.name,
          countryName: model.country_name ?? co.country_name ?? "—",
          regionName: model.region_name ?? co.region_name ?? "—",
        });
      }
    }
    rows.sort((a, b) =>
      a.countryName.localeCompare(b.countryName) ||
      a.companyName.localeCompare(b.companyName) ||
      a.modelName.localeCompare(b.modelName)
    );
    return rows;
  }, [models, companies]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch((e: unknown) => {
        const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Failed to load";
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!coRegionId) {
      setCoCountries([]);
      setCoCountryId("");
      return;
    }
    listCountriesByRegion(coRegionId).then(setCoCountries).catch(() => setCoCountries([]));
  }, [coRegionId]);

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!coName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!coRegionId) {
      toast.error("Select a region");
      return;
    }
    setSavingCo(true);
    try {
      const created = await createCompany({
        name: coName.trim(),
        region_id: coRegionId,
        country_id: coCountryId || null
      });
      toast.success("Company created", { description: created.name });
      setCoName("");
      setCoCountryId("");
      await refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "detail" in e
          ? String((e as { detail: unknown }).detail)
          : String(e);
      toast.error("Could not create company", { description: msg });
    } finally {
      setSavingCo(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!uEmail.trim() || !uPassword || !uName.trim() || !uCompanyId) {
      toast.error("Fill in email, password, name, and company");
      return;
    }
    if (uPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSavingUser(true);
    try {
      await createSettingsUser({
        email: uEmail.trim(),
        password: uPassword,
        name: uName.trim(),
        company_id: uCompanyId
      });
      toast.success("User created", { description: uEmail.trim() });
      setUEmail("");
      setUPassword("");
      setUName("");
      setUCompanyId("");
      await refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "detail" in e
          ? String((e as { detail: unknown }).detail)
          : String(e);
      toast.error("Could not create user", { description: msg });
    } finally {
      setSavingUser(false);
    }
  }

  async function handleCompanyMap(targetUserId: string, companyId: string) {
    setMappingUserId(targetUserId);
    try {
      await updateUserCompany(targetUserId, companyId);
      toast.success("User mapped to company");
      await refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "detail" in e
          ? String((e as { detail: unknown }).detail)
          : String(e);
      toast.error("Could not update user", { description: msg });
    } finally {
      setMappingUserId(null);
    }
  }

  async function handleCompanyUnmap(targetUserId: string) {
    setMappingUserId(targetUserId);
    try {
      await updateUserCompany(targetUserId, null);
      toast.success("User unmapped");
      await refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "detail" in e
          ? String((e as { detail: unknown }).detail)
          : String(e);
      toast.error("Could not unmap user", { description: msg });
    } finally {
      setMappingUserId(null);
    }
  }

  async function handleDeleteUser(targetUserId: string, email: string) {
    if (!window.confirm(`Delete user ${email}? This cannot be undone.`)) return;
    setMappingUserId(targetUserId);
    try {
      await deleteSettingsUser(targetUserId);
      toast.success("User deleted");
      await refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "detail" in e
          ? String((e as { detail: unknown }).detail)
          : String(e);
      toast.error("Could not delete user", { description: msg });
    } finally {
      setMappingUserId(null);
    }
  }

  async function handleDeleteCompany(companyId: string, name: string) {
    const assigned = users.filter((u) => u.company_id === companyId).length;
    if (assigned > 0) {
      toast.error("Cannot delete company", { description: "Unmap or delete assigned users first." });
      return;
    }
    if (!window.confirm(`Delete company ${name}? This cannot be undone.`)) return;
    setSavingCo(true);
    try {
      await deleteCompany(companyId);
      toast.success("Company deleted");
      await refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "detail" in e
          ? String((e as { detail: unknown }).detail)
          : String(e);
      toast.error("Could not delete company", { description: msg });
    } finally {
      setSavingCo(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle={
          <>
            Manage companies and user accounts. Signed in as{" "}
            <span className="font-semibold text-ink">{user?.email}</span>.
          </>
        }
      />

      {loading ? (
        <div className="py-16 text-center text-sm text-ink-muted">Loading directory…</div>
      ) : (
        <>
          <Card
            title="Companies"
            subtitle="Each company is mapped to a region and country. Register companies first, then assign users."
          >
            <form onSubmit={handleCreateCompany} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface-3/50 p-4">
              <div>
                <label className={labelClass}>Company name</label>
                <Input value={coName} onChange={(e) => setCoName(e.target.value)} placeholder="e.g. ACME Takaful" className="w-48" />
              </div>
              <div>
                <label className={labelClass}>Region</label>
                <select value={coRegionId} onChange={(e) => setCoRegionId(e.target.value)} className={`min-w-[10rem] ${formControlClass}`}>
                  <option value="">Select region</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Country (optional)</label>
                <select
                  value={coCountryId}
                  onChange={(e) => setCoCountryId(e.target.value)}
                  disabled={!coRegionId}
                  className={`min-w-[10rem] ${formControlClass}`}
                >
                  <option value="">—</option>
                  {coCountries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={savingCo}>
                {savingCo ? "Saving…" : "Register company"}
              </Button>
            </form>

            <div className={`max-h-[min(22rem,50vh)] ${tableWrapClass}`}>
              <table className={tableClass}>
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Company</th>
                    <th className={thClass}>Region</th>
                    <th className={thClass}>Country</th>
                    <th className={thClass}>Models</th>
                    <th className={thClass}>Actions</th>
                    <th className={`${thClass} font-mono normal-case`}>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => {
                    const assignedCount = users.filter((u) => u.company_id === c.id).length;
                    const canDelete = assignedCount === 0;
                    const modelNames = models
                      .filter((m) => c.country_id && String(m.country_id) === String(c.country_id))
                      .map((m) => m.name);
                    return (
                    <tr key={c.id} className={trClass}>
                      <td className={`${tdClass} font-semibold`}>{c.name}</td>
                      <td className={`${tdClass} text-ink`}>
                        {c.region_name ?? regionName(c.region_id)}
                      </td>
                      <td className={`${tdClass} text-ink`}>
                        {c.country_name ? (
                          <span className="font-medium">{c.country_name}</span>
                        ) : (
                          <span className="text-ink-muted">Not mapped</span>
                        )}
                      </td>
                      <td className={`${tdClass} text-xs text-ink`}>
                        {modelNames.length ? (
                          modelNames.join(", ")
                        ) : (
                          <span className="text-ink-muted">None for this country</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!canDelete || savingCo}
                          onClick={() => void handleDeleteCompany(c.id, c.name)}
                          title={
                            canDelete
                              ? "Delete company"
                              : `Cannot delete: ${assignedCount} user(s) assigned`
                          }
                        >
                          Delete
                        </Button>
                      </td>
                      <td className={`${tdClass} font-mono text-xs text-ink-soft`}>{c.id}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="Model · Company · Country"
            subtitle="Models belong to a country. Companies in that country use those models on upload."
          >
            <div className={`max-h-[min(28rem,55vh)] ${tableWrapClass}`}>
              <table className={tableClass}>
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Model</th>
                    <th className={thClass}>Company</th>
                    <th className={thClass}>Country</th>
                    <th className={thClass}>Region</th>
                  </tr>
                </thead>
                <tbody>
                  {modelCompanyCountryRows.length === 0 ? (
                    <tr className={trClass}>
                      <td colSpan={4} className={`${tdClass} text-center text-ink-muted`}>
                        No models yet. Create models under Mappings → Models, and map companies to a country above.
                      </td>
                    </tr>
                  ) : (
                    modelCompanyCountryRows.map((row) => (
                      <tr key={row.key} className={trClass}>
                        <td className={`${tdClass} font-semibold`}>{row.modelName}</td>
                        <td className={`${tdClass} text-ink`}>{row.companyName}</td>
                        <td className={`${tdClass} font-medium text-ink`}>{row.countryName}</td>
                        <td className={`${tdClass} text-ink-muted`}>{row.regionName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Users" subtitle="Create accounts and map each user to a company from the row dropdown.">
            <form onSubmit={handleCreateUser} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface-3/50 p-4">
              <div>
                <label className={labelClass}>Email</label>
                <Input
                  type="email"
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="w-52"
                />
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <Input
                  type="password"
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  placeholder="min. 6 characters"
                  className="w-44"
                />
              </div>
              <div>
                <label className={labelClass}>Display name</label>
                <Input value={uName} onChange={(e) => setUName(e.target.value)} placeholder="Full name" className="w-44" />
              </div>
              <div>
                <label className={labelClass}>Company</label>
                <select value={uCompanyId} onChange={(e) => setUCompanyId(e.target.value)} className={`min-w-[12rem] ${formControlClass}`}>
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{companyLabel(c)}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={savingUser}>
                {savingUser ? "Creating…" : "Register / add user"}
              </Button>
            </form>

            <div className={`max-h-[min(28rem,55vh)] ${tableWrapClass}`}>
              <table className={`${tableClass} min-w-[42rem]`}>
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Name</th>
                    <th className={thClass}>Email</th>
                    <th className={thClass}>Company</th>
                    <th className={thClass}>Map to company</th>
                    <th className={thClass}>Actions</th>
                    <th className={thClass}>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={trClass}>
                      <td className={`${tdClass} font-semibold`}>{u.name}</td>
                      <td className={`${tdClass} text-ink-muted`}>{u.email}</td>
                      <td className={tdClass}>
                        {u.company_name ?? u.company_id ?? "—"}
                      </td>
                      <td className={tdClass}>
                        <select
                          value={u.company_id ?? ""}
                          disabled={mappingUserId === u.id}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (next && next !== (u.company_id ?? "")) void handleCompanyMap(u.id, next);
                          }}
                          className={`min-w-[11rem] ${formControlClass}`}
                        >
                          <option value="">Not assigned</option>
                          {u.company_id && !companies.some((c) => c.id === u.company_id) ? (
                            <option value={u.company_id}>{u.company_name ?? u.company_id}</option>
                          ) : null}
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>{companyLabel(c)}</option>
                          ))}
                        </select>
                      </td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={mappingUserId === u.id || !u.company_id}
                            onClick={() => void handleCompanyUnmap(u.id)}
                            title={u.company_id ? "Unmap user from company" : "User is already unmapped"}
                          >
                            Unmap
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={mappingUserId === u.id || !!u.company_id}
                            onClick={() => void handleDeleteUser(u.id, u.email)}
                            title={u.company_id ? "Unmap user first, then delete" : "Delete user"}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                      <td className={`whitespace-nowrap ${tdClass} text-xs text-ink-soft`}>{formatWhen(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
