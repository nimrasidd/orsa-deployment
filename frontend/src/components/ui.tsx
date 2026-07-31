import { cn } from "../lib/cn";

/** Shared form control (select/input/textarea) for readable light+dark UIs. */
export const formControlClass =
  "h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-ink shadow-sm outline-none transition placeholder:text-ink-soft focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-55";

export const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink";

/** Page / card section titles — SHMA mock deep green */
export const headingClass = "font-display font-bold tracking-tight text-heading";

export const tableWrapClass =
  "overflow-auto rounded-xl border border-line bg-surface-panel [scrollbar-gutter:stable] [scrollbar-width:thin]";

export const tableClass = "w-full min-w-[36rem] text-left text-[13px]";

/** Dark-green sticky header (Dashboard mock) */
export const theadClass =
  "sticky top-0 z-[1] bg-brand-900 text-[11.5px] font-semibold uppercase tracking-[0.03em] text-[#EAF6EF]";

export const thClass = "px-4 py-2.5 font-semibold";

export const trClass = "border-t border-line transition even:bg-surface hover:bg-brand-100/80 dark:even:bg-surface-3/30 dark:hover:bg-brand-900/30";

export const tdClass = "px-4 py-2.5 text-ink";

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-gradient-to-br from-brand-600/10 via-surface-panel to-surface-panel p-4 shadow-sm dark:from-brand-500/15 dark:via-surface-panel/80 dark:to-surface-2",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className={cn(headingClass, "text-xl sm:text-2xl")}>{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
