import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// During `npm run dev` Vite serves on :5173 and proxies /api to the FastAPI
// backend on :8100. In production FastAPI serves the built bundle (same origin).
export default defineConfig({
  plugins: [react(), {
    name: "facilitator-static-fallback",
    transformIndexHtml(html) {
      return html.replace("<!-- FACILITATOR_FALLBACK -->", () =>
        '<nav aria-label="App view"><a href="./#community">Community Workshop</a> · <a href="./facilitator.html">Facilitator guide</a> · <a href="./#game">Game</a> · <a href="./#developer">Developer</a></nav><main class="facilitator-guide">' +
        readFileSync(resolve(__dirname, "src/facilitator-guide.html"), "utf8") + '</main>');
    },
  }],
  server: {
    proxy: {
      "/api": "http://localhost:8100",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: { input: { main: resolve(__dirname, "index.html"), facilitator: resolve(__dirname, "facilitator.html") } },
  },
});
