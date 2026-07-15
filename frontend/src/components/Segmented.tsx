import { cn } from "../lib/cn";

export type Segment<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  value,
  onChange,
  items
}: {
  value: T;
  onChange: (v: T) => void;
  items: Segment<T>[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-3 p-0.5 shadow-sm">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              "h-8 rounded-md px-3 text-[12px] font-semibold transition",
              active
                ? "bg-brand-700 text-white shadow-sm dark:bg-brand-500 dark:text-slate-950"
                : "text-ink-muted hover:bg-surface-2 hover:text-ink"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
