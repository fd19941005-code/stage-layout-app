/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages等のサブパス配信を想定し、相対パスでビルドする(NFR-015)
export default defineConfig({
  base: "./",
  plugins: [react()],
  // 既定は5173。PORTが指定された場合はそれに従い、開発サーバーを並行起動できるようにする
  server: {
    port: Number(process.env.PORT) || 5173,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
