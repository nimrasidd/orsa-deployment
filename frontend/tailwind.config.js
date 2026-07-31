/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Sora"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Manrope"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#E4F5EC",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#1FA97A",
          600: "#12905F",
          700: "#0E7A54",
          800: "#0B4D36",
          900: "#0B4D36",
          950: "#032616",
        },
        heading: "rgb(var(--heading) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--ink-muted) / <alpha-value>)",
        "ink-soft": "rgb(var(--ink-soft) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        "surface-panel": "rgb(var(--surface-panel) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(148,163,184,.15), 0 24px 80px rgba(2,6,23,.75)",
        brandGlow: "0 0 0 1px rgba(52,211,153,.12), 0 20px 80px rgba(2,6,23,.72)",
        glass: "0 10px 40px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.55)",
        glassDark: "0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      keyframes: {
        "logo-shine": {
          "0%": { transform: "translateX(-120%) skewX(-18deg)" },
          "100%": { transform: "translateX(220%) skewX(-18deg)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "logo-shine": "logo-shine 3.8s ease-in-out infinite",
        floaty: "floaty 6s ease-in-out infinite",
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};
