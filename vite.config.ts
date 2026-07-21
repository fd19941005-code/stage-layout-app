/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";

// GitHub Pages等のサブパス配信を想定し、相対パスでビルドする(NFR-015)
export default defineConfig({
  base: "./",
  plugins: [react(), cloudflare()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});