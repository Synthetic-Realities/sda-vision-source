import { useId } from "react";
import type { ProviderResult } from "../types";
import { checkStatus, providerRating } from "../community";
import { capFirst, ratingColor, verdictColor, verdictLabel } from "../lib";
import ProviderEvidence from "./ProviderEvidence";

const KINDS = { vision: "Visual model", analysis: "Text assessment", provenance: "Creation history", watermark: "Watermark check", forensic: "Supporting file clues" };

export default function CommunityChecks({ providers }: { providers: ProviderResult[] }) {
  const noteId = useId();
  return <div className="community-checks">
    <p id={noteId} className="community-rating-note">Synthetic ratings run from 0 to 100: higher values lean more synthetic. Ratings are not calibrated probabilities.</p>
    <table className="community-check-table" aria-label="SDA checks and key evidence" role="table">
      <thead><tr role="row"><th scope="col" role="columnheader">Check</th><th scope="col" role="columnheader">Assessment</th><th scope="col" role="columnheader">Key evidence</th></tr></thead>
      <tbody>
        {providers.length === 0 && <tr role="row"><td colSpan={3} role="cell">No provider checks are recorded.</td></tr>}
        {providers.map(p => {
          const rating = providerRating(p);
          return <tr key={p.id} role="row">
            <th scope="row" role="rowheader" className="community-check-provider">
              <span className="community-provider-name">{p.name}</span>
              <span className="community-provider-kind">{KINDS[p.kind]}</span>
              {p.model && <span className="community-provider-model">{p.model}</span>}
              <span className={`community-check-status status-${p.status}`}>{checkStatus(p)}</span>
            </th>
            <td role="cell" className="community-check-assessment">
              {p.status === "ok" ? <>
                <strong style={{ color: verdictColor(p.verdict) }}>{capFirst(verdictLabel(p.verdict))}</strong>
                {rating !== null ? <div className="community-rating">
                  <div className="community-rating-label"><span>Synthetic rating</span><strong>{rating}<small> / 100</small></strong></div>
                  <div className="community-rating-track" role="meter" aria-label={`${p.name} synthetic rating`} aria-valuemin={0} aria-valuemax={100}
                    aria-valuenow={rating} aria-valuetext={`${rating} out of 100`} aria-describedby={noteId}>
                    <span style={{ width: `${rating}%`, background: ratingColor(rating) }} />
                  </div>
                </div> : <p className="community-small">{["provenance", "watermark"].includes(p.kind) ? "Origin check" : "Rating not recorded"}</p>}
                {p.confidence && <p className="community-small">Recorded confidence: {p.confidence}</p>}
              </> : <span className="community-small">{checkStatus(p)}</span>}
            </td>
            <td role="cell" className="community-key-evidence">
              <span className="community-mobile-label" aria-hidden="true">Key evidence</span>
              {p.status === "ok" ? <ProviderEvidence provider={p} /> : <p>{p.summary || checkStatus(p)}</p>}
            </td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}
