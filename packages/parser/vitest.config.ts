import { defineConfig } from "vitest/config";

const shouldSilenceConsole = process.env.VITEST === "true";

export default defineConfig({
  test: {
    globals: true,
    silent: "passed-only",
    testTimeout: 15_000,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/*.pro.test.ts",
    ],
    onConsoleLog() {
      if (shouldSilenceConsole) {
        return false;
      }
      return undefined;
    },
  },
});
