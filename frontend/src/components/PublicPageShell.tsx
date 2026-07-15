import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";

export function OrsaBrandHeader() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <BrandLogo size="md" gloss />
      <div>
        <div className="font-display text-sm font-semibold text-ink">Solvency Dashboard</div>
        <div className="text-[11px] text-ink-muted">Own Risk and Solvency Assessment</div>
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
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Link to="/login" className="text-xs text-ink-muted hover:text-ink">
          Sign in
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/request-access" className="text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300">
            Request access
          </Link>
        </div>
      </header>
      <main className="relative flex flex-1 flex-col items-center justify-center p-6">
        <div className={cn("w-full", maxWidthClass)}>{children}</div>
      </main>
    </div>
  );
}
