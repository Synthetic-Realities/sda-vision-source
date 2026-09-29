import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createServer } from "../frontend/node_modules/vite/dist/node/index.js";
import React from "../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../frontend/node_modules/react-dom/server.node.js";

const server = await createServer({ root: fileURLToPath(new URL("../frontend", import.meta.url)),
  configFile: false, esbuild: { jsx: "automatic" },
  server: { middlewareMode: true, ws: false }, appType: "custom", optimizeDeps: { noDiscovery: true } });
try {
  const { default: ImageSourceSearch } = await server.ssrLoadModule("/src/components/ImageSourceSearch.tsx");
  const { default: CreationHistory } = await server.ssrLoadModule("/src/components/CreationHistory.tsx");
  const { default: WorkshopActivity } = await server.ssrLoadModule("/src/components/WorkshopActivity.tsx");
  const { emptyWorkshopResponses } = await server.ssrLoadModule("/src/workshop.ts");
  const { mediaKind } = await server.ssrLoadModule("/src/community.ts");
  const report = JSON.parse(await readFile(new URL("./fixtures/workshop-review/illustration_1.json", import.meta.url), "utf8"));
  const before = JSON.stringify(report);
  const noop = () => {};
  for (const [name, kind] of [["photo.jpg", "image"], ["illustration.png", "image"], ["drawing.webp", "image"],
    ["infographic.pdf", "pdf"], ["presentation.pptx", "pptx"], ["podcast.m4a", "audio"],
    ["animated-video.mov", "video"], ["clip.mp4", "video"], ["transcript.txt", "text"], ["unknown.bin", "file"]]) {
    assert.equal(mediaKind(name), kind);
    // A document/audio/video can have an image preview without becoming an image item.
    const item = { ...report, meta: { ...report.meta, filename: name, kind, thumbnail: "data:image/png;base64,cHJldmlldw==" } };
    assert.equal(mediaKind("preview.png", item), kind);
    const search = renderToStaticMarkup(React.createElement(ImageSourceSearch, { kind, originalUrl: "/original", originalName: name }));
    const history = renderToStaticMarkup(React.createElement(CreationHistory, { report: item, kind, onSourceSearch: noop }));
    const reflect = renderToStaticMarkup(React.createElement(WorkshopActivity, { kind, step: "reflect", report: item,
      busy: false, responses: emptyWorkshopResponses(), originalUrl: "/original", originalName: name,
      onChange: noop, onNext: noop, onPrevious: noop, onReviewChecks: noop, onEndSession: noop,
      onNewSession: noop, onViewEvidence: noop, sessionStatus: "" }));
    if (kind === "image") {
      assert.match(search, /Google Lens \/ image search/);
      assert.match(search, /target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"/);
      assert.match(search, /Download original file/);
      assert.match(history, /Explore image-search evidence/);
      assert.match(reflect, /Open Google Lens/);
    } else {
      assert.equal(search, "", name);
      assert.doesNotMatch(history + reflect, /Google Lens|images\.google\.com|Explore image-search evidence|Find the original source/);
    }
    for (const action of ["Compare with other evidence", "Ask someone with relevant expertise", "Pause before sharing"]) assert.ok(reflect.includes(action));
  }
  assert.equal(JSON.stringify(report), before, "Saved analysis stays unchanged");
  console.log("Image-search scope passed: images, PDF, PPTX, audio, video, text, unknown files and image-preview isolation.");
} finally { await server.close(); }
