import * as React from "react";
import { toast } from "sonner";
import {
  createCompany,
  deleteCompany,
  listCompanies,
  listCountriesByRegion,
  listRegions,
  type CompanyOut,
  type CountryOut,
  type RegionOut
} from "../api/regions";
import { createSettingsUser, deleteSettingsUser, listSettingsUsers, updateUserCompany, type UserListOut } from "../api/settings";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { useAuth } from "../auth/AuthContext";

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
    const [r, c, u] = await Promise.all([listRegions(), listCompanies(), listSettingsUsers()]);
    setRegions(Array.isArray(r) ? r : []);
    setCompanies(Array.isArray(c) ? c : []);
    setUsers(Array.isArray(u) ? u : []);
  }

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

  const selectCls =
    "h-10 rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/60";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage companies and user accounts. Signed in as <span className="text-slate-300">{user?.email}</span>.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading directory…</div>
      ) : (
        <>
          <Card
            title="Companies"
            subtitle="All registered companies. Create a company before assigning new users."
          >
            <form onSubmit={handleCreateCompany} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <div>
                <div className="mb-1 text-xs text-slate-400">Company name</div>
                <Input value={coName} onChange={(e) => setCoName(e.target.value)} placeholder="e.g. ACME Takaful" className="w-48" />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-400">Region</div>
                <select value={coRegionId} onChange={(e) => setCoRegionId(e.target.value)} className={`min-w-[10rem] ${selectCls}`}>
                  <option value="">Select region</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-400">Country (optional)</div>
                <select
                  value={coCountryId}
                  onChange={(e) => setCoCountryId(e.target.value)}
                  disabled={!coRegionId}
                  className={`min-w-[10rem] ${selectCls} disabled:opacity-40`}
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

            <div className="max-h-[min(22rem,50vh)] overflow-auto rounded-lg border border-white/10 [scrollbar-gutter:stable] [scrollbar-width:thin]">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-slate-950/95 text-xs text-slate-400 backdrop-blur-sm">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Region</th>
                    <th className="px-4 py-2.5 font-medium">Country id</th>
                    <th className="px-4 py-2.5 font-medium">Actions</th>
                    <th className="px-4 py-2.5 font-medium font-mono text-xs">ID</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {companies.map((c) => (
                    (() => {
                      const assignedCount = users.filter((u) => u.company_id === c.id).length;
                      const canDelete = assignedCount === 0;
                      return (
                    <tr key={c.id} className="border-t border-white/10">
                      <td className="px-4 py-2.5 font-medium text-slate-100">{c.name}</td>
                      <td className="px-4 py-2.5 text-slate-400">{regionName(c.region_id)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{c.country_id ?? "—"}</td>
                      <td className="px-4 py-2.5">
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
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{c.id}</td>
                    </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Users" subtitle="Registered accounts. Map a user to a company with the dropdown in each row.">
            <form onSubmit={handleCreateUser} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <div>
                <div className="mb-1 text-xs text-slate-400">Email</div>
                <Input
                  type="email"
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="w-52"
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-400">Password</div>
                <Input
                  type="password"
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  placeholder="min. 6 characters"
                  className="w-44"
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-400">Display name</div>
                <Input value={uName} onChange={(e) => setUName(e.target.value)} placeholder="Full name" className="w-44" />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-400">Company</div>
                <select value={uCompanyId} onChange={(e) => setUCompanyId(e.target.value)} className={`min-w-[12rem] ${selectCls}`}>
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={savingUser}>
                {savingUser ? "Creating…" : "Register / add user"}
              </Button>
            </form>

            <div className="max-h-[min(28rem,55vh)] overflow-auto rounded-lg border border-white/10 [scrollbar-gutter:stable] [scrollbar-width:thin]">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-slate-950/95 text-xs text-slate-400 backdrop-blur-sm">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Company</th>
                    <th className="px-4 py-2.5 font-medium">Map to company</th>
                    <th className="px-4 py-2.5 font-medium">Actions</th>
                    <th className="px-4 py-2.5 font-medium">Registered</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-white/10">
                      <td className="px-4 py-2.5 font-medium text-slate-100">{u.name}</td>
                      <td className="px-4 py-2.5 text-slate-400">{u.email}</td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {u.company_name ?? u.company_id ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={u.company_id ?? ""}
                          disabled={mappingUserId === u.id}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (next && next !== (u.company_id ?? "")) void handleCompanyMap(u.id, next);
                          }}
                          className={`min-w-[11rem] ${selectCls}`}
                        >
                          <option value="">Not assigned</option>
                          {u.company_id && !companies.some((c) => c.id === u.company_id) ? (
                            <option value={u.company_id}>{u.company_name ?? u.company_id}</option>
                          ) : null}
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
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
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{formatWhen(u.created_at)}</td>
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
