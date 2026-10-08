import communityIllustration from "./assets/community-illustration.png";
import { useSlidePreview } from "./useSlidePreview";
import { useEffect, useRef, useState } from "react";
import { analyse, analyseDeep, annotate, corpusFileUrl, downloadFrameImage, exampleThumb, fetchExampleFile, getCorpus, getExamples, getProviders } from "./api";
import { SHOWCASE, CONFERENCE, EXAMPLES_ONLY, showcaseBakedAt, showcaseReport, WORKSHOP_STARTER_NAME } from "./showcase";
import type { CorpusInfo, ExampleEntry, ProvidersInfo, Report } from "./types";
import Header from "./components/Header";
import FacilitatorGuide from "./components/FacilitatorGuide";
import GameView, { type GameMode } from "./components/GameView";
import InputPanel from "./components/InputPanel";
import Results from "./components/Results";
import BatchQueue, { type QueueItem } from "./components/BatchQueue";
import BatchResults, { type BatchRow } from "./components/BatchResults";
import DiffusionPanel from "./components/DiffusionPanel";
import Footer from "./components/Footer";
import CommunityView from "./components/CommunityView";
import PresentationSwitcher from "./components/PresentationSwitcher";
import type { Presentation, WorkshopStep } from "./community";

const MAX_QUEUE = 10;
const MAX_SELECT = 5;

export default function App() {
  const [presentation, setPresentation] = useState<Presentation>(() => {
    const linked = window.location.hash.slice(1);
    if (linked === "game" || linked === "game-dev") return "game";
    return linked === "developer" || linked === "community" || linked === "facilitator" ? linked
      : window.location.pathname.endsWith("/facilitator.html") ? "facilitator" : "community";
  });
  const [graphOpen, setGraphOpen] = useState(false);
  const [communityStep, setCommunityStep] = useState<WorkshopStep>("notice");
  const [communityOpinionTarget, setCommunityOpinionTarget] = useState<HTMLDivElement | null>(null);
  const developer = presentation === "developer";
  const guide = presentation === "facilitator";
  const game = presentation === "game";
  const [gameMode, setGameMode] = useState<GameMode>(() => window.location.hash === "#game-dev" ? "dev" : "demo");
  useEffect(() => {
    function followTabLink() {
      const linked = window.location.hash.slice(1);
      if (linked === "game" || linked === "game-dev") { setPresentation("game"); setGameMode(linked === "game-dev" ? "dev" : "demo"); }
      else if (linked === "developer" || linked === "community" || linked === "facilitator") setPresentation(linked);
    }
    window.addEventListener("hashchange", followTabLink);
    return () => window.removeEventListener("hashchange", followTabLink);
  }, []);
  function changePresentation(next: Presentation) {
    setPresentation(next);
    if (next === "game") setGameMode("demo");
    window.history.replaceState(null, "", `#${next}`);
  }
  function changeGameMode(next: GameMode) {
    setGameMode(next);
    window.history.replaceState(null, "", next === "dev" ? "#game-dev" : "#game");
  }
  useEffect(() => {
    document.documentElement.dataset.presentation = presentation;
    document.querySelectorAll<HTMLMediaElement>(".presentation-shell video, .presentation-shell audio").forEach(media => {
      if (media.closest("[hidden]")) media.pause();
    });
    return () => { delete document.documentElement.dataset.presentation; };
  }, [presentation]);
  const [providers, setProviders] = useState<ProvidersInfo | null>(null);
  const [corpus, setCorpus] = useState<CorpusInfo | null>(null);
  const [examples, setExamples] = useState<ExampleEntry[]>([]);
  const [mode, setMode] = useState<"general" | "vaccine">("general");
  const [file, setFile] = useState<File | null>(null);
  const [corpusPath, setCorpusPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  // Pre-run visual for an example the browser cannot render itself (PDF, PPTX,
  // audio). Audio keeps its selected cover artwork when recorded findings open.
  const [previewThumb, setPreviewThumb] = useState<string | null>(null);
  const slidePreview = useSlidePreview(file,corpusPath,previewName,previewThumb);
  const [caption, setCaption] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [batchResults, setBatchResults] = useState<BatchRow[] | null>(null);
  const [batchRunId, setBatchRunId] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [notesRevision, setNotesRevision] = useState(0);
  const notesChanged = () => setNotesRevision((n) => n + 1);
  const [status, setStatus] = useState("");
  const [busyKind, setBusyKind] = useState<"single" | "batch" | null>(null);
  const profileMismatch = !SHOWCASE && providers != null && (CONFERENCE !== (providers.delivery_profile === "conference"));
  const busy = busyKind !== null || profileMismatch;
  const [view, setView] = useState<"research" | "public">("research");
  const objectUrl = useRef<string | null>(null);
  const selectionVersion = useRef(0);
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleLoadProgress, setExampleLoadProgress] = useState<{ done: number; total: number } | null>(null);
  const [loadingExampleName, setLoadingExampleName] = useState("");
  const [exampleLoadError, setExampleLoadError] = useState("");
  const [conferenceConsent, setConferenceConsent] = useState(false);
  useEffect(() => { setConferenceConsent(false); }, [file, mode, providers, busyKind]);

  useEffect(() => {
    getProviders()
      .then((p) => {
        setProviders(p);
        setView(p.dev_mode ? "research" : "public");
      })
      .catch(() => undefined);
    getCorpus().then(setCorpus).catch(() => undefined);
    getExamples().then(setExamples).catch(() => undefined);
  }, []);

  function revoke() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }

  // ── Single-file selection ──────────────────────────────────────────────────
  function selectFile(f: File | null) {
    if (!f || busy || deepBusy) return;
    selectionVersion.current += 1;
    setExampleLoading(false);
    setExampleLoadError("");
    revoke();
    setBatchResults(null);
    const url = URL.createObjectURL(f);
    objectUrl.current = url;
    setFile(f);
    setCorpusPath(null);
    setPreviewUrl(url);
    setPreviewName(f.name);
    setPreviewThumb(null);
    setReport(null);
    setStatus(""); // never carry "Done in Xs" (or an old error) onto a new file
  }

  function startCommunitySession() {
    if (busy || deepBusy || exampleLoading) return;
    selectionVersion.current += 1;
    revoke();
    setFile(null);
    setCorpusPath(null);
    setPreviewUrl(null);
    setPreviewName("");
    setPreviewThumb(null);
    setReport(null);
    setBatchResults(null);
    queue.forEach(item => URL.revokeObjectURL(item.url));
    setQueue([]);
    setBatchTotal(0);
    setConferenceConsent(false);
    setExampleLoadError("");
    setCaption("");
    setStatus("");
  }

  function selectCorpus(path: string, name: string) {
    if (busy || deepBusy) return;
    selectionVersion.current += 1;
    setExampleLoading(false);
    setExampleLoadError("");
    revoke();
    setBatchResults(null);
    setFile(null);
    setCorpusPath(path);
    setPreviewUrl(corpusFileUrl(path));
    setPreviewName(name);
    setPreviewThumb(null);
    setReport(null);
    setStatus("");
  }

  async function selectExample(name: string) {
    if (busy || deepBusy || exampleLoading) return;
    setConferenceConsent(false);
    if (name === WORKSHOP_STARTER_NAME) {
      selectionVersion.current += 1;
      revoke();
      setFile(null); setCorpusPath(null); setPreviewUrl(null); setPreviewName(""); setPreviewThumb(null);
      setReport(null); setBatchResults(null); setCaption(""); setStatus(""); setExampleLoadError("");
      return;
    }
    let request = ++selectionVersion.current;
    setLoadingExampleName(name);
    setExampleLoadError("");
    setExampleLoading(true);
    setStatus("");
    try {
      const example = await fetchExampleFile(name);
      if (request !== selectionVersion.current) return;
      selectFile(example);
      request = selectionVersion.current;
      // Keep the loading state through artwork preparation as well as transfer.
      setExampleLoading(true);
      const thumb = await exampleThumb(name, example);
      if (request === selectionVersion.current) setPreviewThumb(thumb);
    } catch {
      if (request === selectionVersion.current) {
        setExampleLoadError(`Could not load ${name}. Please try selecting it again.`);
      }
    } finally {
      if (request === selectionVersion.current) setExampleLoading(false);
    }
  }

  async function runAnalysis() {
    if (CONFERENCE && !conferenceConsent) { setStatus("Confirm the conference processing disclosure above first."); return; }
    const openingWorkshop = SHOWCASE && !file && !corpusPath;
    if ((!file && !corpusPath && !openingWorkshop) || deepBusy || busy || exampleLoading) return;
    const selected = selectionVersion.current;
    setBusyKind("single");
    setReport(null);
    setBatchResults(null);
    setStatus(SHOWCASE ? "Opening recorded findings…" : "Running the configured checks…");
    try {
      const data = openingWorkshop ? await showcaseReport(WORKSHOP_STARTER_NAME)
        : await analyse({ file, corpusPath, caption: caption.trim(), mode });
      if (selected !== selectionVersion.current) return;
      setReport(data);
      setStatus(SHOWCASE ? "Recorded findings opened. The analysis date is retained in the report." : `Done in ${(data.meta.elapsed_ms / 1000).toFixed(1)}s.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setBusyKind(null);
    }
  }

  const [deepBusy, setDeepBusy] = useState(false);

  // One-click "download this frame as an image for Gemini": re-extracts the
  // exact analysed frame locally (no API spend) so external SynthID checks -
  // which refuse PDF/PPTX containers - get the right standalone image.
  async function downloadFrame(label: string) {
    if (!file) return;
    const ok = await downloadFrameImage(file, label);
    setStatus(ok
      ? `Saved ${label} as an image - attach it to Gemini's SynthID check.`
      : `Could not re-extract ${label} from this file.`);
  }

  // Incremental deep pass: only the frames the capped run skipped are analysed,
  // then the verdict is recombined over the full set. Needs the original File
  // (the server is stateless), so it is offered for uploads and examples only.
  async function runDeepPass() {
    if (!file || !report || deepBusy || busy || exampleLoading) return;
    const selected = selectionVersion.current;
    setDeepBusy(true);
    const extra = (report.meta.frames_found ?? 0) - report.meta.frame_count;
    setStatus(`Deep pass: analysing ${extra > 0 ? extra : "the remaining"} more frame(s)...`);
    try {
      const merged = await analyseDeep({ file, caption: caption.trim(), mode, prior: report });
      if (selected !== selectionVersion.current) return;
      setReport(merged);
      setStatus(`Deep pass done in ${(merged.meta.elapsed_ms / 1000).toFixed(1)}s - ` +
        `${merged.meta.frame_count} frame(s) now analysed.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Deep pass failed.");
    } finally {
      setDeepBusy(false);
    }
  }

  // ── Batch holding cell ─────────────────────────────────────────────────────
  function addToQueue(files: File[]) {
    if (EXAMPLES_ONLY) return;
    if (busy || deepBusy || exampleLoading) return;
    const room = MAX_QUEUE - queue.length;
    if (files.length > room) {
      setStatus(`The queue holds ${MAX_QUEUE} files: added ${Math.max(room, 0)}, `
        + `left out ${files.length - Math.max(room, 0)}.`);
    }
    setQueue((q) => {
      const items = files.slice(0, Math.max(MAX_QUEUE - q.length, 0)).map((f) => ({
        id: crypto.randomUUID(), file: f, url: URL.createObjectURL(f), selected: false,
      }));
      return [...q, ...items];
    });
  }

  async function addExamplesToQueue(names: string[]): Promise<string[]> {
    if (busy || deepBusy || exampleLoading) return names;
    const chosen = [...new Set(names)].filter(name => examples.some(e => e.name === name)
      && !queue.some(q => q.file.name === name)).slice(0, Math.max(MAX_QUEUE - queue.length, 0));
    if (!chosen.length) return [];
    setExampleLoadProgress({ done: 0, total: chosen.length });
    setLoadingExampleName(`${chosen.length} batch example${chosen.length === 1 ? "" : "s"}`);
    setExampleLoading(true); setExampleLoadError(""); setStatus(""); setConferenceConsent(false);
    try {
      const loaded = await Promise.allSettled(chosen.map(async name => {
        try { return await fetchExampleFile(name); }
        finally { setExampleLoadProgress(progress => progress ? { ...progress, done: progress.done + 1 } : null); }
      }));
      let slots = MAX_SELECT - queue.filter(item => item.selected).length;
      const items: QueueItem[] = [];
      const failed: string[] = [];
      loaded.forEach((result, i) => {
        if (result.status === "fulfilled") {
          items.push({ id: crypto.randomUUID(), file: result.value,
            url: URL.createObjectURL(result.value), selected: slots-- > 0 });
        } else failed.push(chosen[i]);
      });
      setQueue(q => [...q, ...items]);
      if (failed.length) setExampleLoadError(`Could not load ${failed.join(", ")}. They remain selected so you can try again.`);
      return failed;
    } finally { setExampleLoading(false); setExampleLoadProgress(null); }
  }

  function clearBatch() {
    if (busy || deepBusy || exampleLoading) return;
    if (!window.confirm("Clear the batch and its session notes? Download any notes you want to keep first.")) return;
    queue.forEach(item => URL.revokeObjectURL(item.url));
    setQueue([]); setBatchResults(null); setBatchTotal(0); setConferenceConsent(false);
  }

  function toggleSelect(id: string) {
    if (busy || deepBusy) return;
    setConferenceConsent(false);
    setQueue((q) => {
      const selected = q.filter((x) => x.selected).length;
      return q.map((x) =>
        x.id !== id || x.run ? x
          : x.selected ? { ...x, selected: false }
          : selected < MAX_SELECT ? { ...x, selected: true } : x);
    });
  }

  function selectAll() {
    if (busy || deepBusy) return;
    setConferenceConsent(false);
    setQueue((q) => {
      let count = q.filter((x) => x.selected).length;
      return q.map((x) => {
        if (x.run || x.selected || count >= MAX_SELECT) return x;
        count += 1;
        return { ...x, selected: true };
      });
    });
  }

  function deselectAll() {
    if (busy || deepBusy) return;
    setConferenceConsent(false);
    setQueue((q) => q.map((x) => (x.selected ? { ...x, selected: false } : x)));
  }

  function removeFromQueue(id: string) {
    if (busy || deepBusy) return;
    setConferenceConsent(false);
    setQueue((q) => {
      const it = q.find((x) => x.id === id);
      if (it && !batchResults?.some((row) => row.url === it.url)) URL.revokeObjectURL(it.url);
      return q.filter((x) => x.id !== id);
    });
  }

  async function runBatch() {
    if (CONFERENCE && !conferenceConsent) { setStatus("Confirm the conference processing disclosure above first."); return; }
    const selected = queue.filter((x) => x.selected);
    if (!selected.length || busy || deepBusy || exampleLoading) return;
    setBusyKind("batch");
    setReport(null);
    // Accumulate across runs: keep earlier results, append the new ones.
    const rows: BatchRow[] = [...(batchResults ?? [])];
    setBatchTotal(rows.length + selected.length);
    setBatchResults([...rows]);
    setBatchRunId(id => id + 1);
    const okIds = new Set<string>();
    for (let i = 0; i < selected.length; i++) {
      const it = selected[i];
      setStatus(`${SHOWCASE ? "Opening recorded result" : "Analysing"} ${i + 1} of ${selected.length}: ${it.file.name}`);
      try {
        const data = await analyse({ file: it.file, caption: caption.trim(), mode });
        rows.push({ name: it.file.name, file: it.file, url: it.url, report: data });
        okIds.add(it.id);
      } catch (err) {
        rows.push({ name: it.file.name, url: it.url, error: err instanceof Error ? err.message : "failed" });
      }
      setBatchResults([...rows]);
    }
    // Mark only the SUCCESSFUL ones as run - a failed file stays selectable so
    // it can be retried without re-adding it.
    setQueue((q) => q.map((x) => (
      okIds.has(x.id) ? { ...x, run: true, selected: false }
        : x.selected ? { ...x, selected: false } : x)));
    const failed = selected.length - okIds.size;
    setStatus(`Batch complete: ${okIds.size} ${SHOWCASE ? "recorded results opened" : "analyses completed"}; ${rows.length} entries this session.`
      + (!EXAMPLES_ONLY && devMode ? " Reports saved to dev_runs/." : "")
      + (failed ? ` ${failed} failed; select those queue entries to retry.` : ""));
    setBusyKind(null);
  }

  const vaccineEnabled = providers?.vaccine_lens ?? false;
  const devMode = providers?.dev_mode ?? false;
  const showCorpus = !EXAMPLES_ONLY && devMode && view === "research";
  const showBatch = EXAMPLES_ONLY || showCorpus;
  const batchItems = showBatch
    ? (batchResults ?? []).filter((r) => r.report).map((r) => ({ report: r.report!, url: r.url }))
    : [];
  const singleBatch = batchItems.length === 1 ? batchItems[0] : null;

  const [baked, setBaked] = useState<{ date: string; models: string[] } | null>(null);
  useEffect(() => { if (SHOWCASE) showcaseBakedAt().then(setBaked).catch(() => undefined); }, []);

  return (
    <div className="presentation-shell" data-view={presentation}
      onDragOver={EXAMPLES_ONLY ? e => e.preventDefault() : undefined}
      onDrop={EXAMPLES_ONLY ? e => { e.preventDefault(); setStatus("Choose a prepared example from the list."); } : undefined}>
      {!SHOWCASE && <div className="showcase-banner" role="note"><strong>{CONFERENCE ? "Conference — live analysis" : "Research app — live analysis"}</strong>
        {EXAMPLES_ONLY && <span> · Prepared examples only</span>}
        {CONFERENCE && <><p>The server processes its listed originals. Fresh provider calls use the server's configured API accounts; reports are returned to this browser without research-run storage.</p>
          <label><input type="checkbox" checked={conferenceConsent} disabled={busy || exampleLoading || !providers}
            onChange={e => setConferenceConsent(e.target.checked)} /> I agree to send the selected example or batch: images/sampled frames and extracted text to the enabled Anthropic, OpenAI and Google services. Audio transcription may send the complete audio to Google or OpenAI. Provider terms and charges apply.</label>
          <p>Enabled vision services: {providers ? [["Anthropic", providers.claude], ["OpenAI", providers.openai], ["Google", providers.gemini]].filter(([, p]) => typeof p !== "string" && p.configured).map(([name]) => String(name)).join(", ") || "None" : "Checking…"}. Saved fallback: {import.meta.env.VITE_CONFERENCE_FALLBACK ? <a href={import.meta.env.VITE_CONFERENCE_FALLBACK} target="_blank" rel="noreferrer">open recorded examples</a> : "open the separately prepared saved-results site using the conference runbook."}</p></>}
      </div>}
      {profileMismatch && <p role="alert">The frontend and backend delivery profiles differ. Start the matching conference or research build before continuing.</p>}
      <PresentationSwitcher value={presentation} onChange={changePresentation} disabled={busy || deepBusy || exampleLoading} />
      {exampleLoading && <div className="example-loading" role="status" aria-live="polite" aria-atomic="true">
        <span className="loading-spinner" aria-hidden="true" /><div><strong>Loading {loadingExampleName}…</strong><span>{exampleLoadProgress ? `${exampleLoadProgress.done} of ${exampleLoadProgress.total} files loaded` : "Preparing the media preview. Larger files may take a moment."}</span></div>
      </div>}
      {busyKind === "batch" && <div className="example-loading batch-loading" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" /><strong>{status || "Preparing batch results…"}</strong></div>}
      {exampleLoadError && <p className="example-load-error" role="alert">{exampleLoadError}</p>}
      {guide && <FacilitatorGuide />}
      {game && <GameView mode={gameMode} onMode={changeGameMode} />}
      <div hidden={!developer}>
      <Header
        providers={providers}
        devMode={devMode}
        view={view}
        onToggleView={() => { if (!busy && !deepBusy) setView((v) => (v === "research" ? "public" : "research")); }}
      />
      </div>
      <main className={developer ? "layout" : "community-layout"} hidden={guide || game}>
        <div className="left-col" hidden={!developer}>
          <details className="single-item-choice" open={batchResults === null}>
          <summary hidden={batchResults === null}>Choose a single item</summary>
          {batchResults !== null && <p className="batch-input-context">The preview below belongs to the single-item workspace. Batch previews appear with their result rows.</p>}
          <InputPanel
            mode={mode}
            setMode={setMode}
            vaccineEnabled={vaccineEnabled}
            onSelectFile={EXAMPLES_ONLY ? () => undefined : selectFile}
            onSelectCorpus={selectCorpus}
            previewUrl={previewUrl}
            previewName={previewName}
            caption={caption}
            setCaption={setCaption}
            onAnalyse={runAnalysis}
            busy={busy || deepBusy || exampleLoading}
            running={busyKind === "single"}
            status={status}
            corpus={showCorpus ? corpus : null}
            examples={examples}
            onSelectExample={selectExample}
            hasInput={Boolean(file || corpusPath)}
            allowUpload={!EXAMPLES_ONLY}
            reportThumb={previewThumb ?? report?.meta.thumbnail ?? undefined}
            thumbIsPreview={Boolean(previewThumb)}
            slidePreview={slidePreview}
          />
          </details>
          {showBatch && (
            <BatchQueue
              queue={queue}
              onAdd={addToQueue}
              examples={examples}
              onExamples={addExamplesToQueue}
              onClear={clearBatch}
              onToggle={toggleSelect}
              onRemove={removeFromQueue}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onRun={runBatch}
              busy={busy || deepBusy || exampleLoading}
              running={busyKind === "batch"}
            />
          )}
        </div>
        <div className="community-host" hidden={developer}>
          <CommunityView key={previewUrl ?? corpusPath ?? "no-selection"}
            active={!developer && !guide && !game} trainer={presentation === "trainer"} report={report} providers={providers} examples={examples}
            slidePreview={slidePreview}
            name={previewName} url={previewUrl} thumbnail={previewThumb ?? undefined}
            hasInput={Boolean(file || corpusPath)} busy={busy || deepBusy || exampleLoading}
            running={busyKind === "single"} status={status} caption={caption} onCaption={setCaption}
            mode={mode} onMode={setMode} onFile={EXAMPLES_ONLY ? () => undefined : selectFile} onExample={selectExample} onAnalyse={runAnalysis}
            onNewSession={startCommunitySession} sourceFile={file ?? undefined} onReportChange={notesChanged}
            onSecondOpinionTarget={setCommunityOpinionTarget} onStepChange={setCommunityStep}
            onFrameDownload={EXAMPLES_ONLY || !file ? undefined : downloadFrame}
          />
        </div>
        <div className="shared-research-results" hidden={!developer}>
        <div id="research-evidence" className="research-evidence">
        {batchResults !== null && showBatch ? (
          <BatchResults rows={batchResults} total={batchTotal} onNotesChange={notesChanged} scrollRequest={SHOWCASE ? batchRunId : 0} />
        ) : (
          <Results
            key={report?.meta.report_id ?? report?.meta.generated_at ?? "no-report"}
            report={report}
            community={!developer}
            secondOpinionTarget={developer ? null : communityOpinionTarget}
            sourceFile={file ?? undefined}
            onNotesChange={notesChanged}
            previewName={previewName}
            imageUrl={previewUrl ?? undefined}
            originalUrl={SHOWCASE && !file && !corpusPath ? communityIllustration : EXAMPLES_ONLY ? examples.find(e => e.name === previewName)?.downloadUrl ?? previewUrl ?? undefined : previewUrl ?? undefined}
            demo={EXAMPLES_ONLY}
            onOpenSaved={SHOWCASE && developer && (file || corpusPath) ? runAnalysis : undefined}
            savedBusy={busy || deepBusy || exampleLoading}
            savedLoading={busyKind === "single"}
            onDeepPass={EXAMPLES_ONLY || !file ? undefined : runDeepPass}
            deepBusy={deepBusy}
            onFrameDownload={EXAMPLES_ONLY || !file ? undefined : downloadFrame}
            onAnnotate={EXAMPLES_ONLY || !file
              ? undefined
              : () => annotate(file, caption.trim())}
          />
        )}
        </div>
        </div>
      </main>
      <details className="shared-graph" hidden={guide || game || (!developer && communityStep !== "check" && communityStep !== "reflect")} open={developer || graphOpen}
        onToggle={e => { if (!developer) setGraphOpen(e.currentTarget.open); }}>
        <summary hidden={developer}>How the findings connect</summary>
        <div className="diffusion-wrap">
        <DiffusionPanel
          demo={SHOWCASE || !showBatch}
          currentReport={report ?? singleBatch?.report ?? null}
          currentUrl={report ? previewUrl ?? undefined : singleBatch?.url}
          notesRevision={SHOWCASE ? 0 : notesRevision}
          batchItems={batchItems}
        />
      </div>
      </details>
      <Footer devMode={providers?.dev_mode} game={game} />
    </div>
  );
}
