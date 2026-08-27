import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@accord/governance-core": fileURLToPath(new URL("./packages/governance-core/src/index.ts", import.meta.url)),
      "@accord/governance-core/types": fileURLToPath(new URL("./packages/governance-core/src/types.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "packages/**/*.test.ts"]
  }
});
