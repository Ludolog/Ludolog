import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const mobileRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(mobileRoot, "..");

export default defineConfig({
  root: mobileRoot,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(mobileRoot, "src"),
      "@shared": path.resolve(repoRoot, "packages/shared/src")
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [mobileRoot, path.resolve(repoRoot, "packages/shared")]
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
