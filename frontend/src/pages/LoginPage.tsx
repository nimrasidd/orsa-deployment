import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { register as apiRegister } from "../api/auth";
import { listCompanies } from "../api/regions";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { OrsaBrandHeader, PublicPageShell } from "../components/PublicPageShell";
import { toast } from "sonner";

const showDemoCredentials =
  import.meta.env.DEV ||
  String(import.meta.env.VITE_SHOW_DEMO_CREDENTIALS ?? "").toLowerCase() === "true";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [companies, setCompanies] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (mode === "register") {
      listCompanies().then(setCompanies).catch(() => setCompanies([]));
    }
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter email and password");
      return;
    }
    if (mode === "register") {
      if (!name.trim()) {
        toast.error("Please enter your name");
        return;
      }
      if (!companyId) {
        toast.error("Please select a company");
        return;
      }
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        toast.success("Logged in successfully");
        navigate("/", { replace: true });
      } else {
        await apiRegister({
          email: email.trim(),
          password,
          name: name.trim(),
          company_id: companyId,
        });
        toast.success("Account created. Please sign in.");
        setMode("login");
        setPassword("");
        setName("");
        setCompanyId("");
      }
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "detail" in err ? String((err as { detail: unknown }).detail) : "Request failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicPageShell maxWidthClass="max-w-sm">
      <div className="rounded-2xl bg-slate-900/60 p-8 ring-1 ring-white/10">
        <OrsaBrandHeader />
        <h1 className="mb-6 text-sm font-semibold text-slate-200">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Name</label>
              <Input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Email</label>
            <Input
              type="email"
              placeholder="admin@sir.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full"
            />
            {mode === "register" && <p className="mt-1 text-xs text-slate-500">At least 6 characters</p>}
          </div>
          {mode === "register" && (
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Company</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="h-10 w-full rounded-lg bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-white/10"
              >
                <option value="">Select company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (mode === "login" ? "Signing in…" : "Creating…") : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 w-full text-center text-xs text-sky-400 hover:text-sky-300"
        >
          {mode === "login" ? "Create an account" : "Already have an account? Sign in"}
        </button>
        {mode === "login" && showDemoCredentials && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Admin: admin@sir.com · Company user: company@demo.com — password123
          </p>
        )}
      </div>
    </PublicPageShell>
  );
}
