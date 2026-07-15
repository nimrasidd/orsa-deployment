import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { cn } from "../lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
        "bg-surface-2 text-ink-muted ring-1 ring-line hover:bg-surface-3 hover:text-ink",
        className
      )}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}
