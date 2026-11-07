import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // its package.json main points at a missing node.js
      "string-sanitizer": fileURLToPath(
        new URL("./node_modules/string-sanitizer/index.js", import.meta.url)
      ),
    },
  },
  test: {
    include: ["server/**/*.test.ts"],
  },
});
