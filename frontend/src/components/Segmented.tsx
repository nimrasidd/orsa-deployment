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
    <div className="inline-flex gap-0.5 rounded-[10px] border border-line bg-surface p-0.5 shadow-sm dark:bg-surface-3">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              "h-8 rounded-lg px-3 text-[12px] font-semibold transition",
              active
                ? "bg-surface-panel text-heading shadow-sm dark:bg-brand-900 dark:text-white"
                : "text-ink-muted hover:text-ink"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
