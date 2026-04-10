import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Backend:
      // - Local dev (no Docker): uvicorn on 127.0.0.1:8000
      // - Docker Compose: backend service on http://backend:8000
      "/health": { target: "http://backend:8000", changeOrigin: true, timeout: 15000 },
      "/auth": { target: "http://backend:8000", changeOrigin: true, timeout: 15000 },
      "/settings": { target: "http://backend:8000", changeOrigin: true, timeout: 15000 },
      "/uploads": { target: "http://backend:8000", changeOrigin: true, timeout: 60000 },
      "/mappings": { target: "http://backend:8000", changeOrigin: true, timeout: 15000 },
      "/reports": { target: "http://backend:8000", changeOrigin: true, timeout: 60000 },
      "/regions": { target: "http://backend:8000", changeOrigin: true, timeout: 15000 },
      "/countries": { target: "http://backend:8000", changeOrigin: true, timeout: 15000 },
      "/companies": { target: "http://backend:8000", changeOrigin: true, timeout: 15000 },
      "/company-models": { target: "http://backend:8000", changeOrigin: true, timeout: 15000 },
      "/models": { target: "http://backend:8000", changeOrigin: true, timeout: 15000 },
      "/debug": { target: "http://backend:8000", changeOrigin: true, timeout: 15000 },
    },
  },
});

