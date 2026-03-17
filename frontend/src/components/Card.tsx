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
        "rounded-2xl bg-slate-900/40 p-5 ring-1 ring-white/10 shadow-glow backdrop-blur",
        className
      )}
      {...props}
    >
      {(title || subtitle || actions) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <div className="text-sm font-semibold text-slate-100">{title}</div>}
            {subtitle && <div className="mt-1 text-xs text-slate-400">{subtitle}</div>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

