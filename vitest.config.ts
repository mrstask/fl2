import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globals: true,
    passWithNoTests: false,
    api: {
      host: "127.0.0.1",
    },
  },
});
