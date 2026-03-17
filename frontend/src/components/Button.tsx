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
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:opacity-60 disabled:pointer-events-none",
        size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4 text-sm",
        variant === "primary" &&
          "bg-sky-500 text-slate-950 shadow-[0_10px_30px_rgba(14,165,233,.28)] hover:bg-sky-400",
        variant === "ghost" &&
          "bg-white/5 text-slate-100 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/15",
        variant === "danger" &&
          "bg-rose-500 text-slate-950 shadow-[0_10px_30px_rgba(244,63,94,.25)] hover:bg-rose-400",
        className
      )}
      {...props}
    />
  );
}

