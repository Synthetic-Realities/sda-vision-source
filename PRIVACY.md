# Privacy & data-protection notice

> **For researchers and ethics/DPO review.** This describes how SDA Vision handles data.
> Use it alongside your institution's processing record and advice from its
> Data Protection Officer (DPO). *(Editorial review, 2026-09-27;
> the researcher reports approvals are held. Public-safe references and the release
> crosswalk are prepared in `release/PROCESSING_RECORD.md`.)*

## The short version

The **local research app** runs on your machine and uses your own provider
accounts and API keys (BYOK). Keys are read from `.env` or the process
environment. Enabled external analyses send the relevant media, excerpts, text
and context to configured providers. Local checks and preparation run on your
machine. The app does not collect usage telemetry.

The **public saved-results demo** serves prepared examples and reports through
GitHub Pages. Visitors explore that set and enter browser-session notes; file
uploads and new provider analyses are outside this profile. GitHub Pages host
logging and privacy terms apply separately from the app. The **Conference
profile** supports presenter-authorised processing of listed originals; its
authentication, provider calls and storage are described in the
[Conference runbook](docs/CONFERENCE_RUNBOOK_2026-09-26.md).

The **MIT licence covers project code**. Media and datasets retain their own
permissions and terms. GDPR/UK GDPR responsibilities apply to the processing
of personal data. The data-flow table below describes the full research app.

## What leaves your machine, and to whom

| Input | What is sent off-device | To whom | Stays fully local |
|---|---|---|---|
| Image | The image pixels (base64) | The vision vendor(s) you keyed (Anthropic / OpenAI / Google) | — |
| PDF / PPTX | Sampled page/figure/slide **images** and supplied context; when no frames are extracted, available document text is analysed | Same model vendor(s) | Original container; visual-route extracted text is used locally in the report |
| Video, normal analysis | Sampled **frames** (images) | Same vision vendor(s) | Original container and soundtrack; audio tracks and bounded signal windows are inspected locally |
| Audio (incl. NotebookLM overviews) | Transcoded audio for **transcription**; transcript and supplied context for content analysis | Google first, OpenAI transcription fallback; then enabled Anthropic / OpenAI / Google analysis models | Original file |
| Text / transcript | The text | Same vision vendor(s) | — |
| **Provenance & forensic checks** | **Nothing** | — | **C2PA credential reading, perceptual hashing, and local forensics run entirely offline** |
| Optional note scoring | First 4,000 characters of a pasted note, only after clicking Add note to scoring; adjacent text discloses the recipient | Anthropic; configured summary model | Original pasted note remains in browser-held report |
| Optional annotation lane | Sampled visual frames and supplied context, on explicit request | Enabled model providers | Human check records remain in browser-held report and exports |
| Optional soundtrack assessment | Up to 20 seconds from a selected audio track, converted to mono 16 kHz PCM WAV; explicit checkbox and button required | Google Gemini, using the configured Google key/model; no fallback recipient | Original file; original-container C2PA inspected before excerpt extraction |
| Optional Suno credentials check | Complete original audio/video file, including all tracks and embedded metadata; neutral transport filename; explicit checkbox and button required | Suno's public developer credentials API; no API key sent | File hash and returned vendor result; no automatic retry, public-URL lookup or redirect following |
| Workshop responses and summaries | No response text is sent by the workshop summary generator | — | Responses stay in page memory; PDF/PPTX/CSV are generated in the browser using local/same-origin assets |
| Google image source search | SDA opens Google's search page; the user chooses whether to attach material there | Google browser service, if used | SDA does not automatically attach the selected file |

Image and text analysis also send the optional caption/context. C2PA uses an
offline policy with locally available manifests and trust material.
Remote manifests, online revocation and trust-list refresh are outside this
check. Signer trust and content-binding integrity have separate recorded statuses.
Suno's optional API response records the vendor's credential finding separately
from local validation. Failed requests and missing provenance leave origin
unresolved by that check. Each optional audio/vendor request has its own consent
control. AI-origin detection from the sound itself is outside this workflow.

Each vendor has its own terms and data-retention / training policies. Review provider terms
alongside SDA's local storage and access settings when choosing which services to enable.

The **Second Opinion** controls open the selected external service when clicked;
the Gemini control also copies a checking prompt to the clipboard. You choose
and attach material on that service, using its account settings and terms,
which may differ from the developer API. Start a fresh chat or check for each
item and label document replies with their frame names.

Pasted notes stay with the browser-held report. In the full research app, the
separate **Add note to scoring** action sends the first 4,000 characters to
Anthropic, using the configured API account; provider terms and charges apply.
That score describes the note and remains outside the combined assessment.
Public and Conference profiles keep note scoring unavailable.

## What is stored

- Community/trainer activity responses persist across activity and view changes for
  the selected item, then reset on item change, reload, close or confirmed New session.
  Workshop downloads include responses by default; untick their inclusion to omit
  them. End session downloads without clearing. Downloaded copies have their own
  lifetime. Check the downloaded file opens in the intended location before
  clearing a session.
  These responses stay separate from provider inputs and automated scores.

- **Default mode** (`DEV_MODE=false`): analysis reports are not saved server-side.
  Results live in the browser session and exported files. Audio/video processing and
  some export rendering use temporary local disk files; these are removed by the app
  after normal processing. A crash or interrupted cleanup may leave temporary files.
  Temporary-file cleanup is ordinary deletion; secure erasure is not guaranteed.
- **Dev mode** (`DEV_MODE=true`, your own machine only): each analysis is saved to a local
  `dev_runs/` folder — the report plus a small thumbnail of the source image, its filename, and
  any text extracted from it. Research mode saves **unencrypted reports locally until you
  delete them**. This folder is git-ignored and excluded from the release pack. Use an
  access-controlled machine and follow the project's retention schedule.
- The Public preview toggle does not change `DEV_MODE` or retention. Browser downloads,
  local server/access logs, operating-system backups and clipboard contents have their
  own lifetimes. The app does not manage their deletion. Pasted notes/annotation edits
  are browser-held, included in exports, and may also be saved in a later deep-pass
  report when research mode is enabled.
- Optional soundtrack assessments and Suno results live in the browser-held report
  and exports. Successful Suno checks retain the structured vendor response, which
  may include content identifiers; review these before sharing. Optional results
  are not separately saved by their API endpoints, but can be included in a later
  saved deep pass. Excerpt hashes, time windows, consent flags and model identifiers
  are recorded. These are research records, not signed consent attestations.

## Personal & special-category data

Images, transcripts and documents may identify people, speakers or creators and
may reveal **special-category data**, including health, political opinions or
religious beliefs. Apply your institution's data-protection policy and the
appropriate safeguards, including when material comes from public sources.

## Who is the data controller?

Controller and processor roles depend on who determines the purposes and means
of the actual processing. Work with your DPO to identify the responsible
institution, each vendor's role and the arrangements appropriate to your research.
Record these alongside the chosen local or hosted configuration.
See the [ICO's controller/processor guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors-a-guide/)
(checked 2026-09-19). Shared hosting changes the data flow and requires a separate assessment.

## Data Protection Impact Assessment (DPIA)

Use the institution's approved processing record and DPO advice to determine the scope
of any DPIA and whether a change requires amendment. Review changes to providers,
retention or processing purposes against that
approved scope. Record any institutional decision alongside the technical
configuration. This notice supports that review; the institution supplies the
applicable legal and ethics determination.

## Planning your research use

- [ ] Configure the API accounts and keys approved for your research.
- [ ] Review each chosen vendor's terms, retention and use-of-input policies.
- [ ] Identify personal or special-category data and apply your institution's safeguards.
- [ ] Establish the lawful basis and complete a DPIA where required, with institutional/DPO advice.
- [ ] Use research mode on your own access-controlled machine; keep `dev_runs/` local and delete records according to the retention schedule.
- [ ] Before shared hosting, obtain an assessment of the changed processing and security controls.

## Contacts

- **Your institution's Data Protection Officer** — confirm the controller/processor allocation for your set-up.
- **Information Commissioner's Office (ICO)** — UK supervisory authority. https://ico.org.uk · helpline **0303 123 1113**.

*SDA Vision supports documented research review. Its current report wording is:
"Research assessment. Review alongside source information and context." Historical
reports retain the wording recorded at the time. The [MIT licence](LICENSE) sets
out the software terms, including its warranty provisions.*
