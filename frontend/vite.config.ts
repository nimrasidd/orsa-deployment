import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Load .env, .env.local, .env.{mode}, etc. into an object.
  // (Vite does not automatically populate process.env for config usage.)
  const env = loadEnv(mode, process.cwd(), "");

  // Prefer real environment variables (e.g. from Docker Compose), then fall back to .env files.
  // Docker Compose: VITE_API_TARGET=http://backend:8000
  // Local dev: VITE_API_TARGET=http://127.0.0.1:8000
  const apiTarget = (process.env.VITE_API_TARGET || env.VITE_API_TARGET || "http://backend:8000").replace(/\/$/, "");

  // Keep the default Vite dev port unless explicitly overridden.
  const port = (process.env.VITE_PORT || env.VITE_PORT) ? Number(process.env.VITE_PORT || env.VITE_PORT) : 5173;

  const proxyTarget = {
    target: apiTarget,
    changeOrigin: true,
  } as const;

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        "/health": { ...proxyTarget, timeout: 15000 },
        "/auth": { ...proxyTarget, timeout: 15000 },
        "/access-request": { ...proxyTarget, timeout: 15000 },
        "/settings": { ...proxyTarget, timeout: 15000 },
        "/uploads": { ...proxyTarget, timeout: 60000 },
        // Mapping uploads can involve large Excel parsing + many inserts; allow longer.
        "/mappings": { ...proxyTarget, timeout: 120000 },
        "/reports": { ...proxyTarget, timeout: 60000 },
        "/regions": { ...proxyTarget, timeout: 15000 },
        "/countries": { ...proxyTarget, timeout: 15000 },
        "/companies": { ...proxyTarget, timeout: 15000 },
        "/company-models": { ...proxyTarget, timeout: 15000 },
        "/models": { ...proxyTarget, timeout: 15000 },
        "/debug": { ...proxyTarget, timeout: 15000 },
      },
    },
  };
});

