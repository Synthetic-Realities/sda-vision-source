# Verdict consistency: method revision of 26 September 2026

Method: **`verdict-consistency-2026-09-26.1`**.
Previous method: `publication-repair-2026-09-24.3`.
The researcher explicitly authorised this correction and local comparison using
saved replies on 26 September 2026. It is a method change, recorded separately
from earlier editorial and delivery revisions.

## Change and scope

The previous aggregator counted low and high numeric ratings as directional votes
even when the corresponding provider verdict was Inconclusive. Two middle-band
inconclusive replies could also produce Partially synthetic. The revised rule
checks the normalised provider verdict alongside the unchanged rating thresholds.

| Normalised provider result | Treatment in aggregation |
| --- | --- |
| Authentic likely, rating at or below 30 | Authentic vote |
| Synthetic likely or Partially synthetic, rating at or above 60 | Synthetic-side vote under the existing high-score rule |
| Partially synthetic, rating strictly between 30 and 60 | Existing partial-result route; at least two such explicit assessments required |
| Inconclusive or Not applicable, at any rating | Undecided; supplies no directional or partial-result vote |
| Verdict and rating disagree | Undecided; both remain visible |
| Failed, timed out, disabled, unconfigured or pending | Excluded from usable voting results; actual status retained |
| Missing rating | Unscored; no numeric vote |

Two matching directional votes are still required. A lone synthetic vote still
leaves the panel inconclusive. The existing order of decisions, credential/trust
and watermark overrides, and treatment of local forensic observations are retained.
Two explicit middle-band partial assessments retain their existing low-confidence
partial result; two inconclusive assessments now remain Inconclusive.

The same rule determines which model rows appear in the supporting-evidence list.
Inconclusive or conflicting model rows remain in additional findings. The existing
trace keys are unchanged: the uncertain list now includes explicit uncertainty and
verdict/rating conflicts at any score, as well as the middle-band assessments.

Ratings still describe the median of available model ratings, or the mean of
available frame ratings. Inconclusive replies retain their numerical contribution
to that descriptive score and remain visible in actual model counts. A numeric
rating therefore does not by itself determine the combined verdict. Ratings are
not calibrated probabilities.

Provider prompts, models, parsers, raw replies, thresholds, sampling, permissions
and structured schemas are unchanged. In particular, the parsers' existing
fallback for an absent/unrecognised verdict is unchanged; this correction respects
the normalised verdict and preserves every explicitly Inconclusive reply. Pasted
Second Opinion notes and optional audio/vendor observations remain outside visual
voting. A deep pass cannot silently merge a report from the old method into the
new one because the existing method-identity check rejects a mismatch.

## Comparison using the same saved replies

Thirty-three saved provider replies were reused locally with network access
disabled. No new inference or media send was performed. Each revised report has
a new report ID, the new method version, and a note identifying the preserved
original report and its date/method.

| Neutral example | Earlier combined finding | Revised combined finding | Indicative rating, unchanged |
| --- | --- | --- | --- |
| Example-211.pptx | Leaning authentic | Inconclusive | 26/100 |
| Example-351.png | Leaning synthetic | Leaning synthetic | 85/100 |
| Example-493.png | Leaning synthetic | Leaning synthetic | 78/100 |
| Example-644.jpg | Leaning authentic | Leaning authentic | 5/100 |
| Example-806.pdf | Leaning authentic | Inconclusive | 26/100 |

Three of four sampled PPTX images and two of four sampled PDF figures now remain
Inconclusive. The other sampled document images retain their directional findings.
Neither document reaches the unchanged strict frame-majority rule. Their combined
confidence changes from medium to low. The three still-image verdicts/confidences
and all frame/item ratings remain unchanged. All three models remain listed for
each example. Provider observations match the earlier reports, apart from the
timing of locally repeated credential/forensic checks.

This comparison establishes the correction's effect on these five examples. It
does not establish detection accuracy or recover authoring history from appearance.
Historical reports and demos keep their original method labels and findings.

## Verification and remaining review

Regression cases cover explicit inconclusive results across score bands, conflicting
verdict/score pairs, valid partial results, actual model counts, supporting lists,
single-model and failed/unchecked states, forensic isolation, credential overrides,
document majorities, provider parsing, exports and method-identity rejection.
The dated verification counts and local browser/export checks are recorded in
[`release/VALIDATION.md`](../release/VALIDATION.md).

Physical devices/projector and native PowerPoint/Keynote remain separate checks.
The release version, final rights/licence/contact metadata and publication decision
remain open. No public deployment or remote Git operation is part of this correction.
