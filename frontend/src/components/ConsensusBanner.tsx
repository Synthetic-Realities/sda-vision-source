import type { Report } from "../types";
import { assessmentScope, assessmentTitle, textAssessment, modelReadingSummary } from "../community";
import { ratingBasis } from "../assessmentNotes";

export default function ConsensusBanner({ report }: { report: Report }) {
  const c = report.consensus;
  const text = textAssessment(report);
  return <div className={`consensus ${text ? "transcript-consensus" : "visual-consensus"}`}>
    <p className="assessment-label">{report.meta.kind === "audio" ? "Transcript excerpt assessment" : text ? "Text assessment" : "Visual assessment"}</p>
    <h2>{assessmentTitle(report)}</h2>
    <p className="assessment-coverage"><strong>{assessmentScope(report)}</strong></p>
    {text && <p>The models interpret wording and style. Human-written scripts can share these features; source information helps interpret the result.</p>}
    <p>{modelReadingSummary(report)}</p>
    <p className="assessment-rating"><strong>{text ? "Text" : "Visual"} synthetic rating: {c.overall_rating ?? "not recorded"}{c.overall_rating != null && " / 100"}</strong><br />{ratingBasis(c)}. Ratings are not calibrated probabilities.</p>
  </div>;
}
