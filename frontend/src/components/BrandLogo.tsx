import * as React from "react";
import { cn } from "../lib/cn";

type Props = {
  className?: string;
  imgClassName?: string;
  gloss?: boolean;
  size?: "sm" | "md" | "lg" | "hero";
  /** Show icon only (no SHMA wordmark). */
  iconOnly?: boolean;
};

const sizeMap = {
  sm: "h-7",
  md: "h-9",
  lg: "h-11",
  hero: "h-14 sm:h-16",
} as const;

/**
 * Fully coded SHMA brand (SVG). Deep-green interlocking ribbon + geometric wordmark.
 */
export function BrandLogo({
  className,
  imgClassName,
  gloss = false,
  size = "md",
  iconOnly = false,
}: Props) {
  const uid = React.useId().replace(/:/g, "");

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        gloss && "logo-gloss",
        className
      )}
      role="img"
      aria-label="SHMA"
    >
      {gloss ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-8 rounded-full bg-emerald-900/30 blur-3xl dark:bg-emerald-800/35"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 -bottom-4 h-8 rounded-full bg-emerald-950/35 blur-xl dark:bg-emerald-900/40"
          />
        </>
      ) : null}

      <svg
        viewBox={iconOnly ? "0 0 100 80" : "0 0 360 80"}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "relative z-[1] w-auto",
          sizeMap[size],
          "drop-shadow-[0_14px_28px_rgba(6,78,40,0.45)]",
          imgClassName
        )}
      >
        <defs>
          <linearGradient id={`lit-${uid}`} x1="4" y1="4" x2="96" y2="76" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1FA34A" />
            <stop offset="40%" stopColor="#0F7A34" />
            <stop offset="100%" stopColor="#085028" />
          </linearGradient>
          <linearGradient id={`mid-${uid}`} x1="20" y1="12" x2="80" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0D6B2E" />
            <stop offset="100%" stopColor="#04391A" />
          </linearGradient>
          <linearGradient id={`shade-${uid}`} x1="16" y1="16" x2="84" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#085028" />
            <stop offset="100%" stopColor="#021F10" />
          </linearGradient>
          <linearGradient id={`gloss-${uid}`} x1="8" y1="8" x2="52" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.38" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g>
          <path d="M6 40 L30 8 L54 32 L42 40 L54 48 L30 72 Z" fill={`url(#lit-${uid})`} />
          <path d="M30 8 L54 32 L44 40 L34 28 Z" fill={`url(#shade-${uid})`} />
          <path d="M30 72 L54 48 L44 40 L34 52 Z" fill={`url(#mid-${uid})`} />

          <path d="M40 30 L60 30 L68 40 L60 50 L40 50 L32 40 Z" fill={`url(#mid-${uid})`} />
          <path d="M40 30 L60 30 L56 40 L38 40 Z" fill={`url(#shade-${uid})`} opacity="0.85" />

          <path d="M46 32 L70 8 L94 40 L70 72 L46 48 L58 40 Z" fill={`url(#lit-${uid})`} />
          <path d="M70 8 L94 40 L80 40 L58 32 Z" fill={`url(#shade-${uid})`} />
          <path d="M70 72 L94 40 L80 40 L58 48 Z" fill={`url(#mid-${uid})`} />

          <path d="M42 34 L56 40 L42 46 L38 40 Z" fill={`url(#lit-${uid})`} />
          <path d="M12 34 L30 16 L36 30 L20 42 Z" fill={`url(#gloss-${uid})`} />
          <path d="M62 24 L78 14 L86 32 L70 36 Z" fill={`url(#gloss-${uid})`} opacity="0.65" />
        </g>

        {!iconOnly ? (
          <g fill="currentColor" className="text-[#1A1A1A] dark:text-slate-100">
            <path d="M118 24c0-7.5 6.2-13 15.8-13 7.4 0 13.2 2.8 16.2 7.4l-8.2 5.4c-1.6-2.4-4.4-3.8-8-3.8-3.6 0-6 1.6-6 4 0 2.4 1.8 3.8 7.2 5.4l4.6 1.4c9.2 2.8 14 8 14 16.2 0 9.6-7.4 16-18.4 16-9 0-15.8-3.4-19.2-9.2l8.6-5.4c2 3.2 5.6 5.2 10.4 5.2 4.2 0 6.8-1.8 6.8-4.6 0-2.6-1.8-4-7.6-5.8l-4.4-1.4C123.2 40.2 118 35 118 24Z" />
            <path d="M160 12h11.5v22.5h18V12H201v56h-11.5V45.5h-18V68H160V12Z" />
            <path d="M214 68V12h13.2l14.4 28.8L256 12h13.2v56h-11.2V31.2L245.2 54h-5.6l-12.6-22.8V68H214Z" />
            <path d="M282 68 L304 12 L326 68 H312.5 L304 42 L295.5 68 Z" />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
