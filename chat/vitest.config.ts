import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for the deterministic logic ported from the gap-chat (grounding,
// acronym strip, etc.). Scoped to lib/**/*.unit.test.ts so it never collides
// with the Playwright e2e suite (the `test` script) or the AI-SDK mock fixtures.
export default defineConfig({
  test: {
    include: ["lib/**/*.unit.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
