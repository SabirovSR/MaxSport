import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Brand art is served from stable root URLs rather than hashed bundle paths,
// because og:image has to be an absolute URL a social scraper can resolve.
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
