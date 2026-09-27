import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// og:image — стабильный url, не хеш бандла
const brandAssets = fileURLToPath(
  new URL("../../packages/brand/assets", import.meta.url)
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  publicDir: brandAssets,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      "/open": "http://localhost:3000",
      "/api": "http://localhost:3000",
    },
  },
});
