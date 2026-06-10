import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["services/**/*.ts", "validations/**/*.ts", "utils/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
});
