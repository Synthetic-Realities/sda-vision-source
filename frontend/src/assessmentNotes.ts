import type { Consensus } from "./types";

// Labels describe the saved method record; they do not recalculate any finding.
export function ratingBasis(c: Consensus): string {
  return ({ median_model_ratings: "Median of the available model ratings",
    mean_frame_ratings: "Mean of the assessed frame ratings",
    provenance_declaration: "Credential declaration; no numerical rating",
    not_scored: "No numerical rating recorded" } as Record<string, string>)[c.score_basis ?? ""]
    ?? "Combined rating; calculation details are in the saved method record";
}
export function confidenceBasis(c: Consensus): string {
  const agreement = c.decision_trace?.find(s => s.step === "model_agreement");
  const votes = Array.isArray(agreement?.synthetic) ? agreement.synthetic.length : 0;
  if (c.confidence === "high" && votes >= 3) return "The recorded rule assigns ‘high’ when at least three models cast matching synthetic votes. This describes agreement under the rule, rather than the models’ own confidence or a measured probability of being correct.";
  if (c.confidence === "high" && votes >= 2 && agreement?.forensic_supports_synthetic) return "The recorded rule assigns ‘high’ to matching synthetic model votes with supporting file clues. The models’ own confidence is shown separately; this is not a measured probability of being correct.";
  return "This is the combined method’s recorded confidence label. Each check reports its own confidence separately. The label is not a calibrated probability, and model independence is not assumed.";
}
