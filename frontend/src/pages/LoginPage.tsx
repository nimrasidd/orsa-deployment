import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  GitCompare,
  Layers,
  Lock,
  Mail,
  Upload,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { ThemeToggle } from "../components/ThemeToggle";
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
    <div className="relative min-h-screen overflow-hidden bg-surface text-ink">
      {/* Green ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-500/8 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-emerald-600/6 blur-3xl dark:bg-emerald-600/8" />
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-brand-500/5 blur-3xl dark:bg-brand-500/8" />
      </div>

      <header className="relative flex items-center justify-between border-b border-line/60 px-6 py-4">
        <div className="font-display text-sm font-semibold tracking-[0.18em] text-ink/80">
          SOLVENCY
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            to="/request-access"
            className="rounded-lg bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-800 ring-1 ring-emerald-500/25 transition hover:bg-emerald-500/15 hover:ring-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25"
          >
            Request access
          </Link>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:px-10 lg:py-14">
        {/* Brand hero */}
        <section className="flex min-h-[52vh] flex-col justify-center space-y-8 lg:min-h-[70vh]">
          <div className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
            <BrandLogo size="lg" className="mx-auto lg:mx-0" />
            <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
              Solvency Dashboard
            </h1>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-ink-muted lg:mx-0">
              Own Risk and Solvency Assessment — upload, map, explore, and compare
              regulatory reports in one workspace.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description }) => (
              <li
                key={title}
                className="rounded-xl border border-emerald-500/15 bg-surface-panel p-4 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-400/30 hover:shadow-md dark:border-emerald-500/10 dark:bg-surface-2/90 dark:hover:border-emerald-400/25"
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/12 ring-1 ring-emerald-500/20">
                  <Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                </div>
                <h2 className="text-[13px] font-medium text-ink">{title}</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{description}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Sign in */}
        <section className="flex flex-col justify-center lg:justify-self-center lg:w-full lg:max-w-md">
          <div className="rounded-2xl border border-emerald-500/15 bg-surface-panel p-8 shadow-lg shadow-emerald-500/5 dark:border-emerald-500/10 dark:bg-surface-2/90 dark:shadow-emerald-900/20">
            <div className="mb-5 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Lock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Secure sign in</span>
            </div>
            <h2 className="font-display text-lg font-semibold text-ink">Welcome back</h2>
            <p className="mt-1 text-[13px] text-ink-muted">Enter your credentials to open the dashboard.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-ink-muted">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
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
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-ink-muted">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
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
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500" disabled={loading}>
                {loading ? "Signing in…" : "Sign in to dashboard"}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-ink-soft">
              New here?{" "}
              <Link
                to="/request-access"
                className="font-medium text-emerald-700 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                Request access
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
