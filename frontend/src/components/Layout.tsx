import { BarChart3, FileUp, LayoutDashboard, LogOut, MapPin, Settings, Sparkles } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "../lib/cn";
import { useAuth } from "../auth/AuthContext";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";

const navBase = [
  { to: "/", label: "Home", icon: Sparkles },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reports", label: "Upload", icon: FileUp },
];
const navAdminOnly = [
  { to: "/mappings", label: "Mappings", icon: MapPin },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-surface">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-brand-700/10 blur-3xl dark:bg-brand-500/12" />
        <div className="absolute -bottom-48 right-[-80px] h-[420px] w-[420px] rounded-full bg-emerald-900/10 blur-3xl dark:bg-emerald-700/10" />
      </div>

      <div className="relative grid min-h-dvh grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-line bg-surface-panel/95 p-4 backdrop-blur-xl lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <BrandLogo size="sm" />
              <div className="mt-2">
                <div className="font-display text-[13px] font-semibold tracking-wide text-ink">Solvency Dashboard</div>
                <div className="text-[11px] text-ink-muted">ORSA workspace</div>
              </div>
            </div>
            <ThemeToggle className="shrink-0" />
          </div>

          <div className="mt-5 space-y-1">
            {user && (
              <div className="mb-2.5 rounded-xl border border-line bg-surface-3/80 px-3 py-2.5 text-[12px]">
                <div className="font-semibold text-ink">{user.name}</div>
                <div className="mt-0.5 truncate text-ink-muted">{user.company_name ?? user.email}</div>
                <button
                  type="button"
                  onClick={() => { logout(); navigate("/login"); }}
                  className="mt-2 flex items-center gap-1.5 font-medium text-ink-muted transition hover:text-brand-700 dark:hover:text-brand-300"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            )}
            {(user?.is_admin ? [...navBase, ...navAdminOnly] : navBase).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
                      isActive
                        ? "bg-brand-700 text-white shadow-sm dark:bg-brand-500 dark:text-slate-950"
                        : "text-ink-muted hover:bg-surface-3 hover:text-ink"
                    )
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-line bg-surface-3/70 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
              <BarChart3 className="h-3.5 w-3.5 text-brand-700 dark:text-brand-300" />
              Tip
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
              Upload the same <span className="font-semibold text-ink">report key</span> again to create a new version.
              Use <span className="font-semibold text-ink">Latest only</span> on the dashboard to compare quickly.
            </p>
          </div>
        </aside>

        <main className="min-w-0 p-3 lg:p-5">
          <div className="mx-auto max-w-[1400px] space-y-3">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
