import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3051,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:18001",
        changeOrigin: true,
      },
    },
  },
  cacheDir: "node_modules/.vite",
  preview: {
    host: "0.0.0.0",
    port: 3051,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:18001",
        changeOrigin: true,
      },
    },
  },
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("antd") || id.includes("@ant-design")) return "antd";
            if (id.includes("react")) return "vendor";
          }
        },
      },
    },
  },
});