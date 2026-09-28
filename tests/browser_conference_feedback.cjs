// All /api requests are intercepted. No cloud inference or private media.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const out = path.join(root, ".review-cache/conference-2026-09-24");
fs.mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL || "http://127.0.0.1:8100";
const disabled = { configured: false, state: "disabled", model: "fixture" };
const providers = ["claude", "openai", "gemini", "local"].map(id => ({
  id, name: id === "local" ? "Local forensics" : `${id} Vision`,
  kind: id === "local" ? "forensic" : "vision", status: "ok", rating: 90,
  verdict: "synthetic_likely", confidence: "low", summary: "Offline fixture, not a finding.",
  evidence: [], model: "fixture", latency_ms: 0, raw: {},
}));
const provenance = {
  id: "c2pa", name: "C2PA Content Credentials", kind: "provenance", status: "ok", rating: null,
  verdict: "inconclusive", confidence: null, model: null, latency_ms: 0,
  summary: "Integrity validated; signer trust not established. No recognised AI-generation declaration.",
  evidence: [...Array.from({ length: 8 }, (_, i) => `Fixture evidence ${i}`),
    "Ingredient record - declared tool: Example creation app; actions: c2pa.created.",
    "No reviewed local C2PA trust snapshot installed. Provenance overrides are disabled."],
  raw: { active_manifest: "fixture", validation: { integrity: "valid", trust: "untrusted" },
    declaration: "No recognised AI-generation or camera-capture declaration." },
};
function record(index) {
  return {
    meta: { tool: "SDA Vision", version: "test", report_id: `fixture-${index}`,
      filename: `fixture-${index}.png`, kind: "image", frame_count: 1, frames_found: 1,
      generated_at: "2026-09-24T00:00:00Z", elapsed_ms: 10, models: ["fixture"],
      notes: [], mode: "general" }, providers: [...providers, provenance],
    frames: [{ frame: "image", rating: 90, verdict: "synthetic_likely" }],
    consensus: { overall_rating: 90, overall_verdict: "synthetic_likely", confidence: "low",
      headline: "Offline fixture result", explanation: "Test fixture only.", agreement: "fixture",
      decision_trace: [], supporting: [], not_decisive: [], visible_text: "", vaccine_codes: [],
      disclaimer: "Offline fixture, not a finding." },
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    let analyses = 0, scores = 0;
    const graphRequests = [], summaries = [];
    await page.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      let body;
      if (url.pathname === "/api/providers") {
        body = { tool: "SDA Vision", version: "test", dev_mode: true, vaccine_lens: false,
          corpus_available: false, claude: disabled, openai: disabled, gemini: disabled,
          synthid: disabled, c2pa: disabled, local: disabled };
      } else if (url.pathname === "/api/corpus") body = { available: false, labels: [] };
      else if (url.pathname === "/api/examples") body = { files: [] };
      else if (url.pathname === "/api/analyse") body = record(++analyses);
      else if (url.pathname === "/api/opinion-score") {
        assert.equal(route.request().postDataJSON().consent_to_anthropic, true);
        scores++;
        body = { score: 99, read: "Fixture note score" };
      } else if (url.pathname === "/api/diffusion/summary") {
        const req = route.request().postDataJSON();
        summaries.push(req);
        const rep = req.reports?.[0] || {};
        let caption = "Three visual LLMs assessed this item: three lean synthetic, zero lean authentic.";
        if (rep.second_opinion_gemini) caption += ` Pasted second opinion: Gemini SynthID (${rep.second_opinion_gemini_score ?? "not scored"}).`;
        body = { headline: caption, caption, paragraph: caption };
      } else if (url.pathname === "/api/diffusion") {
        const req = route.request().postDataJSON();
        graphRequests.push(req);
        const reps = req.reports || [];
        const nodes = reps.length ? [
          { id: "item", label: reps[0].meta.filename, source: "item", rating: 90,
            verdict: "synthetic_likely", x: .5, y: .5, degree: 4 },
          ...providers.map((p, i) => ({ id: p.id, label: p.name, provider: p.id, source: "signal",
            rating: 90, verdict: p.verdict, x: i / 4, y: i % 2, degree: 1 })),
        ] : [];
        body = { source: req.source, nodes,
          edges: nodes.slice(1).map(n => ({ source: "item", target: n.id, weight: .5 })),
          stats: { nodes: nodes.length, edges: Math.max(0, nodes.length - 1), clusters: 1,
            largest_cluster: nodes.length } };
      } else throw new Error("Unexpected request " + url.pathname);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(base);
    const upload = page.getByRole("button", { name: "Upload single file", exact: true });
    await upload.waitFor();
    const choice = page.waitForEvent("filechooser");
    await upload.click();
    const chooser = await choice;
    assert.equal(chooser.isMultiple(), false);
    const buffer = fs.readFileSync(path.join(root, "examples/synthetic_vaccine_illustration.png"));
    await chooser.setFiles({ name: "single.png", mimeType: "image/png", buffer });
    await page.getByRole("button", { name: "Run analysis", exact: true }).click();
    await page.getByRole("heading", { name: "Offline fixture result" }).waitFor();
    await page.getByRole("button", { name: "Plain-English summary", exact: true }).waitFor();
    assert.equal(graphRequests.at(-1).source, "item");
    assert.equal(graphRequests.at(-1).reports[0].providers.length, 5);
    const provenancePanel = page.locator(".provenance-evidence");
    await provenancePanel.getByText("Integrity validated; signer trust not established. No recognised AI-generation declaration.").waitFor();
    await provenancePanel.locator("summary").click();
    await provenancePanel.getByText("Ingredient record - declared tool: Example creation app; actions: c2pa.created.", { exact: true }).waitFor();
    await provenancePanel.getByText("No reviewed local C2PA trust snapshot installed. Provenance overrides are disabled.", { exact: true }).waitFor();
    await page.locator(".table-wrap").first().screenshot({ path: path.join(out, "provenance-desktop.png") });

    // One upload through the batch controls must build the same provider map.
    await page.locator('.batch-queue input[type="file"]').setInputFiles({ name: "batch.png", mimeType: "image/png", buffer });
    await page.getByRole("button", { name: /Select.*5|Select all/i }).click();
    await page.getByRole("button", { name: "Run batch (1)", exact: true }).click();
    await page.locator(".batch-item-head").first().waitFor();
    await page.waitForFunction(() => document.querySelector(".diffusion-controls select")?.value === "item");
    await page.getByRole("button", { name: "Plain-English summary", exact: true }).click();
    assert.equal(graphRequests.at(-1).source, "item");
    assert.equal(graphRequests.at(-1).reports[0].meta.report_id, "fixture-2");
    await page.locator(".batch-item-head").first().click();
    await page.getByRole("heading", { name: "Suggested sources to check" }).waitFor();
    const note = page.locator(".so-paste textarea").first();
    await note.fill("New external checking note");
    await page.locator(".graph-story").getByText(/Gemini SynthID \(not scored\)/).waitFor();
    assert.equal(scores, 0);
    await page.getByRole("button", { name: "Add note to scoring", exact: true }).first().click();
    await page.locator(".graph-story").getByText(/Gemini SynthID \(99\)/).waitFor();
    assert.equal(scores, 1);
    assert.equal(summaries.at(-1).reports[0].consensus.overall_rating, 90);
    await note.fill("Edited note");
    await page.locator(".graph-story").getByText(/Gemini SynthID \(not scored\)/).waitFor();
    await note.fill("");
    await page.waitForFunction(() => {
      const text = document.querySelector(".graph-story")?.textContent;
      return text && !text.includes("Gemini SynthID");
    });
    await page.screenshot({ path: path.join(out, "desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".provenance-evidence summary").click();
    await page.locator(".provenance-evidence").screenshot({ path: path.join(out, "provenance-mobile.png") });
    await page.screenshot({ path: path.join(out, "mobile.png"), fullPage: true });
    await page.locator(".input-panel").screenshot({ path: path.join(out, "mobile-upload.png") });
    await page.locator(".diffusion-panel").screenshot({ path: path.join(out, "mobile-graph.png") });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.locator('.batch-queue input[type="file"]').setInputFiles({ name: "batch-two.png", mimeType: "image/png", buffer });
    await page.getByRole("button", { name: /Select.*5|Select all/i }).click();
    await page.getByRole("button", { name: "Run batch (1)", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".diffusion-controls select")?.value === "batch");
    await page.getByRole("button", { name: "Plain-English summary", exact: true }).waitFor();
    assert.equal(graphRequests.at(-1).reports.length, 2);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, analyses, scores, cloudCalls: 0, screenshots: out }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
