import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import type { Report } from "../types";
import { scoreOpinion } from "../api";
import { HIDE_SECOND_OPINION, SHOWCASE, EXAMPLES_ONLY } from "../showcase";
import CredentialSummary from "./CredentialSummary";
import ConsensusBanner from "./ConsensusBanner";
import ProviderTable from "./ProviderTable";
import DecisionPanel from "./DecisionPanel";
import SecondOpinion from "./SecondOpinion";
import AnnotationLane from "./AnnotationLane";
import Extras from "./Extras";
import AudioPanel from "./AudioPanel";
import type { AnnotateResult } from "../api";

import { sessionNotes, updateSessionNotes } from "../sessionNotes";

interface Meta { score: number | null; read: string; loading: boolean }

export default function Results(
  { report, previewName, imageUrl, originalUrl, demo = false, onDeepPass, deepBusy = false, onFrameDownload,
    onAnnotate, onNotesChange, sourceFile, secondOpinionTarget, community = false, onOpenSaved, savedBusy = false, savedLoading = false }:
    { report: Report | null; previewName: string; imageUrl?: string; originalUrl?: string; demo?: boolean;
      onDeepPass?: () => void; deepBusy?: boolean; onFrameDownload?: (label: string) => void;
      onAnnotate?: () => Promise<AnnotateResult>; onNotesChange?: () => void; sourceFile?: File; secondOpinionTarget?: HTMLElement | null; community?: boolean;
      onOpenSaved?: () => void; savedBusy?: boolean; savedLoading?: boolean },
) {
  const tabId = useId();
  const [mediaTab, setMediaTab] = useState<"visual" | "audio">("visual");
  // Pasted second-opinion text is held here (one box per LLM) so the paste boxes
  // and the Extras display stay in sync, while also being written onto the
  // report for tagged exports.
  const [gemini, setGemini] = useState((SHOWCASE ? sessionNotes(report).gemini : report?.second_opinion_gemini) ?? "");
  const [chatgpt, setChatgpt] = useState((SHOWCASE ? sessionNotes(report).openai : report?.second_opinion_chatgpt) ?? "");
  const initMeta = (read?: string, score?: number): Meta | null =>
    read || score != null ? { score: score ?? null, read: read ?? "", loading: false } : null;
  const [gemMeta, setGemMeta] = useState<Meta | null>(
    SHOWCASE ? null : initMeta(report?.second_opinion_gemini_read, report?.second_opinion_gemini_score));
  const [gptMeta, setGptMeta] = useState<Meta | null>(
    SHOWCASE ? null : initMeta(report?.second_opinion_chatgpt_read, report?.second_opinion_chatgpt_score));
  // Tri-state fresh-session attestation per note (true/false/undefined). Held
  // as state for re-render and written onto the report for exports, like the
  // note text itself.
  const [gemFresh, setGemFresh] = useState<boolean | undefined>(
    (SHOWCASE ? sessionNotes(report).geminiFresh : report?.second_opinion_gemini_fresh_session));
  const [gptFresh, setGptFresh] = useState<boolean | undefined>(
    (SHOWCASE ? sessionNotes(report).openaiFresh : report?.second_opinion_chatgpt_fresh_session));
  // Identity of the report currently on screen, so an in-flight score can
  // never land on (or display against) a different analysis - the ghost class.
  const latestReport = useRef<Report | null>(report);
  useEffect(() => {
    latestReport.current = report;
    setMediaTab("visual");
    setGemini((SHOWCASE ? sessionNotes(report).gemini : report?.second_opinion_gemini) ?? "");
    setChatgpt((SHOWCASE ? sessionNotes(report).openai : report?.second_opinion_chatgpt) ?? "");
    setGemMeta(SHOWCASE ? null : initMeta(report?.second_opinion_gemini_read, report?.second_opinion_gemini_score));
    setGptMeta(SHOWCASE ? null : initMeta(report?.second_opinion_chatgpt_read, report?.second_opinion_chatgpt_score));
    setGemFresh((SHOWCASE ? sessionNotes(report).geminiFresh : report?.second_opinion_gemini_fresh_session));
    setGptFresh((SHOWCASE ? sessionNotes(report).openaiFresh : report?.second_opinion_chatgpt_fresh_session));
    gemScored.current = (SHOWCASE ? sessionNotes(report).gemini : report?.second_opinion_gemini) ?? "";
    gptScored.current = (SHOWCASE ? sessionNotes(report).openai : report?.second_opinion_chatgpt) ?? "";
  }, [report]);

  const gemRevision = useRef(0);
  const gptRevision = useRef(0);

  function updateGemini(v: string) {
    if (SHOWCASE && report) {
      setGemini(v); updateSessionNotes(report, { gemini: v, ...(!v.trim() ? { geminiFresh: undefined } : {}) });
      if (!v.trim()) setGemFresh(undefined);
      onNotesChange?.(); return;
    }
    gemRevision.current += 1;
    gemScored.current = "";
    setGemMeta(null);
    if (report) {
      report.second_opinion_gemini_score = undefined;
      report.second_opinion_gemini_read = undefined;
    }
    setGemini(v);
    if (report) report.second_opinion_gemini = v.trim() ? v.trim() : undefined;
    // An attestation describes a specific pasted note; clearing the note
    // clears it rather than letting it silently describe a later paste.
    if (!v.trim()) {
      setGemFresh(undefined);
      if (report) report.second_opinion_gemini_fresh_session = undefined;
    }
    onNotesChange?.();
  }
  function updateChatgpt(v: string) {
    if (SHOWCASE && report) {
      setChatgpt(v); updateSessionNotes(report, { openai: v, ...(!v.trim() ? { openaiFresh: undefined } : {}) });
      if (!v.trim()) setGptFresh(undefined);
      onNotesChange?.(); return;
    }
    gptRevision.current += 1;
    gptScored.current = "";
    setGptMeta(null);
    if (report) {
      report.second_opinion_chatgpt_score = undefined;
      report.second_opinion_chatgpt_read = undefined;
    }
    setChatgpt(v);
    if (report) report.second_opinion_chatgpt = v.trim() ? v.trim() : undefined;
    if (!v.trim()) {
      setGptFresh(undefined);
      if (report) report.second_opinion_chatgpt_fresh_session = undefined;
    }
    onNotesChange?.();
  }
  function updateGeminiFresh(v: boolean | undefined) {
    setGemFresh(v);
    if (SHOWCASE && report) updateSessionNotes(report, { geminiFresh: v });
    else if (report) report.second_opinion_gemini_fresh_session = v;
    onNotesChange?.();
  }
  function updateChatgptFresh(v: boolean | undefined) {
    setGptFresh(v);
    if (SHOWCASE && report) updateSessionNotes(report, { openaiFresh: v });
    else if (report) report.second_opinion_chatgpt_fresh_session = v;
    onNotesChange?.();
  }

  // Only an explicit user action sends a pasted note to Haiku. Store the result
  // it on the report so it flows into the exports and the diffusion graph. A
  // per-box ref avoids re-calling on an unchanged note.
  const gemScored = useRef((SHOWCASE ? sessionNotes(report).gemini : report?.second_opinion_gemini) ?? "");
  const gptScored = useRef((SHOWCASE ? sessionNotes(report).openai : report?.second_opinion_chatgpt) ?? "");
  async function scoreGemini() {
    if (!report) return;
    const t = gemini.trim();
    if (!t) { report.second_opinion_gemini_score = undefined; report.second_opinion_gemini_read = undefined; gemScored.current = ""; setGemMeta(null); return; }
    if (t === gemScored.current) return;
    gemScored.current = t;
    setGemMeta({ score: null, read: "", loading: true });
    const scoredFor = report;
    const revision = gemRevision.current;
    const r = await scoreOpinion(t);
    if (latestReport.current !== scoredFor || revision !== gemRevision.current) return;
    report.second_opinion_gemini_score = r.score ?? undefined;
    report.second_opinion_gemini_read = r.read || undefined;
    setGemMeta({ score: r.score, read: r.read, loading: false });
    onNotesChange?.();
  }
  async function scoreChatgpt() {
    if (!report) return;
    const t = chatgpt.trim();
    if (!t) { report.second_opinion_chatgpt_score = undefined; report.second_opinion_chatgpt_read = undefined; gptScored.current = ""; setGptMeta(null); return; }
    if (t === gptScored.current) return;
    gptScored.current = t;
    setGptMeta({ score: null, read: "", loading: true });
    const scoredFor = report;
    const revision = gptRevision.current;
    const r = await scoreOpinion(t);
    if (latestReport.current !== scoredFor || revision !== gptRevision.current) return;
    report.second_opinion_chatgpt_score = r.score ?? undefined;
    report.second_opinion_chatgpt_read = r.read || undefined;
    setGptMeta({ score: r.score, read: r.read, loading: false });
    onNotesChange?.();
  }

  if (!report) {
    return (
      <section className="panel results-panel">
        <div className="consensus empty">
          <p className="muted">
            {SHOWCASE && onOpenSaved
              ? `Open the saved results for ${previewName} to explore the recorded findings.`
              : demo
                ? "Choose an example from the media panel to explore its findings."
                : "Upload or pick a file to compare model assessments and credential findings."}
          </p>
        </div>
        <ProviderTable providers={[]} emptyAction={SHOWCASE && onOpenSaved ? (
          <button type="button" className="primary" disabled={savedBusy} onClick={onOpenSaved}>
            <Search size={18} aria-hidden="true" />{savedLoading ? "Opening saved results…" : "Open saved results"}
          </button>
        ) : undefined} />
      </section>
    );
  }

  const { consensus, providers, frames, meta } = report;
  const video = meta.kind === "video";
  const audioStatus = report.audio_inspection?.status;
  const trackCount = report.audio_inspection?.stream_count;
  const audioLabel = audioStatus === "present" ? `Audio (${trackCount} track${trackCount === 1 ? "" : "s"})`
    : audioStatus === "absent" ? "No audio track" : audioStatus ? "Audio unknown" : "Audio unchecked";

  // Render one editor in the active workspace while keeping notes and in-flight
  // score guards owned here, shared with research exports and the graph.
  const secondOpinion = !HIDE_SECOND_OPINION && <SecondOpinion
    community={Boolean(secondOpinionTarget)} filename={previewName || meta.filename} kind={meta.kind} originalUrl={originalUrl}
    frameLabels={frames.map(f => f.frame)} frameDownloads={Boolean(onFrameDownload) && frames.length > (secondOpinionTarget ? 0 : 1)}
    gemini={gemini} chatgpt={chatgpt} onGemini={updateGemini} onChatgpt={updateChatgpt}
    onScoreGemini={EXAMPLES_ONLY ? undefined : scoreGemini} onScoreChatgpt={EXAMPLES_ONLY ? undefined : scoreChatgpt} geminiMeta={gemMeta} chatgptMeta={gptMeta}
    geminiFresh={gemFresh} chatgptFresh={gptFresh} onGeminiFresh={updateGeminiFresh} onChatgptFresh={updateChatgptFresh}
  />;

  if (community) return secondOpinionTarget ? createPortal(secondOpinion, secondOpinionTarget) : null;

  return (
    <section className="panel results-panel">
      {!video && <ConsensusBanner report={report} />}
      {meta.kind === "audio" && <p><a href={`#${tabId}-audio-panel`}>View sound findings{report.audio_assessment?.status === "ok" ? `: ${report.audio_assessment.duration_seconds}-second excerpt described` : ""}</a></p>}
      {meta.kind === "image" && meta.notes.length > 0 && (
        <details className="doc-info" aria-label="File and analysis details">
          <summary>Technical file and analysis record</summary>
          <ul>{meta.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
        </details>
      )}

      {meta.kind !== "image" && (
        <div className="doc-info">
          <strong>{meta.kind.toUpperCase()}</strong> &middot; {meta.kind === "audio" ? "Visual frames: not applicable" : `${meta.frame_count} frame(s) analysed`}
          {(meta.frames_found ?? 0) > meta.frame_count && <> of {meta.frames_found} found</>}
          {video && <div className="media-tabs" role="tablist" aria-label="Video assessment">
            {(["visual", "audio"] as const).map(tab => <button key={tab} type="button"
              role="tab" id={`${tabId}-${tab}`} aria-controls={`${tabId}-${tab}-panel`}
              aria-selected={mediaTab === tab} tabIndex={mediaTab === tab ? 0 : -1}
              onClick={() => setMediaTab(tab)} onKeyDown={e => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
                e.preventDefault();
                const next = e.key === "Home" ? "visual" : e.key === "End" ? "audio"
                  : tab === "visual" ? "audio" : "visual";
                setMediaTab(next);
                document.getElementById(`${tabId}-${next}`)?.focus();
              }}>{tab === "visual" ? "Visuals" : audioLabel}</button>)}
          </div>}
          {video && meta.notes.length > 0 && <details className="media-notes">
            <summary>File and sampling details</summary>
            <ul>{meta.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </details>}
          {!video && meta.notes.length > 0 && (
            <details><summary>Technical file and analysis record</summary><ul>{meta.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></details>
          )}
          {(!video || mediaTab === "visual") && (meta.frames_found ?? 0) > meta.frame_count && onDeepPass && (
            <div className="deep-pass">
              <button className="ghost" onClick={onDeepPass} disabled={deepBusy}>
                {deepBusy
                  ? "Analysing remaining frames..."
                  : `Analyse the remaining ${(meta.frames_found ?? 0) - meta.frame_count} frame(s)`}
              </button>
              <span className="muted small">
                Deep pass: runs only the frames the first pass skipped (nothing is paid for
                twice) and recombines the verdict over all frames. Uses your API keys.
              </span>
            </div>
          )}
          {(!video || mediaTab === "visual") && (meta.frames_found ?? 0) > meta.frame_count && !onDeepPass && (
            <p className="muted small">
              This is a sample of the document&apos;s frames. The deep pass (analysing the
              remaining frames) is available when the file itself is uploaded
              {demo ? " in the full tool" : ""}.
            </p>
          )}
        </div>
      )}

      <div className="media-tab-panel" id={`${tabId}-visual-panel`}
        role={video ? "tabpanel" : undefined} aria-labelledby={video ? `${tabId}-visual` : undefined}
        hidden={video && mediaTab !== "visual"}>
      {video && <ConsensusBanner report={report} />}
      {frames.length > 1 && (
        <div className="frame-strip">
          {frames.map((f, i) => (
            <div key={i} className={`frame-chip ${f.verdict}`}>
              <span className="frame-label">{f.frame}</span>
              <span className="frame-rating">{f.rating ?? "-"}</span>
              {onFrameDownload && (
                <button
                  className="frame-dl"
                  onClick={() => onFrameDownload(f.frame)}
                  title="Re-extracts this exact analysed frame locally (no API cost) so you can attach it to Gemini's SynthID check, which refuses document files."
                >
                  Download this frame as an image for Gemini
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ProviderTable providers={providers} />
      <details className="recorded-evidence"><summary>Combined evidence and method record</summary><DecisionPanel consensus={consensus} /></details>
      <section className="claim-context"><h3>Claim and context review</h3>
        <p>Claim accuracy: not assessed by these origin checks. Compare any accompanying claim with its source, date and supporting research.</p>
        {consensus.visible_text && <details><summary>{meta.kind === "audio" ? "Recorded transcript extract" : "Recorded text from the item"}</summary><p className="preserve-lines">{consensus.visible_text}</p></details>}
      </section>
      {secondOpinionTarget ? createPortal(secondOpinion, secondOpinionTarget) : secondOpinion}
      {/* Annotation lane: full tool only (agreed decision 4 - hidden in the
          showcase, and with it the workshop build). */}
      {!EXAMPLES_ONLY && <AnnotationLane report={report} onAnnotate={onAnnotate} />}
      </div>
      {(video || meta.kind === "audio") && <div className="media-tab-panel"
        id={`${tabId}-audio-panel`} role={video ? "tabpanel" : undefined}
        aria-labelledby={video ? `${tabId}-audio` : undefined} hidden={video && mediaTab !== "audio"}>
        <AudioPanel key={meta.report_id ?? meta.generated_at} report={report}
          file={EXAMPLES_ONLY ? undefined : sourceFile} onChange={onNotesChange} />
      </div>}
      <CredentialSummary report={report} />
      <Extras report={report} imageUrl={imageUrl} gemini={gemini} chatgpt={chatgpt}
        geminiFresh={gemFresh} chatgptFresh={gptFresh} compact={video && mediaTab === "audio"} />
    </section>
  );
}
