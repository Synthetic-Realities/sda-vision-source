# Guide And Participant Instructions: Local Review

Date: 15 October 2026. Editorial edition: 1.7 review. Unpublished.

## Materials Updated

- Eight-page facilitator PDF, with revised external-check activity, reflection
  notes, preparation guidance and a current screenshot of the paired checkers.
- Separate one-page participant PDF and editable Markdown instructions.
- In-app facilitator guide and standalone HTML fallback, including a direct
  participant-instructions link and both PDF downloads.
- Activity previews, repository guide, workshop activities, README and current
  recorded-demo guidance.

The return step is now: paste the complete reply into **SynthID results** or
**OpenAI results**. Instructions describe prepared examples only, the image-only
OpenAI shortcut, separate SynthID page/slide notes, optional external uploads,
service recipients and terms, and downloading session notes before leaving.
The former Gemini chat route and detailed file-identity form are no longer
presented as participant steps in this recorded demo.

Pasted replies stay separate from the recorded findings and scores. Historical
Gemini replies and all three-model findings remain unchanged. This documentation
revision changes no prompts, models, aggregation, schemas or scientific methods.

## Verification

| Check | Result |
| --- | --- |
| Facilitator workflow regression test | Passed: UI labels, scope, recipients, storage and linked assets |
| Community language and SHOWCASE external-check tests | Passed |
| Production recorded-demo build | Passed |
| PDF inspection | Eight guide pages and one participant page rendered and visually reviewed |
| PDF text checks | New paste-box labels, metadata, terms/charges and score separation present; old form steps absent |
| Local download check | Both PDFs and eight other linked assets served with matching bytes |
| Browser | In-app guide, participant jump link and standalone page checked |
| Responsive check | Desktop and 320px CSS width; no horizontal page overflow in participant instructions |
| Browser console | No captured warnings or errors |

The PDFs embed the project Noto Sans and ReportLab's bundled Vera Bold fonts.
The renderer used a project-local font configuration and cache. Older workshop
screenshots illustrate the unchanged stages; the paired-checker screenshot is
from the 15 October demo. The full guide retains its original source credits.

Local build and authoring scripts are retained under
`.review-cache/guide-paste-2026-10-15/`. The earlier guide PDFs, frozen demos and
older app were preserved. The unrelated `frontend/dist-conference/` folder was
left alone.

## Review And Publication

Preview: <http://127.0.0.1:8895/facilitator.html#participant-checks>.

No vendor check, paid inference, external media upload, Git remote operation,
site deployment or Zenodo change was performed. Live service access and file
limits were not retested. Review the pace and tone with the facilitator before
release. When publication is authorised, reconcile the new guide version and
participant sheet with the explicit release-pack allowlist, public site and
Zenodo metadata; those publication steps remain separate.
