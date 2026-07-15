import { cn } from "../lib/cn";

export function Badge({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-surface-3 px-2 py-0.5 text-[10px] font-semibold text-ink",
        className
      )}
    >
      {children}
    </span>
  );
}
