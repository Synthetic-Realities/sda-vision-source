import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "../frontend/node_modules/vite/dist/node/index.js";

const server = await createServer({ root: fileURLToPath(new URL("../frontend", import.meta.url)),
  configFile: false, server: { middlewareMode: true, ws: false }, appType: "custom", optimizeDeps: { noDiscovery: true } });
try {
  const { assessmentModels, assessmentScope, assessmentTitle, checkStatus, communitySummary, mediaKind, modelReadingSummary, providerFinding, providerRating, soundtrackFinding, workshopOverview } = await server.ssrLoadModule("/src/community.ts");
  const { emptyWorkshopResponses, discussionPrompt, discussionClues, impressionOptions, sameImpression, toggleImpression, workshopHeading, FACILITATOR_QUESTIONS } = await server.ssrLoadModule("/src/workshop.ts");
  const { summarySections, summaryRows, summaryCsv } = await server.ssrLoadModule("/src/workshopExport.ts");
  const { previewCaption, prepareExportPreview } = await server.ssrLoadModule("/src/exportPreview.ts");
  assert.equal(previewCaption({ kind: 'image', analysed: true }), 'Analysed image.');
  assert.equal(previewCaption({ kind: 'video', analysed: true, frameLabel: '00:03' }), 'Video preview: sampled still frame (00:03).');
  assert.equal(previewCaption({ kind: 'audio', analysed: true }), 'Audio preview: cover artwork or waveform.');
  assert.doesNotMatch(previewCaption({ kind: 'pdf', analysed: false }), /analysed/);
  const oldWindow = globalThis.window;
  globalThis.window = { location: { href: 'http://localhost:8100/', origin: 'http://localhost:8100' } };
  try {
    for (const source of ['https://external.example/image.png', 'data:image/svg+xml;base64,invalid']) {
      assert.equal((await prepareExportPreview({ kind: 'video', thumbnail: source, analysed: true })).image, undefined);
    }
    assert.match((await prepareExportPreview({ kind: 'text', thumbnail: 'data:image/png;base64,invalid', analysed: true })).caption, /Text-only/);
  } finally {
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
  }
  const parsed = summarySections('# Title\n\nFile: fixture.png\n\n## Evidence\n- Provider: Fixture\n  - Key evidence: First item\n  - Key evidence: Final item\n\n## Notes\nA & B <example> \\*literal\\*');
  assert.deepEqual(parsed[0].lines, ['Provider: Fixture', 'Key evidence: First item', 'Key evidence: Final item']);
  assert.deepEqual(summaryRows(parsed.at(-1)), [['File', 'fixture.png']]);
  assert.match(summaryCsv(parsed), /A & B <example> \*literal\*/);
  assert.match(summaryCsv([{ heading: '=FORMULA', lines: ['Note: =1+1', 'Text: Quoted "word", here'] }]), /'=FORMULA/);
  assert.match(summaryCsv([{ heading: 'Safety', lines: ['Note: =1+1'] }]), /'=1\+1/);
  const original = { meta: { tool: "SDA", version: "test", filename: "fixture.png", kind: "image", frame_count: 1,
    report_id: "fixture-record", generated_at: "2026-09-24", mode: "general", models: ["fixture"], notes: [] },
    consensus: { overall_verdict: "inconclusive", overall_rating: null, confidence: "low", explanation: "Mixed findings." },
    providers: [], frames: [] };
  const before = JSON.stringify(original);
  assert.equal(assessmentTitle(original), "We need more information");
  for (const [status, label] of Object.entries({ ok: "Complete", error: "Check failed", timeout: "Timed out", disabled: "Disabled", pending: "Not checked", unconfigured: "Unavailable" })) {
    assert.equal(checkStatus({ status }), label);
  }
  assert.equal(providerFinding({ status: "error", summary: "Signature validation failed.", kind: "provenance" }), "Signature validation failed.");
  assert.equal(providerFinding({ status: "ok", summary: "Signer trust unresolved; integrity validated.", kind: "provenance" }), "Signer trust unresolved; integrity validated.");
  assert.match(soundtrackFinding(original), /not recorded/);
  for (const [status, expected] of [["absent", /No audio track/], ["unavailable", /presence is unknown/], ["error", /failed/], ["present", /can include silence/]]) {
    assert.match(soundtrackFinding({ ...original, audio_inspection: { status, stream_count: 1, tracks: [] } }), expected);
  }
  const textDocument = { ...original, meta: { ...original.meta, kind: "pdf", frame_count: 0 }, providers: [{ kind: "analysis" }] };
  assert.match(assessmentScope(textDocument), /text extracted/);
  assert.match(assessmentTitle(textDocument), /text/);
  assert.match(assessmentScope({ ...original, meta: { ...original.meta, kind: "video", frame_count: 4 } }), /4 sampled still frames/);
  assert.match(assessmentScope({ ...original, meta: { ...original.meta, kind: "audio" } }), /transcript/);
  assert.match(assessmentScope({ ...original, meta: { ...original.meta, kind: "pptx", frame_count: 2, frames_found: 9 } }), /2 extracted frames of 9/);
  for (const verdict of ["authentic_likely", "synthetic_likely", "partially_synthetic", "inconclusive", "not_applicable"]) {
    assert.equal(typeof assessmentTitle({ ...original, consensus: { ...original.consensus, overall_verdict: verdict } }), "string");
  }
  assert.equal(mediaKind("PODCAST.M4A"), "audio");
  const summary = communitySummary(original, "<script>not markup</script>", "Not sure yet", true);
  assert.match(summary, /fixture-record/);
  assert.match(summary, /Cached showcase report/);
  assert.doesNotMatch(summary, /combined method confidence|confidence: low/);
  assert.match(summary, /Analysis lens: general/);
  assert.match(summary, /separate from automated scoring/);
  assert.doesNotMatch(summary, /<script>/);
  assert.equal(JSON.stringify(original), before, "Presentation helpers must not change the research record");
  const scored = { status: "ok", kind: "vision", rating: 72 };
  assert.equal(providerRating(scored), 72);
  for (const rating of [0, 100]) assert.equal(providerRating({ ...scored, rating }), rating);
  for (const rating of [null, undefined, -1, 101, NaN, Infinity]) assert.equal(providerRating({ ...scored, rating }), null);
  for (const status of ["error", "timeout", "disabled", "pending", "unconfigured"]) assert.equal(providerRating({ ...scored, status }), null);
  for (const kind of ["provenance", "watermark"]) assert.equal(providerRating({ ...scored, kind }), null);
  const response = emptyWorkshopResponses();
  response.clues.push("Small visual details");
  assert.deepEqual(emptyWorkshopResponses().clues, []);
  response.impression = ["Made with AI"];
  response.noticeNote = "<script>private</script>";
  response.laterImpression = ["Not sure yet"];
  response.nextActions = ["Pause before sharing"];
  assert.match(discussionPrompt(response.impression), /What led you towards AI-made/);
  assert.match(discussionPrompt(["Not sure yet"]), /What would help you decide/);
  assert.match(discussionPrompt([]), /What would help you decide/);
  const selected = ["Illustrated / hand-drawn", "Made with AI"];
  assert.match(discussionPrompt(selected), /How do your choices fit together/);
  assert.deepEqual(toggleImpression(["Illustrated / hand-drawn"], "Made with AI"), selected);
  assert.deepEqual(toggleImpression(selected, "Not sure yet"), ["Not sure yet"]);
  assert.deepEqual(toggleImpression(["Not sure yet"], "Made with AI"), ["Made with AI"]);
  assert.deepEqual(toggleImpression(selected, "Made with AI"), ["Illustrated / hand-drawn"]);
  assert.deepEqual(toggleImpression(["Not sure yet"], "Not sure yet"), []);
  assert.deepEqual(toggleImpression(["Made with AI"], "Made with AI"), []);
  assert(sameImpression(selected, [...selected].reverse()));
  assert(!sameImpression(selected, ["Made with AI"]));
  assert.deepEqual(emptyWorkshopResponses().impression, []);
  assert.deepEqual(emptyWorkshopResponses().laterImpression, []);
  const combinedExport = communitySummary(original, "", "", false, { ...emptyWorkshopResponses(), impression: selected, laterImpression: [...selected].reverse() });
  assert.match(combinedExport, /Notice: Illustrated \/ hand-drawn; Made with AI/);
  assert.match(combinedExport, /Later view: Made with AI; Illustrated \/ hand-drawn/);
  assert.equal(impressionOptions("video")[0], "Filmed");
  assert.equal(impressionOptions("audio")[0], "Human-made");
  assert.deepEqual(impressionOptions("image"), ["Photo", "Drawn or painted by a person", "Made with AI", "Mix of human and AI", "Not sure yet"]);
  for (const kind of ["video", "pdf", "pptx"]) {
    const choices = impressionOptions(kind);
    assert(choices.includes("Illustrated / hand-drawn"));
    assert(choices.includes("Human-made"));
    assert.equal(new Set(choices).size, choices.length);
  }
  for (const kind of ["audio", "text"]) {
    assert.equal(impressionOptions(kind).filter(value => value === "Human-made").length, 1);
    assert(!impressionOptions(kind).includes("Illustrated / hand-drawn"));
  }
  for (const [choice, prompt] of [["Illustrated / hand-drawn", /drawing or illustration/], ["Human-made", /human creator/], ["Photographed", /photographed/], ["Filmed", /filmed/]]) {
    assert.match(discussionPrompt([choice]), prompt);
    const answers = { ...emptyWorkshopResponses(), impression: [choice], laterImpression: [choice] };
    const exported = communitySummary(original, "", "", false, answers);
    assert(exported.includes(`Notice: ${choice}`));
    assert(exported.includes(`Later view: ${choice}`));
    assert.match(exported, /separate from automated scoring and from documented origin/);
  }
  assert(discussionClues("video").includes("Movement or sound"));
  assert(discussionClues("audio").includes("The voices"));
  assert(discussionClues("text").includes("The claims or references"));
  assert.equal(new Set(["notice", "discuss", "check", "reflect"].map(step => workshopHeading(step, "image"))).size, 4);
  assert.equal(Object.values(FACILITATOR_QUESTIONS).every(questions => questions.length === 3), true);
  assert.equal(workshopOverview(null, "image")[0].finding, "Not checked");
  assert.equal(workshopOverview(original, "image")[0].finding, "No completed readings");
  const vision = { ...scored, name: "Visual model", verdict: "synthetic_likely" };
  const failed = { ...vision, status: "timeout", verdict: "authentic_likely" };
  const partial = { ...original, providers: [vision, failed] };
  assert.equal(workshopOverview(partial, "image")[0].finding, "Leans AI-made or altered");
  assert.match(workshopOverview(partial, "image")[0].detail, /1 of 2 model checks completed/);
  assert.equal(workshopOverview({ ...partial, providers: [vision, { ...failed, status: "ok" }] }, "image")[0].finding, "Mixed readings");
  assert.equal(workshopOverview({ ...original, providers: [failed] }, "image")[0].finding, "No completed readings");
  for (const [integrity, trust, finding] of [
    ["absent", "unknown", "No creation record found"], ["invalid", "trusted", "Creation record check failed"],
    ["valid", "trusted", "Creation record found"], ["valid", "untrusted", "Creation record found"],
  ]) {
    const provenance = { id: "c2pa", kind: "provenance", status: "ok", raw: { validation: { integrity, trust } }, summary: "Exact recorded summary" };
    assert.equal(workshopOverview({ ...original, providers: [provenance] }, "image")[1].finding, finding);
  }
  const declaration = "Manifest declares AI-generated content.";
  const c2pa = { id: "c2pa", name: "C2PA Content Credentials", kind: "provenance", status: "ok", verdict: "inconclusive", evidence: [], raw: { declaration, declared_verdict: "synthetic_likely", active_manifest: "active", validation: { integrity: "valid", trust: "untrusted" },
    history: [{ scope: "ingredient", manifest: "old", declared_signer: "Ingredient signer" }, { scope: "active", manifest: "active", declared_signer: "Fixture signer" }] },
    summary: `Integrity validated; trust unresolved. ${declaration}` };
  const duplicateReport = { ...original, providers: [c2pa] };
  const duplicateBefore = JSON.stringify(duplicateReport);
  const history = workshopOverview(duplicateReport, "image")[1];
  assert.equal(JSON.stringify(history).split("AI-generated content.").length - 1, 1, "Show the creation declaration once");
  assert.match(history.detail, /yet to establish trust/);
  assert.match(history.answers[0].answer, /signer as Fixture signer.*identifies the signer/);
  assert.doesNotMatch(JSON.stringify(history), /Ingredient signer/);
  assert.match(history.answers[1].answer, /date and place are not established by this check/);
  assert.equal(history.answers[2].answer, "The record declares AI-generated content.");
  assert.equal(JSON.stringify(duplicateReport), duplicateBefore);
  const overviewExport = communitySummary(duplicateReport, "", "", false).split("## SDA's checks at a glance")[1].split("## Recorded checks")[0];
  assert.doesNotMatch(overviewExport, /Image history|File history/);
  assert.match(communitySummary(duplicateReport, "", "", false), /About this file[\s\S]*label says this was made with AI/);
  for (const question of ["What evidence supports its claim?"]) assert(overviewExport.includes(question));
  assert.equal(workshopOverview(duplicateReport, "image")[0].question, "Is it authentic?");
  assert.equal(workshopOverview(duplicateReport, "image")[1].question, "Who made it? When and where was it made?");
  assert.equal(workshopOverview(duplicateReport, "image").at(-1).question, "What evidence supports its claim?");
  const historyWith = (raw, status = "ok") => workshopOverview({ ...original, providers: [{ ...c2pa, status, raw: { ...c2pa.raw, ...raw } }] }, "image")[1];
  for (const status of ["error", "timeout", "disabled", "pending", "unconfigured"]) {
    const row = historyWith({}, status);
    assert.match(row.finding, new RegExp(checkStatus({ status }).toLowerCase()));
    assert.doesNotMatch(JSON.stringify(row), /Fixture signer|AI-generated content/);
  }
  const absent = historyWith({ validation: { integrity: "absent" } });
  assert.doesNotMatch(JSON.stringify(absent), /Fixture signer|AI-generated content/);
  assert.match(absent.detail, /No embedded Content Credentials/);
  const invalid = historyWith({ validation: { integrity: "invalid", trust: "trusted", complete: false } });
  assert.match(invalid.detail, /failed.*could not be confirmed/);
  assert.equal(invalid.answers[2].answer, "The record declares AI-generated content.");
  const trusted = historyWith({ validation: { integrity: "valid", trust: "trusted", complete: true, policy_approved: true } });
  assert.match(trusted.detail, /signer meets SDA's trust policy/);
  assert.match(historyWith({ validation: { integrity: "valid", trust: "trusted", complete: false } }).detail, /yet to establish trust/);
  assert.match(historyWith({ validation: { integrity: "unknown" } }).detail, /incomplete/);
  for (const declared_verdict of ["partially_synthetic", "authentic_likely"]) assert.match(historyWith({ declared_verdict }).answers[2].answer, /record declares/);
  const scoped = historyWith({ declared_verdict: "inconclusive", scoped_source_types: ["trainedAlgorithmicMedia"] });
  assert.match(scoped.answers[2].answer, /parts or actions.*whole file.*open/);
  assert.match(historyWith({ declared_verdict: "inconclusive", declaration: { malformed: true }, history: [null, {}, "bad"] }).answers[2].answer, /no clear creation-method/);
  const legacy = historyWith({ declared_verdict: undefined, declaration: "A legacy recorded statement.", history: undefined });
  assert.equal(legacy.answers[2].answer, "The record says: A legacy recorded statement.");
  assert.doesNotMatch(legacy.answers[0].answer, /Fixture signer/);
  assert.match(workshopOverview(null, "image")[1].finding, /not checked/);
  assert.match(workshopOverview({ ...original, providers: [c2pa] }, "video")[1].answers[2].answer, /Soundtrack-specific coverage/);
  assert.equal(JSON.stringify(duplicateReport), duplicateBefore, "Plain-language history leaves the stored report untouched");
  const panel = ["claude", "openai", "gemini"].map((id, i) => ({ ...vision, id, name: id, model: `model-${i}`, evidence: [], summary: "Fixture reading", raw: {}, rating: [90,82,72][i] }));
  const agreed = { ...original, providers: [...panel, c2pa, { ...vision, id: "local", kind: "forensic" }] };
  const agreedBefore = JSON.stringify(agreed);
  assert.equal(assessmentModels(agreed).length, 3);
  assert.equal(modelReadingSummary(agreed), "3 visual models (Claude, OpenAI and Google Gemini) agree this is likely synthetic. Compare these readings with the source and context.");
  assert.match(modelReadingSummary({ ...original, providers: [panel[0], { ...panel[1], status: "timeout" }] }), /^1 of 2 visual model checks completed\. 1 visual model \(Claude\) leans/);
  assert.doesNotMatch(modelReadingSummary({ ...original, providers: [panel[0], { ...panel[1], status: "timeout" }] }), /OpenAI|agree/);
  for (const status of ["error", "timeout", "disabled", "pending", "unconfigured"]) {
    assert.match(modelReadingSummary({ ...original, providers: [{ ...panel[0], status }] }), /No visual model checks completed/);
  }
  assert.match(modelReadingSummary(original), /No visual model checks are recorded/);
  const mixed = { ...original, providers: [panel[0], { ...panel[1], verdict: "authentic_likely" }] };
  assert.match(modelReadingSummary(mixed), /mixed findings/);
  for (const verdict of ["authentic_likely", "partially_synthetic", "inconclusive", "not_applicable"]) {
    const wording = modelReadingSummary({ ...original, providers: panel.map(p => ({ ...p, verdict })) });
    assert.doesNotMatch(wording, /agree this is likely synthetic/);
    assert.match(wording, /Compare these readings with the source and context/);
  }
  const transcript = { ...agreed, meta: { ...agreed.meta, kind: "audio", frame_count: 0 }, providers: panel.map(p => ({ ...p, kind: "analysis" })) };
  assert.match(modelReadingSummary(transcript), /3 models.*recording’s transcript.*generated or altered wording/);
  assert.doesNotMatch(modelReadingSummary(transcript), /visual|music|soundtrack/);
  assert.match(assessmentTitle(transcript), /recording’s transcript/);
  assert.match(assessmentScope({ ...transcript, meta: { ...transcript.meta, notes: ["Transcript analysis used the first 12000 characters of a fresh 25985-character transcription"] } }), /first 12,000 characters.*25,985-character transcript/);
  assert.match(assessmentScope(transcript), /AI-origin detection from the sound itself is outside this workflow/);
  assert.match(workshopOverview(transcript, "audio")[0].label, /Transcript clues/);
  for (const verdict of ["synthetic_likely", "authentic_likely", "partially_synthetic", "inconclusive", "not_applicable"]) assert.match(assessmentTitle({ ...transcript, consensus: { ...transcript.consensus, overall_verdict: verdict } }), /transcript/);
  assert.match(modelReadingSummary({ ...agreed, meta: { ...agreed.meta, kind: "video", frame_count: 4 } }), /lean towards synthetic content/);
  assert.doesNotMatch(modelReadingSummary({ ...agreed, meta: { ...agreed.meta, kind: "video", frame_count: 4 } }), /agree this is likely synthetic/);
  assert.equal(JSON.stringify(agreed), agreedBefore, "Named model summary must not rewrite the research verdict or providers");
  const videoReport = { ...original, meta: { ...original.meta, kind: "video" }, audio_inspection: { status: "present", stream_count: 1, tracks: [] },
    suno_check: { status: "ok", verdict: "no_suno_provenance", note: "Vendor returned no Suno provenance." } };
  const audioRows = workshopOverview(videoReport, "video");
  assert.equal(audioRows.find(row => row.label === "Soundtrack").finding, "Audio track found");
  assert.equal(audioRows.find(row => row.label === "Sound description").finding, "Not checked");
  assert.equal(audioRows.find(row => row.label === "Suno credentials").finding, "No Suno provenance reported");
  assert.doesNotMatch(JSON.stringify(audioRows), /Human-made|AI-made music/);
  const optedIn = communitySummary(original, "", "", false, response);
  assert.match(optedIn, /## Workshop responses/);
  assert.match(optedIn, /Later view: Not sure yet/);
  assert.match(optedIn, /Next actions: Pause before sharing/);
  assert.doesNotMatch(optedIn, /<script>/);
  assert.doesNotMatch(communitySummary(original, "", "", false), /## Workshop responses|Small visual details/);
  response.sourceSearchNote = "<img onerror=alert(1)> Search lead; creator not established.";
  const sourceNote = communitySummary(original, "", "", false, response);
  assert.match(sourceNote, /Image-search evidence \(participant note\)/);
  assert.doesNotMatch(sourceNote, /(?<!\\)<img/);
  assert(sourceNote.includes("\\<img onerror=alert(1)\\>"));
  assert.doesNotMatch(communitySummary(original, "", "", false), /Search lead|onerror/);
  assert.equal(emptyWorkshopResponses().sourceSearchNote, "");
  response.impressionAfterChecks = true;
  assert.match(communitySummary(original, "", "", false, response), /chosen after SDA findings were available/);
  assert.equal(JSON.stringify(original), before, "Workshop helpers must not change the research record");
  console.log("Community presentation helpers passed: four activities, coverage summaries, statuses, provenance, opt-in responses, escaping and report immutability.");
} finally { await server.close(); }
