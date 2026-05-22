import * as React from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { cn } from "../lib/cn";

export function OrsaBrandHeader() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-500/20 ring-1 ring-sky-400/30">
        <Shield className="h-6 w-6 text-sky-300" />
      </div>
      <div>
        <div className="text-lg font-semibold text-slate-100">Solvency Dashboard</div>
        <div className="text-xs text-slate-400">Own Risk and Solvency Assessment</div>
      </div>
    </div>
  );
}

type PublicPageShellProps = {
  children: React.ReactNode;
  maxWidthClass?: string;
};

export function PublicPageShell({ children, maxWidthClass = "max-w-lg" }: PublicPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <Link to="/login" className="text-xs text-slate-400 hover:text-slate-200">
          Sign in
        </Link>
        <Link to="/request-access" className="text-xs text-sky-400 hover:text-sky-300">
          Request access
        </Link>
      </header>
      <main className="relative flex flex-1 flex-col items-center justify-center p-6">
        <div className={cn("w-full", maxWidthClass)}>{children}</div>
      </main>
    </div>
  );
}
