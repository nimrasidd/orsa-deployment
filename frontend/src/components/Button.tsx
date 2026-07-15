import * as React from "react";
import { cn } from "../lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-55",
        size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]",
        variant === "primary" &&
          "bg-brand-700 text-white shadow-[0_10px_24px_rgba(8,80,40,0.28)] hover:bg-brand-600 dark:bg-brand-500 dark:text-slate-950 dark:hover:bg-brand-400",
        variant === "ghost" &&
          "border border-line bg-surface-2 text-ink hover:border-brand-500/30 hover:bg-brand-500/10",
        variant === "danger" &&
          "bg-rose-600 text-white shadow-[0_10px_24px_rgba(225,29,72,0.22)] hover:bg-rose-500",
        className
      )}
      {...props}
    />
  );
}
