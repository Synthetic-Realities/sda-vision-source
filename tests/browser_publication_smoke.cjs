// Offline UI regression checks. Every API request is intercepted; no provider calls.
// NODE_PATH must point to a Playwright installation. BASE_URL defaults to localhost.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const out = path.join(root, ".review-cache/publication-2026-09-19");
fs.mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL || "http://127.0.0.1:8100";
const disabled = { configured: false, state: "disabled", model: "offline test fixture" };
const provider = {
  id: "fixture", name: "Offline fixture", kind: "vision", status: "ok", rating: 50,
  verdict: "inconclusive", confidence: "low", summary: "UI fixture, not an analysis.",
  evidence: [], visible_text: null, vaccine_relevance: null, model: "fixture",
  latency_ms: 0, raw: {},
};
const report = {
  meta: { tool: "SDA Vision", version: "test", report_id: "ui-fixture-1",
    filename: "first.png", kind: "image", frame_count: 1, frames_found: 1,
    generated_at: "2026-09-19T00:00:00Z", elapsed_ms: 10, models: ["fixture"],
    notes: [], mode: "general" },
  providers: [provider], frames: [{ frame: "image", rating: 50, verdict: "inconclusive" }],
  consensus: { overall_rating: 50, overall_verdict: "inconclusive", confidence: "low",
    headline: "Inconclusive, needs human review", explanation: "Offline UI fixture.",
    agreement: "fixture", decision_trace: [], supporting: [], not_decisive: [],
    visible_text: "", vaccine_codes: [], disclaimer: "Offline test only." },
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    let finishAnalysis, finishScore, finishGraph, holdGraph = false, scoreCalls = 0, analysisCalls = 0;
    await page.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      let body = {};
      if (url.pathname === "/api/providers") {
        body = { tool: "SDA Vision", version: "test", dev_mode: false,
          vaccine_lens: false, corpus_available: false, claude: disabled, openai: disabled,
          gemini: disabled, synthid: disabled, c2pa: disabled, local: disabled };
      } else if (url.pathname === "/api/corpus") {
        body = { available: false, labels: [] };
      } else if (url.pathname === "/api/examples") {
        body = { examples: [] };
      } else if (url.pathname === "/api/analyse") {
        analysisCalls += 1;
        await new Promise(resolve => { finishAnalysis = resolve; });
        body = report;
      } else if (url.pathname === "/api/opinion-score") {
        scoreCalls += 1;
        assert.equal(route.request().postDataJSON().consent_to_anthropic, true);
        await new Promise(resolve => { finishScore = resolve; });
        body = { score: 99, read: "STALE SCORE MUST NOT LAND" };
      } else if (url.pathname.startsWith("/api/diffusion")) {
        if (holdGraph) await new Promise(resolve => { finishGraph = resolve; });
        body = { source: "example", nodes: [], edges: [],
          stats: { nodes: holdGraph ? 9876 : 0, edges: 0, clusters: 0, largest_cluster: 0 }, paragraph: "Offline fixture." };
      } else {
        throw new Error("Unexpected API request: " + url.pathname);
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(base);
    const input = page.locator('input[type="file"]').first();
    await input.waitFor({ state: "attached" });
    assert.equal(await input.isEnabled(), true, "Uploads must work with dev_mode=false");
    const buffer = fs.readFileSync(path.join(root, "examples/synthetic_vaccine_illustration.png"));
    await input.setInputFiles({ name: "first.png", mimeType: "image/png", buffer });
    await page.getByRole("button", { name: "Run analysis", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('input[type="file"]').disabled);
    assert.equal(await input.isDisabled(), true);
    // Simulate a drop even though browser controls are locked.
    await page.locator(".dropzone").evaluate(element => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["second"], "second.png", { type: "image/png" }));
      element.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
    });
    assert.equal(await page.locator(".preview-name").innerText(), "first.png");
    await page.waitForTimeout(50);
    assert.equal(analysisCalls, 1);
    finishAnalysis();
    await page.getByRole("heading", { name: "Inconclusive, needs human review" }).waitFor();
    assert.equal(await page.locator(".preview-name").innerText(), "first.png");
    const paste = page.locator(".so-paste textarea").first();
    await paste.fill("First local note");
    await page.locator("h1").first().click();
    assert.equal(scoreCalls, 0, "Pasting and blurring must not transmit a note");
    await page.getByRole("button", { name: "Add note to scoring" }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes("Scoring the note"));
    await paste.fill("Edited local note");
    finishScore();
    await page.waitForTimeout(100);
    assert.equal(await page.getByText("STALE SCORE MUST NOT LAND").count(), 0);
    await page.screenshot({ path: path.join(out, "desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(out, "mobile.png"), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, "Page must not overflow the mobile viewport");
    holdGraph = true;
    await page.getByRole("button", { name: "Build graph", exact: true }).click();
    while (!finishGraph) await page.waitForTimeout(20);
    await input.setInputFiles({ name: "second.png", mimeType: "image/png", buffer });
    finishGraph();
    await page.waitForTimeout(100);
    assert.equal(await page.getByText(/9876 nodes/).count(), 0, "Late graph must not land on a new selection");
    assert.equal(await page.locator(".preview-name").innerText(), "second.png");
    assert.equal(await page.getByRole("heading", { name: "Inconclusive, needs human review" }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, devMode: false, analysisCalls, scoreCalls,
      cloudCalls: 0, viewportChecks: ["1440x1000", "390x844"], screenshots: out }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
