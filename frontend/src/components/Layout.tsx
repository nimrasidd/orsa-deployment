import { BarChart3, Cpu, FileUp, FileText, LayoutDashboard, LogOut, MapPin, Settings, Shield } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "../lib/cn";
import { useAuth } from "../auth/AuthContext";

const navBase = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/upload", label: "Upload Excel", icon: FileUp },
  { to: "/mappings", label: "Mappings", icon: MapPin },
  { to: "/models", label: "Models", icon: Cpu },
];
const navSettings = { to: "/settings", label: "Settings", icon: Settings };

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -bottom-56 right-[-120px] h-[520px] w-[520px] rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative grid min-h-dvh grid-cols-1 lg:grid-cols-[296px_1fr]">
        <aside className="border-b border-white/10 bg-slate-950/40 p-5 backdrop-blur lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500/20 ring-1 ring-sky-400/30">
              <Shield className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-slate-100">ORSA</div>
              <div className="text-xs text-slate-400">Own Risk And Solvency Assessment</div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {user && (
              <div className="mb-2 rounded-xl bg-white/5 px-3 py-2 text-xs">
                <div className="font-medium text-slate-200">{user.name}</div>
                <div className="text-slate-500">{user.company_name ?? user.email}</div>
                <button
                  type="button"
                  onClick={() => { logout(); navigate("/login"); }}
                  className="mt-2 flex items-center gap-2 text-slate-400 hover:text-slate-200"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            )}
            {(user?.is_admin ? [...navBase, navSettings] : navBase).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm ring-1 ring-transparent transition",
                      isActive
                        ? "bg-sky-500/15 text-slate-50 ring-sky-400/25"
                        : "text-slate-300 hover:bg-white/5 hover:text-slate-100"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
              <BarChart3 className="h-4 w-4 text-sky-300" />
              Tip
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Upload the same <span className="text-slate-200">report key</span> again to create a new version.
              Use <span className="text-slate-200">Latest only</span> on the dashboard to compare versions quickly.
            </p>
          </div>
        </aside>

        <main className="min-w-0 p-5 lg:p-6">
          <div className="mx-auto max-w-[1400px]">
            <div className="rounded-2xl bg-slate-900/30 p-4 ring-1 ring-white/10 shadow-glow backdrop-blur">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

