import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type WorkspaceTab = {
  id: string;
  path: string;
  title: string;
  pinned?: boolean;
};

type WorkspaceState = {
  tabs: WorkspaceTab[];
  activeId: string | null;
};

type Ctx = {
  state: WorkspaceState;
  openOrActivate: (tab: Omit<WorkspaceTab, "id"> & { id?: string }) => void;
  close: (id: string) => void;
  activate: (id: string) => void;
  rename: (id: string, title: string) => void;
};

const WorkspaceContext = React.createContext<Ctx | null>(null);

function keyFromPath(path: string) {
  // stable key per route
  return path;
}

function defaultTitleForPath(path: string) {
  if (path === "/") return "Dashboard";
  if (path === "/reports") return "Reports";
  if (path === "/upload") return "Upload";
  if (path === "/mappings") return "Mappings";
  if (path === "/models") return "Models";
  if (path === "/settings") return "Settings";
  if (path.startsWith("/uploads/")) return "Report";
  if (path.startsWith("/compare/")) return "Compare";
  return "Tab";
}

const STORAGE_KEY = "osra.workspace.v1";

function loadState(): WorkspaceState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceState;
    if (!parsed?.tabs?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveState(state: WorkspaceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();

  const [state, setState] = React.useState<WorkspaceState>(() => {
    const loaded = loadState();
    if (loaded) return loaded;
    const initial: WorkspaceState = {
      tabs: [
        { id: keyFromPath("/"), path: "/", title: "Dashboard", pinned: true },
        { id: keyFromPath("/upload"), path: "/upload", title: "Upload", pinned: false }
      ],
      activeId: keyFromPath("/")
    };
    return initial;
  });

  /** Stable callback: avoids infinite loops when consumers put `rename` in useEffect deps. */
  const rename = React.useCallback((id: string, title: string) => {
    setState((prev) => {
      const cur = prev.tabs.find((t) => t.id === id);
      if (cur?.title === title) return prev;
      const nextTabs = prev.tabs.map((t) => (t.id === id ? { ...t, title } : t));
      const next: WorkspaceState = { ...prev, tabs: nextTabs };
      saveState(next);
      return next;
    });
  }, []);

  // Keep URL and active tab in sync
  React.useEffect(() => {
    const id = keyFromPath(loc.pathname);
    setState((prev) => {
      const existing = prev.tabs.find((t) => t.id === id);
      if (existing) {
        const next = { ...prev, activeId: id };
        saveState(next);
        return next;
      }
      const nextTab: WorkspaceTab = {
        id,
        path: loc.pathname,
        title: defaultTitleForPath(loc.pathname)
      };
      const next: WorkspaceState = {
        tabs: [...prev.tabs, nextTab],
        activeId: id
      };
      saveState(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);

  const api = React.useMemo<Ctx>(() => {
    return {
      state,
      openOrActivate: (tab) => {
        const path = tab.path;
        const id = tab.id ?? keyFromPath(path);
        setState((prev) => {
          const existing = prev.tabs.find((t) => t.id === id);
          const nextTabs = existing
            ? prev.tabs.map((t) => (t.id === id ? { ...t, ...tab, id } : t))
            : [...prev.tabs, { ...tab, id, title: tab.title || defaultTitleForPath(path) }];
          const next: WorkspaceState = { tabs: nextTabs, activeId: id };
          saveState(next);
          return next;
        });
        nav(path);
      },
      close: (id) => {
        setState((prev) => {
          const closing = prev.tabs.find((t) => t.id === id);
          if (!closing || closing.pinned) return prev;
          const remaining = prev.tabs.filter((t) => t.id !== id);
          let nextActive = prev.activeId;
          if (prev.activeId === id) {
            nextActive = remaining[remaining.length - 1]?.id ?? remaining[0]?.id ?? null;
          }
          const next: WorkspaceState = { tabs: remaining, activeId: nextActive };
          saveState(next);
          return next;
        });
      },
      activate: (id) => {
        const t = state.tabs.find((x) => x.id === id);
        if (!t) return;
        setState((prev) => {
          const next: WorkspaceState = { ...prev, activeId: id };
          saveState(next);
          return next;
        });
        nav(t.path);
      },
      rename
    };
  }, [nav, state, loc.pathname, rename]);

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

