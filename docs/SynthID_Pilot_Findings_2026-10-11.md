# SynthID Detector: document-component pilot

11 October 2026. A small, authorised capability pilot through the normal
[SynthID Detector website](https://synthid.com/) in Dr Sam Martin's signed-in
Chrome session. These are local observations, separate from SDA Vision's
saved model assessments and published releases.

## Findings

| Approved item | Material submitted | Observed outcome |
| --- | --- | --- |
| `infographic.pdf` | Original not submitted | PDF was absent from the portal's offered formats. |
| `presentation.pptx` | Original not submitted | PPTX was absent from the portal's offered formats. |
| First page of `infographic.pdf` | Existing 3200 × 1787 PNG, 1,579,328 bytes | SynthID detected; Google AI identified. |
| First slide of `presentation.pptx` | Existing 3200 × 1800 PNG, 4,045,830 bytes | Image accepted and displayed; detection ended with a generic service error. No watermark finding. |

Two PNGs were submitted once each, with no image alteration or additional
uploads. The complete originals were assessed for offered-format support;
they were not sent to obtain a server rejection. The whole-document versus
component comparison therefore remains unavailable through this interface.

## Exact visible results

The PDF-page image result, observed at approximately 11:17 UTC:

> SynthID was detected
>
> This media was made or edited with Google AI
>
> Please note that this media may have been edited further since then.

The presentation-slide image result, observed at approximately 11:18 UTC:

> Something went wrong!
>
> Please wait and try again later

The service supplied no cause for the error. It does not establish an absent
watermark, an unsupported PNG, a size limit or human authorship. There was no
resubmission in this pilot. Neither response supplied a numeric score.

## Offered formats

The normal upload control's **Media: Supported file types** tooltip listed:

- Images: JPG, JPEG, PNG, BMP, WEBP, AVIF, HEIC, HEIF, TIFF, TIF, GIF.
- Video: MP4, MOV, WEBM.
- Audio: WAV, MP3, OGG, FLAC, AAC, M4A.

PDF and PPTX were absent. Size, duration and quota limits were not established.
The positive PNG result demonstrates this particular image was processed;
the generic error on the larger PNG does not establish a size threshold.

## What this supports in SDA Vision

Keep the complete document as the object of discourse analysis, with each
external check attached to the material actually examined. For this PDF page,
the detector supplies evidence of Google AI involvement in the rendered image.
It does not locate a specific graphic or passage, assess every page, or assess
the truth of the document's claims. The slide currently has a failed external
check, distinct from the saved model readings.

The immediate interface can offer an explicitly identified page or slide image
for external watermark checking, including its page/slide number and original
document identity. The complete PDF/PPTX can remain available for source and
discourse review. Current portal coverage should be described as image, audio
and video checking; the reason for the PDF/PPTX image workflow is the offered
formats, rather than an established document-size limit.

Record the service, operator, date, file hash, original/derivative relationship,
exact response and scope. Keep detected, not detected, failed, unsupported and
not checked separate. A new external finding stays alongside existing model
assessments; any change to score aggregation needs its own method review.

## Evidence and verification

Local evidence folder, relative to the main workspace:
`.review-cache/synthid-pilot-2026-10-11/`.

- `pilot-record.json`: permission scope, exact paths, file sizes, SHA-256 hashes,
  attempt counts, results and evidence hashes.
- `infographic-page-1-result.jpg` and `.txt`: page screenshot and visible DOM.
- `presentation-slide-1-result.jpg` and `.txt`: error screenshot and visible DOM.

All four approved original/derivative file hashes were verified unchanged after
the pilot. Screenshots were visually checked against the submitted samples and
their responses. No source media, historical analysis, app code, provider
prompt, score, live website, GitHub remote or Zenodo record was changed.

Unresolved: a successful slide check, whole-document detection support,
portal-specific limits, other pages/slides and audio/video behaviour. This
two-image pilot does not estimate detector accuracy or general robustness.

See the [capability review and implementation plan](SynthID_Update_Review_2026-10-10.md).
