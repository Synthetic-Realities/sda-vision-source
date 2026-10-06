import { ExternalLink } from "lucide-react";
import type { WorkshopStep } from "../community";
import { PODCAST_PROMPTS, PODCAST_SEARCH_URL, PODCAST_PAPER_URL, PODCAST_CITATION, PODCAST_SOURCE_NOTE, PODCAST_COMPARISON, PODCAST_WORKSHOP_VERDICT, PODCAST_WORKSHOP_REASON } from "../podcastActivity";

export default function PodcastExploration({ step, onReveal }: { step: WorkshopStep; onReveal: () => void }) {
  return <aside className="podcast-exploration" aria-label="Podcast source exploration">
    <h3>{step === "notice" ? "Listen and notice" : "Follow the source"}</h3>
    <p>{PODCAST_PROMPTS[step]}</p>
    {(step === "check" || step === "reflect") && <>
      <a className="cw-text" href={PODCAST_SEARCH_URL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
        Search Google for the publication<ExternalLink size={16} aria-hidden="true"/><span className="sr-only"> (opens in a new tab)</span>
      </a>
      <p className="community-small">Opens a text search using the cover’s author names and topic. Google’s settings and terms apply.</p>
      <details onToggle={e => { if (e.currentTarget.open) onReveal(); }}>
        <summary>Explore the source behind this example</summary>
        <h4>Final workshop verdict: {PODCAST_WORKSHOP_VERDICT}</h4>
        <p>{PODCAST_WORKSHOP_REASON}</p>
        <p>{PODCAST_SOURCE_NOTE}</p><p>{PODCAST_COMPARISON}</p>
        <p className="community-small">{PODCAST_CITATION}</p>
        <a className="cw-text" href={PODCAST_PAPER_URL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Read the research paper<ExternalLink size={16} aria-hidden="true"/><span className="sr-only"> (opens in a new tab)</span></a>
      </details>
    </>}
  </aside>;
}
