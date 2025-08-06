import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isDevelopment = process.env.NODE_ENV === "development";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    proxy: isDevelopment
      ? {
          "/api": {
            target: "https://test-case-gen-e98c.onrender.com",
            changeOrigin: true,
            secure: true,
            configure: (proxy, _options) => {
              proxy.on("error", (err, _req, _res) => {
                console.error("Proxy error:", err);
              });
              proxy.on("proxyReq", (proxyReq, req, _res) => {
                console.log("Sending Request to Target:", req.method, req.url);
              });
              proxy.on("proxyRes", (proxyRes, req, _res) => {
                console.log("Received Response:", proxyRes.statusCode, req.url);
              });
            },
          },
        }
      : undefined,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          utils: ["axios", "lucide-react"],
        },
      },
    },
  },
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
