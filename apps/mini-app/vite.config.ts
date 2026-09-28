import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["mark.svg"],
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,woff}"],
        navigateFallback: "/app/index.html",
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/webhook/,
          /^\/healthz/,
          /^\/open/,
        ],
      },
    }),
  ],
  base: "/app/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/healthz": "http://localhost:3000",
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": "http://localhost:3000",
      "/healthz": "http://localhost:3000",
    },
  },
});
