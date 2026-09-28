import { useId, useState } from "react";
import { Headphones, Image, Info } from "lucide-react";
import type { ProviderResult, Report } from "../types";
import { assessmentScope, assessmentTitle, checkStatus, modelDisplayName, modelReadingSummary, providerRating, textAssessment } from "../community";
import { capFirst, verdictLabel } from "../lib";
import { SHOWCASE } from "../showcase";
import ProviderEvidence from "./ProviderEvidence";
import CredentialSummary from "./CredentialSummary";
import CommunitySoundChecks from "./CommunitySoundChecks";

const KINDS = { vision: "Visual model", analysis: "Text assessment", provenance: "Content Credentials", watermark: "Watermark check", forensic: "Supporting file clues" };

function ProviderReading({ provider, noteId }: { provider: ProviderResult; noteId: string }) {
  const rating = providerRating(provider);
  return <li>
    <div className="community-mini-name"><div><strong>{modelDisplayName(provider)}</strong>
      <span className="community-check-kind">{KINDS[provider.kind]}</span></div><span>{checkStatus(provider)}</span></div>
    <div className="community-mini-reading">
      {provider.status === "ok" ? <>
        <div className="community-mini-verdict"><span className="neutral-reading">{capFirst(verdictLabel(provider.verdict))}</span>
          {rating !== null && <strong>{rating}<small> / 100</small></strong>}</div>
        {rating !== null ? <div className="community-rating-track" role="meter" aria-label={`${modelDisplayName(provider)} summary synthetic rating`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={rating} aria-valuetext={`${rating} out of 100`} aria-describedby={noteId}>
          <span style={{ width: `${rating}%`, background: "var(--accent)" }} /></div>
          : <p className="community-small">{["provenance", "watermark"].includes(provider.kind) ? "Origin check" : "Rating not recorded"}</p>}
        {provider.confidence && <span className="community-mini-confidence">Recorded confidence: {provider.confidence}</span>}
        {provider.kind === "forensic" && <p className="community-small">Supporting observations, considered alongside the model assessments.</p>}
      </> : <p className="community-small">{checkStatus(provider)}</p>}
      <details className="community-find-why">
        <summary>Find out why<span className="sr-only">: {modelDisplayName(provider)}</span></summary>
        <div className="community-key-evidence"><h3>Key evidence</h3>
          {provider.model && <p className="community-small">Model / check: {provider.model}</p>}
          {provider.status === "ok" ? <ProviderEvidence provider={provider} /> : <p>{provider.summary || checkStatus(provider)}</p>}
        </div>
      </details>
    </div>
  </li>;
}

export default function CommunityFindingSummary({ report, status, focusId }: { report: Report; status: string; focusId?: string }) {
  const id = useId();
  const [tab, setTab] = useState("assessment");
  const audio = report.meta.kind === "audio";
  const hasSound = audio || report.meta.kind === "video";
  const tabs = [["assessment", audio ? "Transcript" : textAssessment(report) ? "Text" : "Picture"], ["sound", "Sound"]];
  return <section id={focusId} tabIndex={-1} className="community-compact-summary" aria-labelledby={`${id}-heading`}>
    <div className="community-summary-heading"><div><p className="community-eyebrow">{SHOWCASE ? "Recorded analysis" : "Shared research record"}</p>
      <h2 id={`${id}-heading`}>What the checks suggest</h2></div>
      {status && <p className="community-status" role="status">{status}</p>}
    </div>
    <p className="community-result-heading"><Info size={22} aria-hidden="true" /><span>{assessmentTitle(report)}</span></p>
    <p className="community-model-agreement">{modelReadingSummary(report)}</p>
    <p className="community-scope">{assessmentScope(report)}</p>
    {report.meta.kind === "video" && report.meta.frame_count > 1 && <p className="community-small">Each model’s row shows its highest-rated sampled frame. Open Find out why to compare its readings across the frames.</p>}
    {report.providers.some(p => p.kind === "forensic") && <p className="community-small">Local file clues provide supporting observations, listed separately from the model agreement.</p>}
    {hasSound && <div className="community-tabs" role="tablist" aria-label="Findings type">
      {tabs.map(([key, label]) => <button key={key} role="tab" id={`${id}-tab-${key}`} aria-controls={`${id}-panel-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1}
        onClick={() => setTab(key)} onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          const next = e.key === "Home" ? "assessment" : e.key === "End" ? "sound" : key === "assessment" ? "sound" : "assessment";
          setTab(next); document.getElementById(`${id}-tab-${next}`)?.focus();
        }}>{key === "sound" ? <Headphones size={19} /> : <Image size={19} />}{label}</button>)}
    </div>}
    <div id={`${id}-panel-assessment`} role={hasSound ? "tabpanel" : undefined} aria-labelledby={hasSound ? `${id}-tab-assessment` : undefined} hidden={hasSound && tab !== "assessment"}>
      <ul className="community-mini-models" aria-label="Recorded checks and ratings">
        {report.providers.map(provider => <ProviderReading key={provider.id} provider={provider} noteId={`${id}-ratings`} />)}
      </ul>
      {!report.providers.length && <p>No provider checks are recorded.</p>}
      <p id={`${id}-ratings`} className="community-rating-note">Synthetic ratings: 0-100; higher values lean more synthetic. Ratings are not calibrated probabilities.</p>
    </div>
    {hasSound && <div id={`${id}-panel-sound`} role="tabpanel" aria-labelledby={`${id}-tab-sound`} hidden={tab !== "sound"}>
      <CommunitySoundChecks report={report} />
    </div>}
    <CredentialSummary report={report} community />
  </section>;
}
