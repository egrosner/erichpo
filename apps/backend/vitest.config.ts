import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.spec.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  plugins: [
    swc.vite({
      module: { type: "es6" },
    }),
  ],
});
