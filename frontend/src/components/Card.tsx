import * as React from "react";
import { cn } from "../lib/cn";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
};

export function Card({ className, title, subtitle, actions, children, ...props }: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface-panel p-4 shadow-sm dark:bg-surface-2/90",
        className
      )}
      {...props}
    >
      {(title || subtitle || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
          <div className="min-w-0">
            {title && <div className="font-display text-sm font-semibold text-ink">{title}</div>}
            {subtitle && <div className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{subtitle}</div>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
