import * as React from "react";
import { cn } from "../lib/cn";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-ink shadow-sm outline-none transition placeholder:text-ink-soft focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/25",
        className
      )}
      {...props}
    />
  );
}
