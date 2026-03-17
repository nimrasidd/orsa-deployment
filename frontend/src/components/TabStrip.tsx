import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { useWorkspace } from "../workspace/tabs";

export function TabStrip() {
  const { state, activate, close } = useWorkspace();

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-slate-900/50 p-1 ring-1 ring-white/10 backdrop-blur">
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
                ? "bg-white/10 text-slate-50 ring-1 ring-white/15"
                : "text-slate-300 hover:bg-white/5 hover:text-slate-100"
            )}
          >
            <span className="min-w-0 truncate font-medium">{t.title}</span>
            {!t.pinned ? (
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-slate-100",
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

