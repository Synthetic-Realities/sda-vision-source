import brandLogo from "../assets/sda-vision-logo.png";
import { sessionNotes } from "../sessionNotes";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowDownToLine, BookOpen, Eye, FileText, Info, MessageCircle, Search, Upload, ZoomIn, X } from "lucide-react";
import type { ExampleEntry, ProvidersInfo, Report } from "../types";
import { communitySummary, mediaKind, mediaLabel, workshopSessionSummary, type WorkshopStep } from "../community";
import { downloadWorkshopSummary, type SummaryFormat } from "../workshopExport";
import { prepareExportPreview } from "../exportPreview";
import { HIDE_SECOND_OPINION, SHOWCASE, CONFERENCE, EXAMPLES_ONLY, WORKSHOP_STARTER_NAME } from "../showcase";
import Extras from "./Extras";
import PublicDemoNote from "./PublicDemoNote";
import PresentationPreview from "./PresentationPreview";
import type { SlidePreviewState } from "../useSlidePreview";
import AudioPreview from "./AudioPreview";
import CommunityFindingSummary from "./CommunityFindingSummary";
import WorkshopActivity from "./WorkshopActivity";
import ImageSourceSearch from "./ImageSourceSearch";
import { emptyWorkshopResponses, FACILITATOR_QUESTIONS, workshopHeading } from "../workshop";
import { STARTER_LABEL, STARTER_SOURCE, workshopExampleLabel } from "../workshopExamples";
import communityIllustration from "../assets/community-illustration.png";

interface Props {
  active: boolean; trainer: boolean; report: Report | null; providers: ProvidersInfo | null;
  examples: ExampleEntry[]; name: string; url: string | null; thumbnail?: string;
  slidePreview?: SlidePreviewState;
  hasInput: boolean; busy: boolean; running: boolean; status: string;
  caption: string; onCaption: (value: string) => void;
  mode: "general" | "vaccine"; onMode: (value: "general" | "vaccine") => void;
  onFile: (file: File | null) => void; onExample: (name: string) => void;
  onAnalyse: () => void; sourceFile?: File; onReportChange?: () => void;
  onNewSession: () => void;
  onStepChange: (step: WorkshopStep) => void;
  onSecondOpinionTarget: (target: HTMLDivElement | null) => void;
  onFrameDownload?: (label: string) => void;
}

const STEPS = [
  { id: "notice", label: "Notice", Icon: Eye }, { id: "discuss", label: "Discuss", Icon: MessageCircle },
  { id: "check", label: "Check", Icon: Search }, { id: "reflect", label: "Reflect", Icon: BookOpen },
] as const;

export default function CommunityView(p: Props) {
  const [step, setStep] = useState<WorkshopStep>("notice");
  useEffect(() => { if (p.active) p.onStepChange(step); }, [step, p.active, p.onStepChange]);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (p.active && previousStep.current !== step) {
      stageHeading.current?.focus({ preventScroll: true });
      stageHeading.current?.scrollIntoView({ block: "start" });
    }
    previousStep.current = step;
  }, [step, p.active]);
  const [responses, setResponses] = useState(emptyWorkshopResponses);
  const [sourceSearchOpen, setSourceSearchOpen] = useState(false);
  const [consentedRequest, setConsentedRequest] = useState<string | null>(null);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [sessionStatus, setSessionStatus] = useState("");
  const [summaryFormat, setSummaryFormat] = useState<SummaryFormat>("pdf");
  const [exporting, setExporting] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [readyToClear, setReadyToClear] = useState(false);
  const [zoom, setZoom] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionDialog = useRef<HTMLDialogElement>(null);
  const findings = useRef<HTMLElement>(null);
  const sourceSearchHeading = useRef<HTMLElement>(null);
  const id = useId();
  const illustration = !p.hasInput;
  const exampleIndex = p.examples.findIndex(e => e.name === p.name);
  const itemName = illustration ? STARTER_LABEL : workshopExampleLabel(p.name, exampleIndex < 0 ? undefined : exampleIndex);
  const kind = illustration ? "image" : mediaKind(p.name, p.report);
  const isAudio = kind === "audio";
  const hasSlideshow = kind === "pptx" && Boolean(p.slidePreview);
  const hasVisualSearch = kind === "image";
  const reportId = p.report?.meta.report_id ?? p.report?.meta.generated_at;
  useEffect(() => {
    if (reportId) setStep("check");
  }, [reportId]);
  useEffect(() => { setConsent(false); }, [p.name, p.caption, p.mode, p.providers, p.busy]);
  useEffect(() => { if (zoom) dialog.current?.showModal(); else dialog.current?.close(); }, [zoom]);
  useEffect(() => {
    if (newSessionOpen && p.active) sessionDialog.current?.showModal();
    else sessionDialog.current?.close();
  }, [newSessionOpen, p.active]);

  const enabled = p.providers ? (["claude", "openai", "gemini"] as const)
    .filter(k => p.providers?.[k].configured && !["disabled", "unconfigured"].includes(p.providers[k].state))
    .map(k => ({ claude: "Anthropic", openai: "OpenAI", gemini: "Google Gemini" })[k]) : [];
  const ready = Boolean(p.providers) && !p.busy && !exporting && (p.hasInput || SHOWCASE);
  const preview = illustration ? communityIllustration : kind === "image" ? p.url
    : p.thumbnail ?? p.report?.meta.thumbnail;
  const selectedExample = illustration ? WORKSHOP_STARTER_NAME : exampleIndex >= 0 ? p.name : "";
  const originalDownload = illustration ? communityIllustration
    : EXAMPLES_ONLY ? p.examples.find(e => e.name === p.name)?.downloadUrl : p.url;
  const consentText = `I agree to send this file's images or sampled frames, extracted text and the caption/context to the enabled services${enabled.length ? `: ${enabled.join(", ")}` : " (none currently configured for model analysis)"}. Audio transcription may send the complete audio file to Google or OpenAI. The configured API account, provider terms and charges apply.`;
  const consentKey = JSON.stringify([p.name, p.url, p.caption, p.mode, enabled, p.providers?.dev_mode]);
  const consent = consentedRequest === consentKey && !p.busy;
  function setConsent(value: boolean) { setConsentedRequest(value ? consentKey : null); }
  const report = p.report;
  const sourceNote = illustration ? STARTER_SOURCE : report?.meta.input_sha256 === "af5b2c84950d66ce32b4d7f603314a7fc70a9353d397ca71aa78d35e2327ce23"
    ? "Project source record: this video was supplied by Dr Sam Martin, who confirmed rights to include it and offer the original download." : undefined;
  const summaryBase = report ? communitySummary(report, "", "", SHOWCASE, includeNotes ? responses : undefined, sourceNote)
    : workshopSessionSummary(itemName, includeNotes ? responses : undefined, p.status);
  const browserNotes = SHOWCASE ? sessionNotes(report) : { gemini: "", openai: "" };
  const quoteNote = (text: string) => text.replace(/([\\`*_{}\[\]()#+.!<>|~-])/g, "\\$1");
  const noteSession = (fresh?: boolean) => fresh === true ? "Fresh chat/check (participant stated)" : fresh === false ? "Existing chat (participant stated)" : "Not stated";
  const summary = summaryBase + (SHOWCASE && (browserNotes.gemini || browserNotes.openai)
    ? "\n## Second Opinion notes\nSession entries; separate from the recorded findings and combined score.\n"
      + (browserNotes.gemini ? `\nGemini reply: ${quoteNote(browserNotes.gemini)}\nGemini session: ${noteSession(browserNotes.geminiFresh)}\n` : "")
      + (browserNotes.openai ? `\nOpenAI reply: ${quoteNote(browserNotes.openai)}\nOpenAI session: ${noteSession(browserNotes.openaiFresh)}\n` : "") : "");


  const advance = () => {
    if (p.busy || exporting) return;
    setStep(STEPS[Math.min(STEPS.findIndex(s => s.id === step) + 1, STEPS.length - 1)].id);
    // The public action opens saved findings. Live modes retain their consent step.
    if (SHOWCASE && step === "discuss" && !report) p.onAnalyse();
  };
  const previous = () => setStep(STEPS[Math.max(STEPS.findIndex(s => s.id === step) - 1, 0)].id);
  async function endSession() {
    if (exporting || p.busy) return;
    setExporting(true);
    setSessionStatus(`Preparing your ${summaryFormat.toUpperCase()} summary...`);
    try {
      const media = summaryFormat === "csv" ? undefined : await prepareExportPreview({
        kind, imageUrl: illustration ? communityIllustration : p.url, thumbnail: report?.meta.thumbnail ?? p.thumbnail,
        analysed: kind === "image" ? Boolean(report) : Boolean(report?.meta.thumbnail),
        frameLabel: report?.meta.thumbnail ? report.frames[0]?.frame : undefined,
      });
      await downloadWorkshopSummary(summary, itemName, summaryFormat, media);
      setSessionStatus(`${summaryFormat.toUpperCase()} download started. Your notes remain on this page.`);
    } catch (error) {
      setSessionStatus(`Download could not be completed. ${error instanceof Error ? error.message : "Please try again."} Your notes remain on this page.`);
    } finally { setExporting(false); }
  }
  function confirmNewSession() {
    if (!readyToClear || p.busy || exporting) return;
    setNewSessionOpen(false);
    setResponses(emptyWorkshopResponses());
    setStep("notice");
    setSessionStatus("");
    setReadyToClear(false);
    p.onNewSession();
  }
  function run() { if (!ready || (!EXAMPLES_ONLY && !consent)) return; setConsent(false); p.onAnalyse(); }
  const downloadControls = <div className="community-download-actions">
    <label>Summary format<select value={summaryFormat} disabled={exporting} onChange={e => setSummaryFormat(e.target.value as SummaryFormat)}>
      <option value="pdf">PDF report</option><option value="pptx">PowerPoint (PPTX)</option><option value="csv">Spreadsheet (CSV)</option>
    </select></label>
    <button className="cw-button" disabled={exporting || p.busy} onClick={endSession}><ArrowDownToLine size={19} />{exporting ? "Preparing download..." : `Download ${summaryFormat.toUpperCase()}`}</button>
  </div>;

  // Keep the workshop state mounted across view changes without rendering a
  // second set of media players or inputs in the Developer workspace.
  if (!p.active) return null;

  return <>
    <div className="community-workspace">
      <header className="community-heading">
        <div className="community-brand-row"><h1 className="sda-brand-heading"><img className="sda-brand-logo" src={brandLogo} alt="SDA Vision" width="2172" height="724" /></h1><div className="community-brand-copy"><p className="community-tagline">{p.trainer ? "SDA Community / Facilitator" : "SDA Community"}</p><p className="community-framework">Synthetic-media Discourse Analysis</p><p className="community-framework">Explore AI-generated and traditional media together.</p></div>
        </div>
        <span className="community-session" role="note"><UsersMark />{SHOWCASE ? "Recorded examples" : p.trainer ? "Facilitator workspace" : "Explore together"}</span>
        {SHOWCASE && <PublicDemoNote />}
      </header>

      <div className="community-filebar">
        {!EXAMPLES_ONLY && <><input ref={input} type="file" hidden aria-label="Choose a workshop file" disabled={p.busy || exporting}
          accept="image/*,application/pdf,.pptx,video/*,audio/*,.txt,.srt,.vtt,.md,.m4a"
          onChange={e => { p.onFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <button className="cw-button" disabled={p.busy || exporting} onClick={() => input.current?.click()}><Upload size={19} />Choose a file</button></>}
        <div className="community-example"><div className="community-start-row"><h2 className="community-start-heading">Start here</h2>
          {illustration && <p className="community-small" id={`${id}-practice`}>Try the four workshop steps with this practice example, or choose another.</p>}</div>
          <select aria-label="Workshop example" aria-describedby={illustration ? `${id}-practice` : undefined} disabled={p.busy || exporting} value={selectedExample}
            onChange={e => { if (e.target.value) p.onExample(e.target.value); }}>
            {!illustration && exampleIndex < 0 && <option value="">Current file: {p.name}</option>}
            <option value={WORKSHOP_STARTER_NAME}>{STARTER_LABEL}</option>
            {p.examples.map((e, index) => <option key={e.name} value={e.name}>{workshopExampleLabel(e.name, index)}</option>)}
          </select>
        </div>
        {p.hasInput && <span className="community-kind">{mediaLabel(kind)}</span>}
      </div>

      <nav className="community-steps" aria-label="Workshop activity">
        {STEPS.map(({ id: key, label, Icon }, i) => <button key={key} type="button" aria-current={step === key ? "step" : undefined}
          onClick={() => setStep(key)}><span className="step-number">{i + 1}</span><Icon size={18} /><span>{label}</span></button>)}
      </nav>

      <div className="community-activity">
        <div className="community-stage-heading">
          <h2 ref={stageHeading} tabIndex={-1}>{workshopHeading(step, kind)}</h2>
          {!illustration && selectedExample && <p>Example {p.examples.findIndex(e => e.name === p.name) + 1} of {p.examples.length}</p>}
        </div>
        <section className="community-media" aria-label="Selected workshop item">
          <div className={`community-preview ${illustration ? "is-empty" : hasSlideshow ? "is-slideshow" : isAudio ? "is-audio" : ""}`}>
            {illustration ? <img src={communityIllustration} alt="Four adults sitting around a table and looking at a tablet." />
              : hasSlideshow ? <PresentationPreview key={p.url} state={p.slidePreview!} cover={p.thumbnail}/>
              : kind === "video" && p.url ? <video ref={videoRef} src={p.url} controls preload="metadata" aria-label={`Video: ${itemName}`} />
              : isAudio && p.url ? <AudioPreview url={p.url} name={itemName} artwork={preview} />
              : preview ? <img src={preview} alt={`Selected ${mediaLabel(kind).toLowerCase()}: ${itemName}`} />
              : <div className="community-document"><FileText size={58} aria-hidden="true" /><strong>{mediaLabel(kind)}</strong><span>{itemName}</span></div>}
          </div>
          <div className="community-media-meta"><p className="community-media-caption">{itemName}</p>
            {preview && !hasSlideshow && <button className="cw-icon" title={kind === "video" ? "View larger video" : "Enlarge image"} aria-label={kind === "video" ? "View larger video" : "Enlarge image"} onClick={() => { videoRef.current?.pause(); setZoom(true); }}><ZoomIn size={21} /></button>}</div>
          {illustration && (step === "notice" || step === "discuss") && <p className="community-media-prompt">Look at the hands, faces, text, shadows and background. What stands out to you?</p>}
          {p.hasInput && !EXAMPLES_ONLY && <details className="community-context"><summary>Caption or context</summary>
            <label htmlFor={`${id}-context`}>What was shared with this item?</label>
            <textarea id={`${id}-context`} rows={3} disabled={p.busy} value={p.caption} onChange={e => p.onCaption(e.target.value)} />
            <p>This context accompanies an analysis request.</p>
          </details>}

        </section>

        <WorkshopActivity sourceNote={sourceNote} step={step} kind={kind} report={report} busy={p.busy || exporting} responses={responses}
          originalUrl={originalDownload} originalName={illustration ? "illustration-1.png" : p.name}
          onChange={changes => setResponses(current => ({ ...current, ...changes }))}
          onNext={advance} onPrevious={previous} onReviewChecks={() => { findings.current?.scrollIntoView({ block: "start" }); findings.current?.focus(); }}
          onViewEvidence={() => {
            document.getElementById(`${id}-summary`)?.focus({ preventScroll: true });
            document.getElementById(`${id}-summary`)?.scrollIntoView({ block: "start" });
          }}
          onEndSession={endSession} onNewSession={() => { setReadyToClear(false); setNewSessionOpen(true); }} sessionStatus={sessionStatus} />
        {report && (step === "check" || step === "reflect") && <>
          {step === "reflect" ? <details className="community-review-findings"><summary>Revisit the recorded findings</summary>
            <CommunityFindingSummary report={report} status="" focusId={`${id}-summary`} /></details>
            : <CommunityFindingSummary report={report} status={p.status} focusId={`${id}-summary`} />}
            {(hasVisualSearch || originalDownload || !HIDE_SECOND_OPINION) && <section className="community-evidence-box" aria-label="Evidence box">
              <h3>Evidence box</h3>
              {!hasVisualSearch && originalDownload && <a className="cw-text community-original-download" href={originalDownload} download={illustration ? "illustration-1.png" : p.name}><ArrowDownToLine size={18} />Download original file</a>}
              {hasVisualSearch && <details className="community-source-evidence" open={sourceSearchOpen} onToggle={e => setSourceSearchOpen(e.currentTarget.open)}>
                <summary ref={sourceSearchHeading}>Google Lens / image-search evidence</summary>
                <ImageSourceSearch kind={kind} originalUrl={originalDownload} originalName={illustration ? "illustration-1.png" : p.name} />
                <label className="community-note" htmlFor={`${id}-source-note`}>Links, dates and what you found (optional)</label>
                <textarea id={`${id}-source-note`} rows={3} value={responses.sourceSearchNote} onChange={e => setResponses(current => ({ ...current, sourceSearchNote: e.target.value }))} />
                <p className="community-small">Local workshop note. Included in your summary when you choose to include workshop responses; kept separate from SDA's scoring.</p>
              </details>}
              {!HIDE_SECOND_OPINION && <details className="community-second-opinions">
                <summary>Second opinions</summary>
                <div ref={p.onSecondOpinionTarget} />
              </details>}
              {p.onFrameDownload && ["video", "pdf", "pptx"].includes(kind) && report.frames.length > 0 && <details className="community-frame-tools">
                <summary>Frame images for external checks</summary>
                <p className="community-small">Saved locally from the analysed frames. You choose any external upload; extracted images have different credentials from the original file.</p>
                <div>{report.frames.map(frame => <button className="cw-button" key={frame.frame} disabled={p.busy} onClick={() => p.onFrameDownload?.(frame.frame)}><ArrowDownToLine size={18} />Save {frame.frame}</button>)}</div>
              </details>}
            </section>}
        </>}
      </div>

      {p.trainer && <section className="community-facilitator" aria-label="Facilitator prompts">
        <div><span className="community-eyebrow">Facilitator</span><h2>Questions for the group</h2></div>
        <ol>{FACILITATOR_QUESTIONS[step].map(question => <li key={question}>{question}</li>)}</ol>
        <p className="community-source-note"><Info size={22} aria-hidden="true" /><span>Make room for different views. People can pass, take more time or revise their choices.</span></p>
      </section>}

      {(step === "check" || step === "reflect") && <section ref={findings} tabIndex={-1} className={`community-findings${report ? " has-report" : ""}`} aria-label="Workshop findings">
        {!report && <div className="community-section-title"><div><p className="community-eyebrow">{SHOWCASE ? "Recorded analysis" : "Shared research record"}</p><h2>Check this item</h2></div></div>}
        {!report && <div className="community-run">
          {p.providers?.vaccine_lens && <label>Analysis lens<select value={p.mode} disabled={p.busy} onChange={e => p.onMode(e.target.value as "general" | "vaccine")}>
            <option value="general">General</option><option value="vaccine">Vaccine research lens</option></select></label>}
          {!EXAMPLES_ONLY && <label className="community-consent"><input type="checkbox" checked={consent} disabled={p.busy || !p.providers} onChange={e => setConsent(e.target.checked)} /><span>{consentText}</span></label>}
          {!SHOWCASE && <p className="community-small">{p.providers ? p.providers.dev_mode ? "Research retention is on: the server saves unencrypted reports until deletion." : "Research retention is off: analysis reports are not saved server-side." : "Checking provider and retention settings..."}</p>}
          <button className="cw-button cw-primary" disabled={!ready || (!EXAMPLES_ONLY && !consent)} onClick={run}><Search size={19} />{p.running ? "Checking this item..." : SHOWCASE ? "Open recorded findings" : CONFERENCE ? "Run live checks" : "Run SDA's checks"}</button>
        </div>}
        {!report && p.status && <p className="community-status" role="status">{p.status}</p>}
        {(p.hasInput || report) && <div className="community-downloads"><h3>Take the findings with you</h3>
            <label className="community-include"><input type="checkbox" checked={includeNotes} disabled={exporting} onChange={e => setIncludeNotes(e.target.checked)} />Include my workshop responses in the summary</label>
            {downloadControls}
            {sessionStatus && <p className="community-small" role="status">{sessionStatus}</p>}
            {report && <details><summary>Full research downloads</summary><Extras report={report} imageUrl={p.url ?? undefined} compact /></details>}
          </div>}
      </section>}
    </div>
    {(p.hasInput || report) && <article className="community-print"><h1>Synthetic Realities</h1><p>SDA Community / Our findings</p><pre>{summary}</pre></article>}
    <dialog ref={sessionDialog} className="community-session-dialog" aria-labelledby={`${id}-session-heading`} aria-describedby={`${id}-session-description`}
      onCancel={() => setNewSessionOpen(false)} onClose={() => setNewSessionOpen(false)}>
      <h2 id={`${id}-session-heading`}>Keep your session notes</h2>
      <p id={`${id}-session-description`}>A new session clears this item's notes and findings from the page. Download anything you want to keep and check it has saved before continuing.</p>
      <label className="community-include"><input type="checkbox" checked={includeNotes} disabled={exporting} onChange={e => setIncludeNotes(e.target.checked)} />Include my workshop responses in the summary</label>
      {downloadControls}
      {sessionStatus && <p className="community-small" role="status">{sessionStatus}</p>}
      <label className="community-include"><input type="checkbox" checked={readyToClear} onChange={e => setReadyToClear(e.target.checked)} />I am ready to clear this page and start a new session</label>
      <div className="community-session-dialog-actions">
        <button className="cw-button" onClick={() => setNewSessionOpen(false)}>Keep working</button>
        <button className="cw-button cw-new-session" disabled={!readyToClear || p.busy || exporting} onClick={confirmNewSession}>Start new session</button>
      </div>
    </dialog>
    <dialog ref={dialog} className="community-zoom" onCancel={() => setZoom(false)} onClose={() => setZoom(false)}>
      <button className="cw-icon" title="Close enlarged view" aria-label="Close enlarged view" onClick={() => setZoom(false)}><X /></button>
      {zoom && (kind === "video" && p.url ? <video src={p.url} controls preload="metadata" aria-label={`Enlarged video: ${itemName}`} /> : preview && <img src={preview} alt={`Enlarged preview: ${itemName}`} />)}
    </dialog>
  </>;
}

function UsersMark() { return <MessageCircle size={19} aria-hidden="true" />; }
