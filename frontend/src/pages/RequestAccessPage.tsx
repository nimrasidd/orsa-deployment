import * as React from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/http";
import { submitAccessRequest } from "../api/accessRequest";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { OrsaBrandHeader, PublicPageShell } from "../components/PublicPageShell";
import { toast } from "sonner";

export function RequestAccessPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [organization, setOrganization] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !organization.trim()) {
      toast.error("Please fill in name, email, and organization.");
      return;
    }
    setLoading(true);
    try {
      await submitAccessRequest({
        name: name.trim(),
        email: email.trim(),
        organization: organization.trim(),
        message: message.trim(),
        website,
      });
      toast.success("Request sent. We will contact you by email.");
      setName("");
      setEmail("");
      setOrganization("");
      setMessage("");
      setWebsite("");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const d = err.detail;
        const msg =
          typeof d === "string"
            ? d
            : Array.isArray(d)
              ? d
                  .map((x) =>
                    typeof x === "object" && x && "msg" in x ? String((x as { msg: unknown }).msg) : String(x)
                  )
                  .join("; ")
              : err.message;
        toast.error(msg || "Request failed");
      } else {
        toast.error("Request failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicPageShell maxWidthClass="max-w-sm">
      <div className="glass-panel p-8">
        <OrsaBrandHeader />
        <h1 className="mb-2 text-sm font-semibold text-ink">Request access</h1>
        <p className="mb-6 text-xs leading-relaxed text-ink-muted">
          Tell us who you are and which organization you represent. We will reply to the email you provide.
        </p>
        <form onSubmit={handleSubmit} className="relative space-y-4">
          <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0" aria-hidden="true">
            <label htmlFor="access-website">Website</label>
            <input
              id="access-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-ink-muted">Name</label>
            <Input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-ink-muted">Email</label>
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-ink-muted">Organization</label>
            <Input
              type="text"
              placeholder="Company or team"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              autoComplete="organization"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-ink-muted">Message (optional)</label>
            <textarea
              placeholder="Anything we should know?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink ring-1 ring-line placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:bg-white/5"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send request"}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-ink-soft">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-700 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300">
            Sign in
          </Link>
        </p>
      </div>
    </PublicPageShell>
  );
}
