import { cn } from "../lib/cn";

type Props = {
  className?: string;
  spot: { x: number; y: number };
};

/** Gloss field + soft shapes for login. Spot follows cursor from parent. */
export function LoginBackdrop({ className, spot }: Props) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="absolute inset-0 login-sheen" />

      <div
        className="login-spotlight absolute inset-0 transition-[background] duration-150 ease-out"
        style={
          {
            "--spot-x": `${spot.x}%`,
            "--spot-y": `${spot.y}%`,
          } as React.CSSProperties
        }
      />

      <div className="login-grid absolute inset-0 opacity-35 dark:opacity-22" />

      <div className="login-shape login-shape-a absolute left-[12%] top-[22%] h-36 w-36 opacity-35 sm:h-44 sm:w-44" />
      <div className="login-shape login-shape-d absolute right-[12%] bottom-[20%] h-32 w-32 opacity-30 sm:h-40 sm:w-40" />

      <div className="login-gloss-bar absolute left-[-20%] top-[12%] h-24 w-[70%] rotate-[-18deg]" />
      <div className="login-gloss-bar login-gloss-bar-delay absolute right-[-15%] bottom-[18%] h-20 w-[55%] rotate-[14deg]" />
    </div>
  );
}
