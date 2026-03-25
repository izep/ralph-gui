import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const projectRoot = path.resolve(import.meta.dirname, "..");

export default defineConfig({
  plugins: [react()],
  test: {
    root: projectRoot,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/index.ts", "src/client/main.tsx", "src/client/vite-env.d.ts"],
    },
  },
});
