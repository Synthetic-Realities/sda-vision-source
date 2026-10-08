import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "../frontend/node_modules/vite/dist/node/index.js";
import React from "../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../frontend/node_modules/react-dom/server.node.js";
const server = await createServer({ root: fileURLToPath(new URL("../frontend", import.meta.url)), configFile: false,
  esbuild: { jsx: "automatic" }, server: { middlewareMode: true, ws: false }, appType: "custom", optimizeDeps: { noDiscovery: true } });
try {
  const { default: GameView, HARBOUR_DOI } = await server.ssrLoadModule("/src/components/GameView.tsx");
  const { default: Switcher } = await server.ssrLoadModule("/src/components/PresentationSwitcher.tsx");
  for (const mode of ["demo", "dev"]) {
    const html = renderToStaticMarkup(React.createElement(GameView, { mode, onMode: () => {} }));
    assert.doesNotMatch(html, /<iframe|autoplay/i, "Opening a section alone must not launch game media");
    assert.match(html.match(new RegExp(`<input[^>]*value="${mode}"[^>]*>`))[0], /checked/);
    assert.ok(html.includes(HARBOUR_DOI));
    for (const tag of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(tag[0], /rel="noopener noreferrer"/);
    if (mode === "demo") { assert.match(html, /Play here/); assert.match(html, /scripted findings for teaching/); }
    else { assert.match(html, /Dev Studio runs on your computer/); assert.match(html, /npm run dev/); assert.doesNotMatch(html, /type="password"|type="file"/); }
  }
  const busy = renderToStaticMarkup(React.createElement(Switcher, { value: "game", onChange: () => {}, disabled: true }));
  assert.match(busy, /<fieldset[^>]*disabled/);
  assert.match(busy.match(/<input[^>]*value="game"[^>]*>/)[0], /checked/);
  assert.equal((busy.match(/name="sda-presentation"/g) ?? []).length, 4);
  const { default: Footer } = await server.ssrLoadModule("/src/components/Footer.tsx");
  const footer = renderToStaticMarkup(React.createElement(Footer, { game: true }));
  assert.match(footer, /game saves progress and settings in this browser/);
  assert.doesNotMatch(footer, /Server retention mode is not yet known|Pasted notes/);
  console.log("Game view: deferred loading, local Studio scope, safe links and navigation checks passed.");
} finally { await server.close(); }
