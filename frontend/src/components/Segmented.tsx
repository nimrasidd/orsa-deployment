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
    <div className="inline-flex rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              "h-9 rounded-lg px-3 text-sm font-medium transition",
              active ? "bg-white/10 text-slate-50 ring-1 ring-white/15" : "text-slate-300 hover:bg-white/5"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

