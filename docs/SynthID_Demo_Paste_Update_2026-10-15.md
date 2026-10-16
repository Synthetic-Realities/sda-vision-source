# SynthID Demo: Paste-Only Replies

15 October 2026. Local interaction revision to the recovered 0.1.3-rc.1 source.
The researcher requested a prepared-examples-only demo with a simple return
step after using SynthID Detector. This record describes implementation and
testing, not a new ethics approval or a change to the scientific method.

## Changes

| Surface | Behaviour |
| --- | --- |
| Recorded demo, Community and Developer views | Paste the full SynthID reply into one field; it is retained immediately in browser memory. |
| Media selection | Prepared examples and their supplied page/slide images only. No media file input in the demo's SynthID panel. |
| Context | Source example, offered material name/hash where available, and entry time are filled automatically. These describe offered material, not an independently verified external upload. |
| Multiple slides | Each prepared slide has its own reply. Switching between slides preserves their respective replies. |
| Exports | Session JSON, Markdown, CSV, PDF and PPTX, plus Community summaries, include the pasted reply and its scope. |
| OpenAI | The existing image checker and paste box remain under the explicitly named "OpenAI image checker and Gemini" section. Image-only shortcut behaviour is unchanged. |
| Research interface | Existing structured external-check form, file binding, attestation and six statuses remain available. |

Demo replies use the additive browser-session field `synthidReplies`. They have
no outcome, score, checked-file hash or check-time claim. Offered-file hashes
retain their separate meaning. A generic error stays an exact pasted reply;
it is not promoted to an inconclusive or positive detector finding.

Recorded reports, cached graphs, scoring, provider prompts, C2PA policy and the
`external-check-v1` research schema are unchanged. Clearing a reply removes its
session entry. Changing an example or reloading/closing the page may discard
session notes, as described beside the field. No notes are sent to a model.

## Local Preview

- Revised recorded demo: <http://127.0.0.1:8893/#community>.
- The October demo at port 8891 and research preview at port 8892 were left intact.
- Build: `.review-cache/synthid-demo-paste-2026-10-15/dist-showcase` in this repository.
- Earlier source checkpoint: `d64e2c8`. The October source archive and guide PDF
  remain unchanged. This revision has not been published or repackaged for release.

## Verification

| Check | Result |
| --- | --- |
| TypeScript and production demo build | Passed using the existing local Node 20 runtime and matching installed lockfile dependencies. |
| Existing frontend checks | All 12 scripts passed. |
| Demo-specific external checks | Passed with `VITE_SHOWCASE=1`; demo has a paste field and no file/date/attestation form; research retains its structured form. |
| Session isolation and escaping | Exact reply retained, length bounded, separate material entries, blank-entry removal, report unchanged, text/HTML escaping checked. |
| Exports | JSON/Markdown/CSV checked; PDF and PPTX generated with local assets and their text inspected for both replies and scope. |
| Browser | Prepared PDF, image and slides checked. Slide 1 and 14 replies stayed separate; changing example cleared the visible reply. No file inputs in the loaded demo; OpenAI action enabled for an image. |
| Layout | Desktop and narrow viewport inspected; no horizontal overflow in the checked views. The browser's existing zoom affected CSS viewport dimensions; physical devices were not tested. |

No external checker was opened, no media was uploaded and no paid inference
was run. Current external service availability was not revalidated. Physical
devices and native PowerPoint rendering remain researcher checks.
