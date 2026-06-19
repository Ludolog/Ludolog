import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup-env.ts"]
  },
  resolve: {
    alias: {
      "@capacitor/core": fileURLToPath(new URL("./tests/stubs/capacitor-core.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./packages/shared/src", import.meta.url))
    }
  }
});
