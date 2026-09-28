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
  const { default: CommunityView } = await server.ssrLoadModule("/src/components/CommunityView.tsx");
  const { default: WorkshopActivity } = await server.ssrLoadModule("/src/components/WorkshopActivity.tsx");
  const { emptyWorkshopResponses, discussionClues } = await server.ssrLoadModule("/src/workshop.ts");
  const noop = () => {};
  const { default: PresentationSwitcher } = await server.ssrLoadModule("/src/components/PresentationSwitcher.tsx");
  const switcher = renderToStaticMarkup(React.createElement(PresentationSwitcher, { value: "community", onChange: noop, disabled: false }));
  assert.equal((switcher.match(/type="radio"/g) ?? []).length, 3);
  assert.doesNotMatch(switcher, /value="trainer"|Train the trainer/);
  assert.match(switcher, /value="facilitator"/);
  assert.match(switcher, /Facilitator guide/);
  const props = { active: true, trainer: false, report: null, providers: null, examples: [],
    name: "", url: null, hasInput: false, busy: false, running: false, status: "", caption: "", mode: "general",
    onCaption: noop, onMode: noop, onFile: noop, onExample: noop, onAnalyse: noop,
    onNewSession: noop, onStepChange: noop, onSecondOpinionTarget: noop };
  for (const trainer of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(CommunityView, { ...props, trainer }));
    assert.match(html, /<h2 class="community-start-heading">Start here<\/h2>/);
    assert.match(html, /Community table scene \(practice example\)/);
    assert.match(html, /Try the four workshop steps with this practice example/);
    assert.doesNotMatch(html, /AI-generated workshop illustration|AI-generated illustration|Project source record:/);
    assert.match(html, /Drawn or painted by a person/);
    assert.doesNotMatch(html, /<fieldset[^>]*disabled/);
    assert.doesNotMatch(html, /<textarea[^>]*disabled/);
    const choices = html.match(/<fieldset class="community-choices[\s\S]*?<\/fieldset>/)?.[0];
    assert.ok(choices);
    assert.doesNotMatch(choices, /type="checkbox"[^>]*checked/);
    const busy = renderToStaticMarkup(React.createElement(CommunityView, { ...props, trainer, busy: true }));
    assert.match(busy, /<fieldset[^>]*disabled/);
    assert.match(busy, /<textarea[^>]*disabled/);
  }
  const { preparedDocumentArtwork } = await server.ssrLoadModule("/src/exampleArtwork.ts");
  const slides = renderToStaticMarkup(React.createElement(CommunityView, {...props, name:"approved-local.pptx",hasInput:true,slidePreview:{slides:[{src:"./slide.jpg",width:1920,height:1080}],loading:false,error:"",prepare:async()=>{}}}));
  assert.match(slides, /Presentation slideshow/);
  const otherSlides = renderToStaticMarkup(React.createElement(CommunityView, {...props, name:"another.pptx",hasInput:true,thumbnail:"blob:another-preview"}));
  assert.doesNotMatch(otherSlides, /Presentation slideshow/);
  const { default: InputPanel } = await server.ssrLoadModule("/src/components/InputPanel.tsx");
  const inputProps = { mode: "general", setMode: noop, vaccineEnabled: false, onSelectFile: noop,
    onSelectCorpus: noop, previewUrl: "blob:local-example", caption: "", setCaption: noop,
    onAnalyse: noop, busy: false, running: false, status: "", corpus: null, examples: [],
    onSelectExample: noop, hasInput: true, allowUpload: false, reportThumb: "/cover.png" };
  for (const [name, prompt] of [["podcast.m4a", "Listen to the recording"], ["clip.mp4", "Watch the video"], ["image.png", null], ["presentation.pdf", null]]) {
    const html = renderToStaticMarkup(React.createElement(InputPanel, { ...inputProps, previewName: name }));
    assert.match(html, /aria-label="View larger"/);
    assert.doesNotMatch(html, /autoplay|<input[^>]*type="file"/i);
    if (prompt) assert.ok(html.includes(prompt));
    else assert.doesNotMatch(html, /Listen to the recording|Watch the video/);
  }
  const { default: BatchQueue } = await server.ssrLoadModule("/src/components/BatchQueue.tsx");
  const batchProps = { queue: [], examples: [{name:"image.png"},{name:"podcast.m4a"}], onExamples: async () => [],
    onAdd: noop, onClear: noop, onToggle: noop, onRemove: noop, onSelectAll: noop, onDeselectAll: noop,
    onRun: noop, busy: false, running: false };
  const batchHtml = renderToStaticMarkup(React.createElement(BatchQueue, batchProps));
  const profile = await server.ssrLoadModule("/src/showcase.ts");
  if (profile.EXAMPLES_ONLY) {
    assert.match(batchHtml, /Choose examples for your batch/);
    assert.equal((batchHtml.match(/type="checkbox"/g) ?? []).length, 2);
    assert.doesNotMatch(batchHtml, /<select|type="file"/);
    const full = renderToStaticMarkup(React.createElement(BatchQueue, {...batchProps,
      queue: Array.from({length:10}, (_,i) => ({id:String(i),file:{name:`queued-${i}.png`},url:"/test.png",selected:i<5}))}));
    const picker = full.match(/<fieldset[\s\S]*?<\/fieldset>/)[0];
    assert.equal((picker.match(/type="checkbox"[^>]*disabled=""/g) ?? []).length, 2);
  } else assert.match(batchHtml, /type="file"/);
  const report = JSON.parse(await readFile(new URL("./fixtures/workshop-review/illustration_1.json", import.meta.url), "utf8"));
  const { default: CommunityFindingSummary } = await server.ssrLoadModule("/src/components/CommunityFindingSummary.tsx");
  const recordBefore = JSON.stringify(report);
  const compact = renderToStaticMarkup(React.createElement(CommunityFindingSummary, { report, status: "" }));
  assert.equal((compact.match(/class="community-find-why"/g) ?? []).length, report.providers.length);
  assert.doesNotMatch(compact, /class="community-find-why"[^>]*open|Provider evidence and ratings|File and analysis record/);
  for (const provider of report.providers) {
    const variant = structuredClone(report);
    variant.providers = [{ ...provider, status: "error", rating: 99, summary: "Recorded failure" }];
    const html = renderToStaticMarkup(React.createElement(CommunityFindingSummary, { report: variant, status: "" }));
    assert.match(html, /Check failed/);
    assert.match(html, /Recorded failure/);
    assert.doesNotMatch(html, /role="meter"/);
  }
  assert.equal(JSON.stringify(report), recordBefore);
  const audioReport = JSON.parse(await readFile(new URL("./fixtures/workshop-review/podcast.json", import.meta.url), "utf8"));
  const sound = renderToStaticMarkup(React.createElement(CommunityFindingSummary, {report:audioReport,status:""}));
  assert.match(sound, /role="tab"[^>]*aria-selected="true"[^>]*>[\s\S]*?Transcript/);
  assert.match(sound, /Recorded sound checks/);
  assert.match(sound, /AI-origin detection from the sound itself is outside this workflow/);
  assert.doesNotMatch(sound, /consent|<input|Assess audio excerpt/);
  const activity = { kind: "image", report: null, busy: false, responses: emptyWorkshopResponses(),
    onChange: noop, onNext: noop, onPrevious: noop, onReviewChecks: noop,
    onEndSession: noop, onNewSession: noop, sessionStatus: "", onViewEvidence: noop, originalUrl: "blob:local-original", originalName: "image.png" };
  for (const step of ["notice", "discuss", "check", "reflect"]) {
    const html = renderToStaticMarkup(React.createElement(WorkshopActivity, { ...activity, step, report }));
    assert.doesNotMatch(html, /What would you like to check next\?|Your responses stay on this page|Where it was shared/);
    assert.doesNotMatch(html, /<fieldset[^>]*disabled/);
    if (step === "check") assert.match(html, /Reflect together/);
    if (step === "reflect") {
      assert.match(html, /Download session notes/);
      assert.doesNotMatch(html, /Check the date and context/);
      assert.match(html, /href="https:\/\/images.google.com\/" target="_blank" rel="noopener noreferrer"/);
      assert.match(html, /Open Google Lens/);
      assert.match(html, /href="blob:local-original" download="image.png"/);
      assert.match(html, /Download original file/);
      assert.match(html, /Compare with other evidence/);
      assert.match(html, /Ask someone with relevant expertise/);
      assert.match(html, /Pause before sharing/);
      // Following the external link is separate from recording a checkbox choice.
      for (const label of html.matchAll(/<label[\s\S]*?<\/label>/g)) assert.doesNotMatch(label[0], /<a /);
    }
  }
  for (const kind of ["image", "video", "audio", "text", "pdf", "pptx"]) {
    assert.ok(!discussionClues(kind).includes("Where it was shared"));
    const html = renderToStaticMarkup(React.createElement(WorkshopActivity, { ...activity, step: "reflect", kind, report }));
    if (kind === "image") assert.match(html, /Find the original source/);
    else assert.doesNotMatch(html, /Find the original source|Open Google Lens|camera icon/);
    for (const action of ["Compare with other evidence", "Ask someone with relevant expertise", "Pause before sharing"]) assert.ok(html.includes(action));
  }
  const { default: ImageSourceSearch } = await server.ssrLoadModule("/src/components/ImageSourceSearch.tsx");
  for (const url of ["blob:local-original", "./showcase/examples/image.png"]) {
    const html = renderToStaticMarkup(React.createElement(ImageSourceSearch, {kind:"image",originalUrl:url,originalName:"image.png"}));
    assert.ok(html.includes(`href="${url}" download="image.png"`));
    assert.match(html, /Download original file/);
    assert.match(html, /href="https:\/\/images.google.com\/" target="_blank"/);
  }
  const unavailableOriginal = renderToStaticMarkup(React.createElement(ImageSourceSearch, {kind:"image"}));
  assert.doesNotMatch(unavailableOriginal, /Download original file/);
  const showcase = await server.ssrLoadModule("/src/showcase.ts");
  const starter = { id: "illustration_1", name: "illustration-1.png", report: "reports/illustration_1.json" };
  const requests = [], originalFetch = globalThis.fetch;
  let failReport = false;
  globalThis.fetch = async url => {
    requests.push(url);
    if (url.endsWith("manifest.json")) return { json: async () => ({ examples: [{ name: "podcast.m4a" }], workshop_starter: starter }) };
    if (url.endsWith(starter.report)) return { ok: !failReport, json: async () => structuredClone(report) };
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    assert.deepEqual((await showcase.showcaseExamples()).map(e => e.name), ["podcast.m4a"]);
    assert.deepEqual(await showcase.showcaseReport(showcase.WORKSHOP_STARTER_NAME), report);
    for (const format of ["pdf", "pptx", "csv", "md"]) {
      assert.match(await showcase.showcaseExportUrl(starter.name, format), new RegExp(`exports/illustration_1\\.${format}$`));
    }
    failReport = true;
    await assert.rejects(showcase.showcaseReport(starter.name), /Recorded findings could not be opened/);
    assert.ok(requests.every(url => url.includes("showcase/") && !url.includes("/api/")));
  } finally { globalThis.fetch = originalFetch; }
  console.log("Workshop flow: all four activities, starter lookup/exports, error handling, removed choices and busy states passed.");
} finally { await server.close(); }
