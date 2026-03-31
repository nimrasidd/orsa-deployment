import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Backend: backend/start_server.ps1 → uvicorn on 127.0.0.1:8000
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 15000 },
      "/auth": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 15000 },
      "/settings": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 15000 },
      "/uploads": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 60000 },
      "/mappings": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 15000 },
      "/reports": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 60000 },
      "/regions": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 15000 },
      "/countries": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 15000 },
      "/companies": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 15000 },
      "/company-models": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 15000 },
      "/models": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 15000 },
      "/debug": { target: "http://127.0.0.1:8000", changeOrigin: true, timeout: 15000 },
    },
  },
});

