import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 患者系统前端 —— 独立端口 3005，独立入口 patient/index.html
export default defineConfig({
  root: "patient",
  plugins: [react()],
  cacheDir: "node_modules/.vite-patient",
  server: {
    host: "0.0.0.0",
    port: 3005,
    strictPort: true,
    fs: { allow: [".."] },
    proxy: {
      "/api": {
        target: "http://localhost:18001",
        changeOrigin: true,
      },
    },
  },
});
