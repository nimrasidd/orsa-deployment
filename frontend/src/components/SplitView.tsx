import * as React from "react";
import { cn } from "../lib/cn";

export function SplitView({
  left,
  right,
  initialLeftPx = 640,
  minLeftPx = 360,
  minRightPx = 320
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftPx?: number;
  minLeftPx?: number;
  minRightPx?: number;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [leftPx, setLeftPx] = React.useState(initialLeftPx);
  const drag = React.useRef<{ startX: number; startLeft: number } | null>(null);

  // Clamp leftPx when window/container resizes
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const total = el.getBoundingClientRect().width;
      setLeftPx((prev) => Math.max(minLeftPx, Math.min(prev, total - minRightPx)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [minLeftPx, minRightPx]);

  function onMouseDown(e: React.MouseEvent) {
    drag.current = { startX: e.clientX, startLeft: leftPx };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  React.useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!drag.current) return;
      const root = ref.current;
      if (!root) return;
      const total = root.getBoundingClientRect().width;
      const next = drag.current.startLeft + (e.clientX - drag.current.startX);
      const clamped = Math.max(minLeftPx, Math.min(next, total - minRightPx));
      setLeftPx(clamped);
    }
    function onUp() {
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [leftPx, minLeftPx, minRightPx]);

  return (
    <div
      ref={ref}
      className="grid min-h-[min(400px,50vh)] h-[calc(100dvh-180px)] max-h-[calc(100dvh-100px)] grid-cols-1 gap-3 lg:grid-cols-[auto_12px_1fr]"
    >
      <div className="min-h-0 min-w-0 overflow-hidden" style={{ width: leftPx }}>
        {left}
      </div>
      <div className="hidden lg:flex items-stretch justify-center">
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={onMouseDown}
          className={cn(
            "group flex w-3 cursor-col-resize items-stretch justify-center rounded-xl",
            "hover:bg-white/5"
          )}
        >
          <div className="my-2 w-px bg-white/10 group-hover:bg-white/20" />
        </div>
      </div>
      <div className="min-h-0 min-w-0 overflow-hidden">{right}</div>
    </div>
  );
}

