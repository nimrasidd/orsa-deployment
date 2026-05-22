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
      <div className="rounded-2xl bg-slate-900/60 p-8 ring-1 ring-white/10">
        <OrsaBrandHeader />
        <h1 className="mb-2 text-sm font-semibold text-slate-200">Request access</h1>
        <p className="mb-6 text-xs leading-relaxed text-slate-500">
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
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Email</label>
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
            <label className="mb-1.5 block text-xs text-slate-400">Organization</label>
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
            <label className="mb-1.5 block text-xs text-slate-400">Message (optional)</label>
            <textarea
              placeholder="Anything we should know?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-sky-500/50"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send request"}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="text-sky-400 hover:text-sky-300">
            Sign in
          </Link>
        </p>
      </div>
    </PublicPageShell>
  );
}
