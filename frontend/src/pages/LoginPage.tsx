import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  GitCompare,
  Layers,
  Lock,
  Mail,
  Shield,
  Upload,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { toast } from "sonner";

const features = [
  {
    icon: Upload,
    title: "Structured uploads",
    description: "Import Excel reports with region, country, and model context.",
  },
  {
    icon: Layers,
    title: "Mapping-driven extraction",
    description: "Pull values from the right sheet and cell using active mappings.",
  },
  {
    icon: BarChart3,
    title: "Hierarchical views",
    description: "Browse regulatory trees, search codes, and inspect node details.",
  },
  {
    icon: GitCompare,
    title: "Version comparison",
    description: "Compare report versions side by side across reporting periods.",
  },
] as const;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success("Welcome back");
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: unknown }).detail)
          : "Sign in failed. Check your credentials and try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_-10%,rgba(14,165,233,0.18),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(99,102,241,0.12),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:48px_48px]"
        aria-hidden
      />

      <header className="relative z-10 flex items-center justify-end border-b border-white/5 px-6 py-4 backdrop-blur-sm">
        <Link
          to="/request-access"
          className="rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-sky-300 ring-1 ring-sky-400/20 transition hover:bg-sky-500/10 hover:ring-sky-400/40"
        >
          Request access
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl flex-1 gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-10 lg:py-16">
        {/* About — main landing content */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-500/30 to-indigo-500/20 ring-1 ring-sky-400/30 shadow-lg shadow-sky-950/50">
              <Shield className="h-7 w-7 text-sky-300" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400/90">
                Regulatory reporting
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Solvency Dashboard
              </h1>
              <p className="mt-0.5 text-sm text-slate-400">Own Risk and Solvency Assessment</p>
            </div>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-slate-400">
            <p className="text-base text-slate-300">
              A unified workspace for teams who manage Excel-based solvency and regulatory reports — from mapping
              configuration through upload, hierarchy exploration, and version comparison.
            </p>
            <p>
              Define which sheet and cell hold each report item, upload period files against your active mapping, and
              work with structured trees filtered by region, country, model, and reporting period.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description }) => (
              <li
                key={title}
                className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.05] hover:ring-white/15"
              >
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/20">
                  <Icon className="h-4 w-4 text-sky-300" />
                </div>
                <h2 className="text-sm font-medium text-slate-200">{title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-500">
            New to the platform?{" "}
            <Link to="/request-access" className="font-medium text-sky-400 hover:text-sky-300">
              Request access
            </Link>{" "}
            and our team will reach out by email.
          </p>
        </section>

        {/* Sign in */}
        <section className="flex flex-col justify-center lg:justify-self-center lg:w-full lg:max-w-md">
          <div className="rounded-2xl bg-slate-900/70 p-8 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-md">
            <div className="mb-6 flex items-center justify-center gap-2 text-sky-400/90">
              <Lock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Secure sign in</span>
            </div>
            <h2 className="text-xl font-semibold text-white">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Enter your credentials to open the dashboard.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full pl-10"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full pl-10"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in to dashboard"}
              </Button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
