import { useId } from "react";
import { ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, ExternalLink, Info, Plus } from "lucide-react";
import { SHOWCASE } from "../showcase";
import PodcastExploration from "./PodcastExploration";
import type { Report } from "../types";
import { assessmentTitle, workshopOverview, type WorkshopStep } from "../community";
import { discussionClues, discussionPrompt, impressionOptions, NEXT_ACTIONS, sameImpression, toggleImpression, type WorkshopResponses } from "../workshop";

interface Props {
  step: WorkshopStep; kind: string; report: Report | null; busy: boolean;
  responses: WorkshopResponses; onChange: (changes: Partial<WorkshopResponses>) => void;
  onNext: () => void; onPrevious: () => void; onReviewChecks: () => void;
  onEndSession: () => void; onNewSession: () => void; sessionStatus: string;
  onViewEvidence: () => void;
  originalUrl?: string | null; originalName?: string;
  sourceNote?: string;
  podcastExample?: boolean;
  onSourceReveal?: () => void;
}

function TickChoices({ label, options, selected, onChange, disabled, labels, sourceSearch = false, originalUrl, originalName }: {
  label: string; options: string[]; selected: string[]; onChange: (values: string[]) => void; disabled: boolean;
  labels?: Record<string, string>;
  sourceSearch?: boolean;
  originalUrl?: string | null; originalName?: string;
  sourceNote?: string;
}) {
  return <fieldset className="community-choices workshop-ticks" disabled={disabled}>
    <legend>{label}</legend>
    {options.map(option => <div key={option} className="workshop-choice-row"><label className={selected.includes(option) ? "selected" : ""}>
      <input type="checkbox" checked={selected.includes(option)} onChange={e => onChange(e.target.checked ? [...selected, option] : selected.filter(v => v !== option))} />{labels?.[option] ?? option}
    </label>
      {sourceSearch && option === "Find the original source" && <div className="workshop-choice-tools">
        <div className="workshop-source-actions"><a className="cw-text" href="https://images.google.com/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
          Open Google Lens<ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
        </a>
        {originalUrl && <a className="cw-text" href={originalUrl} download={originalName}><ArrowDownToLine size={18} aria-hidden="true" />Download original file</a>}</div>
        <p className="community-small">Use the camera icon to choose an image to share with Google. Google's account settings and terms apply separately from SDA.</p>
      </div>}
    </div>)}
  </fieldset>;
}

function OriginChoices({ label, options, value, onChange, disabled, visibleLabel = false }: {
  label: string; options: string[]; value: string[]; onChange: (value: string[]) => void; disabled: boolean; visibleLabel?: boolean;
}) {
  const id = useId();
  return <fieldset className="community-choices workshop-ticks" disabled={disabled} aria-describedby={`${id}-hint`}>
    <legend className={visibleLabel ? undefined : "sr-only"}>{label}</legend>
    <p id={`${id}-hint`} className="community-small">Choose all that fit, or choose "Not sure yet" on its own.</p>
    {options.map(option => <label key={option} className={value.includes(option) ? "selected" : ""}>
      <input type="checkbox" value={option} checked={value.includes(option)} onChange={() => onChange(toggleImpression(value, option))} />{option}
    </label>)}
  </fieldset>;
}

export default function WorkshopActivity(p: Props) {
  const id = useId();
  const r = p.responses;
  // The opening illustration is available for discussion before an example is selected.
  const disabled = p.busy;
  const options = impressionOptions(p.kind);
  const firstView = r.impression.join("; ") || "Not chosen";
  const laterView = r.laterImpression.join("; ");
  const noteLabel = p.step === "notice" ? "What makes you think that? (optional)" : p.step === "discuss" ? "What did you notice or talk about? (optional)" : "What will you take away? (optional)";
  const noteKey = p.step === "notice" ? "noticeNote" : p.step === "discuss" ? "discussionNote" : "reflectionNote";
  return <section className="community-discussion" aria-labelledby={`${id}-heading`}>
    {p.step === "notice" && <>
      <h2 id={`${id}-heading`} tabIndex={-1}>How do you think it was made?</h2>
      {p.podcastExample && <PodcastExploration step="notice" onReveal={() => {}} />}
      <OriginChoices label="First impression" options={options} value={r.impression} disabled={disabled}
        onChange={impression => p.onChange({ impression, impressionAfterChecks: Boolean(p.report) })} />

    </>}
    {p.step === "discuss" && <>
      <h2 id={`${id}-heading`} tabIndex={-1}>{discussionPrompt(r.impression)}</h2>
      <p className="workshop-carried-choice">Your first impression: <strong>{firstView}</strong></p>
      <ParticipantNotes responses={r} />
      {p.podcastExample && <PodcastExploration step="discuss" onReveal={() => {}} />}
      <TickChoices label="What shaped your view? Choose any." options={discussionClues(p.kind)} selected={r.clues} disabled={disabled} onChange={clues => p.onChange({ clues })} />

    </>}
    {p.step === "check" && <>
      <h2 id={`${id}-heading`} tabIndex={-1}>What we know so far</h2>
      <div className="workshop-choice-response"><Info size={22} aria-hidden="true" /><div><strong>Your first impression: {firstView}</strong>
        <p>{p.sourceNote ?? (p.podcastExample ? "Use Follow the source below to explore the cover citation alongside these recorded checks." : "This view has no linked workshop source note. The recorded checks below describe the available evidence.")}</p></div></div>
      <h3>SDA's checks</h3>
      <table className="workshop-overview" aria-label="SDA checks at a glance"><tbody>{workshopOverview(p.report, p.kind).filter(row => row.label !== "Image history" && row.label !== "File history" && !(p.sourceNote && row.label === "Shared claim")).map(row => <tr key={row.label}>
        <th scope="row"><span>{row.label}</span>{row.question && <small className="workshop-check-question">{row.question}</small>}</th><td><details open={Boolean(p.report && (row.answers || row.label === "Shared claim"))}><summary>{row.finding}</summary><p>{row.label === "Visual clues" && p.report ? "Check for the results below" : row.detail}</p>

        </details></td>
      </tr>)}</tbody></table>
      {p.report && <button className="cw-text workshop-evidence-link" onClick={p.onViewEvidence}>View the supporting details below<ArrowDown size={18} /></button>}
      {p.podcastExample && <PodcastExploration step="check" onReveal={p.onSourceReveal ?? (() => {})} />}
    </>}
    {p.step === "reflect" && <>
      <h2 id={`${id}-heading`} tabIndex={-1}>How do you see it now?</h2>
      <dl className="workshop-comparison"><div><dt>Your first impression</dt><dd>{firstView}</dd></div>
        <div><dt>SDA's assessment</dt><dd>{p.report ? assessmentTitle(p.report) : "No SDA findings recorded yet"}</dd></div></dl>
      <ParticipantNotes responses={r} includeDiscussion />
      {p.podcastExample && <PodcastExploration step="reflect" onReveal={p.onSourceReveal ?? (() => {})} />}
      <OriginChoices visibleLabel label="Your view now" options={options} value={r.laterImpression} disabled={disabled} onChange={laterImpression => p.onChange({ laterImpression })} />

      <TickChoices label="What would you do next? Choose any." options={p.kind === "image" ? NEXT_ACTIONS : NEXT_ACTIONS.filter(action => action !== "Find the original source")} selected={r.nextActions} disabled={disabled} sourceSearch={p.kind === "image"} originalUrl={p.originalUrl} originalName={p.originalName} onChange={nextActions => p.onChange({ nextActions })} />
    </>}
    {p.step !== "check" && <>
      <label className="community-note" htmlFor={`${id}-note`}>{noteLabel}</label>
      <textarea id={`${id}-note`} rows={3} disabled={disabled} value={r[noteKey]} onChange={e => p.onChange({ [noteKey]: e.target.value })} />
    </>}
    <div className="workshop-step-actions">
      {p.step !== "notice" && <button className="cw-text" onClick={p.onPrevious}><ArrowLeft size={18} />Previous step</button>}
      {p.step !== "reflect" ? !(SHOWCASE && p.step === "check" && !p.report) && <button className="cw-button cw-primary" disabled={disabled} onClick={p.step === "check" && !p.report ? p.onReviewChecks : p.onNext}>
        {p.step === "notice" ? "Let's discuss" : p.step === "discuss" ? "Let's check together" : p.report ? "Reflect together" : "Review and run checks"}<ArrowRight size={20} /></button>
        : <div className="workshop-session-actions">
          <button className="cw-button cw-end-session" disabled={disabled} onClick={p.onEndSession}><ArrowDownToLine size={20} />Download session notes</button>
          <button className="cw-button cw-new-session" disabled={disabled} onClick={p.onNewSession}><Plus size={20} />New session</button>
          {p.sessionStatus && <p className="community-small" role="status">{p.sessionStatus}</p>}
        </div>}
    </div>
    <div className="workshop-feedback" aria-live="polite" aria-atomic="true">
      {p.step === "notice" && r.impression.length > 0 && <div className="workshop-choice-response" role="status"><strong>Your first impression: {firstView}</strong>
        {r.impressionAfterChecks && <small>Chosen after SDA findings were available.</small>}</div>}
      {p.step === "discuss" && r.clues.length > 0 && <p className="workshop-choice-response" role="status">You picked {p.step === "discuss" && r.clues.length} {p.step === "discuss" && r.clues.length === 1 ? "cue" : "cues"}. What other explanation might fit?</p>}
      {p.step === "reflect" && r.laterImpression.length > 0 && <p className="workshop-choice-response" role="status">{!r.impression.length ? `Your view now: ${laterView}.` : sameImpression(r.impression, r.laterImpression) ? "You have kept your first impression. What would you still like to check?" : `Your view has moved from "${firstView}" to "${laterView}". What influenced that change?`}</p>}
    </div>
  </section>;
}

function ParticipantNotes({ responses, includeDiscussion = false }: { responses: WorkshopResponses; includeDiscussion?: boolean }) {
  return <div className="workshop-carried-notes">
    {responses.noticeNote && <div><strong>Your Notice note</strong><p>{responses.noticeNote}</p></div>}
    {includeDiscussion && responses.discussionNote && <div><strong>Your Discuss note</strong><p>{responses.discussionNote}</p></div>}
  </div>;
}
