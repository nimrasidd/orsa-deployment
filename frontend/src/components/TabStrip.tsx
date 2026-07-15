import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { useWorkspace } from "../workspace/tabs";

export function TabStrip() {
  const { state, activate, close } = useWorkspace();

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-surface-panel/80 p-1 ring-1 ring-line backdrop-blur dark:bg-slate-900/50 dark:ring-white/10">
      {state.tabs.map((t) => {
        const active = state.activeId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => activate(t.id)}
            className={cn(
              "group flex min-w-[160px] max-w-[280px] items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
              active
                ? "bg-surface-3 text-ink ring-1 ring-line dark:bg-white/10 dark:text-slate-50 dark:ring-white/15"
                : "text-ink-muted hover:bg-surface-3 hover:text-ink dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-slate-100"
            )}
          >
            <span className="min-w-0 truncate font-medium">{t.title}</span>
            {!t.pinned ? (
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-lg text-ink-soft transition hover:bg-surface-2 hover:text-ink dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  close(t.id);
                }}
                aria-label="Close tab"
              >
                <X className="h-4 w-4" />
              </span>
            ) : (
              <span className="h-6 w-6" />
            )}
          </button>
        );
      })}
    </div>
  );
}
