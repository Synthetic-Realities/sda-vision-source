# Podcast Deposit Review

Checked 26 September 2026; updated after inspecting the researcher's two-page Zenodo capture. This reviews the July draft, recovered preview and local asset. It is not a new deposit or watermark test.

## Record status

The researcher has located the existing draft. The supplied capture,
`screencapture-zenodo-org-records-21302105-2026-09-26-09_07_47.pdf`, shows an
**unpublished preview** at record **21302105**. Both the Preview banner and Versions
panel state that it has not been published. The displayed July publication date
does not override that status.

The sidebar identifies **10.5281/zenodo.21302104** as the **all-versions DOI**,
consistent with the reservation in the [July draft](../docs/Zenodo_Podcast_Record_Draft.md).
The version DOI should be confirmed from the draft metadata; do not infer it solely
from the record URL. The capture also shows version v1 and the selected CC BY 4.0
licence. These are draft metadata, not confirmation of publication or rights clearance.

Earlier public requests to [the DOI](https://doi.org/10.5281/zenodo.21302104),
record 21302104 and the corresponding Zenodo/DataCite APIs returned HTTP 404.
The public API for record 21302105 also returned 404 in the follow-up check.
These findings are consistent with the captured unpublished state. Preserve the
existing draft: [Zenodo's DOI guidance](https://help.zenodo.org/docs/deposit/describe-records/reserve-doi/)
says deleting it loses the reservation. No new reservation is needed for this plan.

## Local asset check

| Field | Observed locally |
| --- | --- |
| File at the initial check | `examples/From_Mask_to_Vaccine_Mandates_podcast.m4a`; subsequently renamed by the researcher to `GoogleNotebookLMFrom_Mask_to_Vaccine_Mandates_podcast.m4a`, with identical SHA-256 in the later inventory |
| Size | 47,265,139 bytes |
| Audio | One AAC audio stream |
| Duration | 1,468.569252 seconds, approximately 24 min 29 s |
| SHA-256 | `58663a6a9e4b634bdb703ead0aaa7cd6dce7fbf97e70c3c1cc61b3311b94c0b4` |
| MD5 | `7156346e11d18e6b671641c5b5a90986`; matches the audio checksum displayed in the supplied capture |
| Method | Read-only hashing and ffprobe; no playback interpretation, model call or upload |

The capture lists `From_Mask_to_Vaccine_Mandates_podcast.m4a` (47.3 MB) and
`sda-vision-From_Mask_to_Vaccine_Mandates_podcast_m4a-1.pdf` (4.5 kB). Matching the
displayed audio MD5 establishes consistency with that captured listing; the remote
audio itself was not downloaded. The supplied capture is not the original report PDF.

Its report preview visibly includes a **Gemini SynthID note pasted by the researcher**
claiming a watermark finding. This recovers evidence of the note's inclusion in the
draft report. It does not independently validate the vendor finding. The report's
visible decision text also says there was no confirmed C2PA AI assertion or SynthID
watermark override; the pasted reply and structured decision state must remain distinct.

The separately inspected cached JSON is dated **11 July 2026, 08:20:28 UTC**,
identifies audio input and version 0.1.0, and has no original-file hash or
method-version field. Its top-level record has meta/consensus/providers/frames only.
The July draft instead names a **10 July, 22:05 UTC** report. Recover the actual
attached PDF and original checker reply, record their hashes/dates and reconcile
their relationship to the audio. Preserve the historical report and cached JSON
as separate records.

## Editorial reconciliation before publication

| July claim | Current treatment |
| --- | --- |
| “Independently verified” SynthID throughout the file | The capture shows the historical pasted Gemini claim. Attribute it to that reply; recover its original context and check supported scope. A free-text reply alone is not a structured verifier result. |
| “Known-watermarked” / “rights-clean” ground truth | Separate creator-declared generation, any verified watermark evidence, and redistribution rights. Confirm each before using these labels. |
| Transcript model scores described as audio evidence | Identify them as readings of a machine transcript. Retain actual historical values only in a correctly matched report, with “Not a calibrated probability”. |
| PDF “included in this record” | The capture confirms a PDF is listed in the draft. Obtain the actual file, confirm its hash/date and review it before publication. |
| Showcase contains no original audio | Historical showcase builds included the podcast original. The new five-example selection excludes the podcast. State the actual published bundle's contents; the July blanket sentence is outdated. |
| Proposed CC BY 4.0 licence | Legal text is retained unchanged in the old draft. Confirm authority to license the audio and included source/report material before activation. |

## Proposed replacement description for researcher review

> This podcast-style audio overview was created by Samantha Martin using Google NotebookLM. The July project record gives the creation date as 10 July 2026 and identifies the source paper as Martin and Vanderslott's study of mask and vaccine mandates (DOI 10.1016/j.vaccine.2021.10.031). The creator declares the recording to be AI-generated.
>
> The supplied local M4A runs approximately 24 minutes 29 seconds. Any accompanying SDA Vision assessment describes model interpretations of a machine transcript, with the model identifiers and date recorded in that report. Those ratings are not calibrated probabilities. AI-origin detection from the sound itself is outside this workflow.
>
> The recovered Zenodo preview includes a historical report with a pasted Gemini reply claiming a SynthID finding. The original checker context, its supported audio scope and its relationship to the deposited file require reconciliation before the record describes that check as independently verified.
>
> The asset is intended to support synthetic-media research and teaching. Final files, reuse terms, source-material rights and related software identifiers will be confirmed before publication.

This proposed text does not change the source-paper citation, legal licence text, original audio or historical findings. Resolve the review statements before pasting a final public description.

## Small completion checklist

- [x] Locate the existing draft through the researcher's capture: record 21302105, unpublished preview, all-versions reservation 21302104.
- [x] Match the local audio MD5 to the checksum displayed in the capture.
- [ ] Confirm draft access and version DOI in the owning account; check that the current file listing still matches the capture.
- [ ] Obtain the actual attached July report and original checker response; record their exact-file relationship and scope.
- [ ] Confirm authors/ORCID, affiliations, source-paper details, rights and the proposed licence.
- [ ] Select deposit files and revise the description using supported, attributed statements.
- [ ] Add the app's separate repository/software DOI when real identifiers exist.
- [ ] Review the exact record and give publication approval.

No new account, DOI reservation, external media upload or publication was made by this review.
