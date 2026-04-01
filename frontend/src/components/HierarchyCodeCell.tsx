import { cn } from "../lib/cn";

type Props = {
  /** Used for accessibility labels and as display text when `displayText` is omitted. */
  code: string;
  displayText?: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
  textClassName?: string;
};

export function HierarchyCodeCell({
  code,
  displayText,
  depth,
  hasChildren,
  isExpanded,
  onToggle,
  className,
  textClassName
}: Props) {
  const label = displayText ?? code;
  return (
    <div className={cn("flex items-start gap-1", className)} style={{ paddingLeft: `${depth * 0.75}rem` }}>
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `Collapse ${code}` : `Expand ${code}`}
        >
          <span className="text-[10px]" aria-hidden>
            {isExpanded ? "▼" : "▶"}
          </span>
        </button>
      ) : (
        <span className="inline-flex h-6 w-6 shrink-0" aria-hidden />
      )}
      <span className={cn("pt-0.5", textClassName)}>{label}</span>
    </div>
  );
}
