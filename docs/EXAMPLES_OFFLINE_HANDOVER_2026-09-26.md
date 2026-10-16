# SDA Vision: Offline Example And Batch Handover

Prepared 26 September 2026. This is the researcher's working sheet while app
implementation proceeds. You can edit a copy offline. Unfilled items do not block
development using local test fixtures and mocked provider replies.

**Handover received:** the researcher placed the prepared media in `examples/` and
confirmed authorisation to use all images. The 26 September local inventory found
18 originals across image, PDF, PPTX, video and audio. All were recognised by the
app ingestion path; documents/videos were sampled with a two-frame cap, without
provider calls. The detailed private review and prefilled source worksheet are
`.review-cache/example-review-2026-09-26/PRIVATE_EXAMPLE_READINESS_2026-09-26.md`
and `PRIVATE_MEDIA_SOURCE_HANDOVER.csv` in the same directory. No further media
creation is needed for the first batch.

**Form answers received:** the first five files now have researcher-supplied
source/product descriptions and credits recorded privately against the inspected
hashes. Public display/download, BMJ recording and conference uses are confirmed
for the selected PDF and PPTX. Dreamina is presenter-display only; Runway stays
private; the two TikTok restrictions remain unchanged. Dates/edits marked “Not
recorded” stay open. These entries are sufficient for local preparation; neutral
copies, exact build selection and matched results are the next engineering work.
The private `PRIVATE_PREPARATION_SELECTION.json` records the five selected files
and public exclusions. The form does not authorise publication or fresh paid calls.

**Naming update:** participant-facing examples need neutral IDs. This supersedes
the earlier suggestion to put provider names in teaching-pack filenames. Keep
this completed source worksheet and its answer key separate from participant
materials; a blank template may be shared, but a completed key is private.

## What To Prepare First

Start with **three images** if that is easiest. The first complete batch should
contain **five files**. The app will hold up to ten queued items and open/analyse
up to five selected items per batch.

**Recording priority:** the BMJ recording is on **27 September 2026**. One or two
cleared examples are sufficient for that first walkthrough; the full mixed-format
batch can follow. Indicate permission for public video inclusion separately from
permission for visitors to download the original. The event/recording plan is in
[BMJ_RECORDING_AND_SESSION_PLAN_2026-09-26.md](BMJ_RECORDING_AND_SESSION_PLAN_2026-09-26.md).

| Slot | Suggested original | Why it is useful | Your filename / decision |
| --- | --- | --- | --- |
| 1 | One OpenAI-generated illustration | Researcher-reported creation history; Second Opinion teaching example | Selected; source/credit recorded privately |
| 2 | One Google-generated illustration | Second illustration workflow; the selected subjects differ, so this is not a matched provider experiment | Selected; source/credit recorded privately |
| 3 | One photograph with a documented source and permission for the intended use | A source-documented comparison; detector findings remain separate | Selected; source page and credit recorded privately |
| 4 | One PDF using cleared material | Page/figure sampling, preview and report export | Selected 15-page original; source/credit/use scopes recorded |
| 5 | One PPTX using cleared material | Slide sampling and presentation/export checks | Selected 14-slide original; source/credit/use scopes recorded |

The original suggestion of a 1–3 page PDF and 2–3 slide PPTX was for a manageable
rehearsal. The supplied longer originals passed local sampling checks and need
not be recreated. Any later excerpt or document made from the selected images
needs its own source/derivative mapping; it is not an additional independent
generation example.

Optional later set: one short permitted video and one short audio clip, with any
transcript supplied separately. The existing podcast has a separate Zenodo review;
there is no need to recreate it for this first batch. Keep a longer document or
unsupported/failed-check example for a later edge-case rehearsal if useful.

## Neutral Participant Names And A Private Source Key

The app currently displays filenames in example pickers, previews, batch rows,
graphs and reports. Image/frame prompts also receive the input filename. A visual
alias alone would therefore leave other routes for a source clue to appear.

Use neutral names such as `Example-001.png`, `Example-002.pdf`,
`Example-003.pptx` and `Example-004.m4a`. These are format illustrations, not a
mapping of numbers to providers. Allocate IDs without encoding generator, AI/human
origin, production order or an odd/even source pattern. Keep the correct extension.
Avoid OpenAI, Google, NotebookLM, OA, NLM, AI, synthetic or authentic in names shown
to participants or passed to a model for a source-uninformed check. Even small
abbreviations can cue an answer, particularly across repeated examples.

You can retain OA/NLM in your private working filenames or source record. There
is no need to recreate a file already made: keep the downloaded original and let
Codex prepare a byte-identical, neutrally named presentation copy. Renaming/copying
the file without re-export does not change its file contents. Codex will compare
SHA-256 hashes to establish that the original and presentation copy match.

A private working key has been created at
`.review-cache/example-review-2026-09-26/PRIVATE_EXAMPLE_KEY.md`. Record neutral ID,
original filename, actual generator/product/model, source and any relationships
between a document/podcast and its inputs. This directory is Git-ignored and is
outside the explicit release packaging allowlists; do not copy its completed key
into the public site, examples directory, source archive or participant downloads.

Neutral filenames remove one source of clues. Visible branding, spoken credits,
document content, metadata, credentials, report text and download links can still
reveal origin. Preserve the original signals being examined; do not strip metadata,
remove watermarks or edit media simply to hide the source. If a separate teaching
derivative is needed, retain the original and record the transformation and hash.
Respect any attribution that must accompany display or redistribution.

For the activity, record participants' initial observations and impressions in
**Notice / Discuss**, then introduce the findings and the documented source during
**Check / Reflect**. The current app allows navigation between steps; it does not
enforce a hidden answer key or a controlled blind evaluation. A static website's
bundled assets/results remain inspectable. A later controlled reveal feature would
need its own UI and download checks.

## Preserve And Document The Originals

- Keep the exact files downloaded from the generators or obtained from the source.
  Do not re-save, screenshot or add labels to their pixels simply for this handover.
- Keep original download names in the private source record; use neutral IDs for
  app/presentation copies as described above. Record the actual creation date in
  the source key instead of using it to signal origin in the participant filename.
- Record the actual product and model shown when creating the file. If the model
  was not displayed, write “Not recorded”; do not infer it later.
- Source labels describe documented creation history, not a detector result.
  Use the neutral input name for any newly agreed analysis and retain the private
  mapping; changing a label later cannot remove information a model already saw.
  Preserve historical reports and their filenames as recorded.
- Retain originals used in PDFs/slides and note any crop, resize, export or edit.

## Copy This Record For Each File

```text
Working ID / batch slot:
Neutral participant ID and filename:
Original filename:
Presentation copy SHA-256 matches original: Codex to check
File type:
Your intended use: public downloadable example / conference only / undecided
Created or obtained on:
Creator or source organisation:
Generator product and model, if applicable:
Source page or public-safe reference:
Prompt or public-safe prompt reference, if applicable:
Known edits or transformations (or “Original download”):
Credit line you want displayed:
Reuse/licence details or permission record (or “To check”):
People, third-party artwork, logos or other material needing attention:
Related original(s), page/slide/frame mapping, if this is a derivative:
Use this file in the public website? yes / no / undecided
Allow visitors to download the original? yes / no / undecided
Allow this example and its credit to appear in the public BMJ recording? yes / no / undecided
Use this file in live conference analyses? yes / no / undecided
Workshop purpose / question to discuss:
Visible/spoken/metadata source clues to consider before showing it:
When to reveal the documented source and any required credit:
Anything you want Codex to check:
```

Mark missing facts “To check”. Selection for teaching does not require a positive
watermark/credential result. Keep confidential permissions and institutional
documents in their existing private store; a public-safe reference is sufficient
in this handover.

## Second Opinion Records

You may leave this until the app workflow is ready. If you perform a check in
Gemini or OpenAI yourself, keep the full reply with the exact file it describes.
Use one record per service/check:

```text
Filename actually attached:
Service and interface used:
Check date:
New chat/check, existing chat, or not recorded:
Prompt actually used, if any:
Full response (unaltered):
What the service says it checked:
Reported result, failure or unsupported coverage:
Original or extracted/converted image used:
Any separate screenshot/evidence filename:
```

A general visual opinion, watermark check and credential check cover different
questions. Preserve inconclusive, unavailable, failed and no-match outcomes as
returned. A missing signal does not change the known creation history. Do not
repeat paid checks merely to fill the sheet; live test accounts and spending will
be agreed for the exact rehearsal files.

In the public demo, new pasted replies will be browser-session notes, separate
from the saved analysis. Download the session notes before clearing or closing it.
The public demo will not submit those notes for automatic model scoring.

## Where To Leave The Handover

Keep your offline originals together with this completed sheet. When ready, use
the project's review folder:

`.review-cache/example-review-2026-09-26/incoming/`

That is a local review location, not the published example directory. Tell Codex
when the files are ready and where your edited sheet is. Do not overwrite the
existing examples or historical reports. Codex will validate the actual bytes,
prepare hashes/credits and show the exact public selection before release.

## What Codex Will Handle

- Inventory file types, dimensions/page counts/durations and SHA-256 checksums.
- Preserve originals and match derivative files to their sources.
- Prepare neutral presentation copies, compare hashes and maintain the private
  source mapping; prepare separately reviewed credits and asset-register entries.
- Configure the static example list and the server's conference example allowlist.
- Test single/batch selection, previews, notes, downloads and report/graph scope.
- Keep local engineering tests separate from any authorised fresh provider runs.
- Match new saved reports to the correct originals; never reuse an older report
  simply by changing its filename.

## Conference Details To Fill When Known

```text
Event: BMJ Future Health Problem Clinic, 29 October 2026
Problem Clinic: repeated mini sessions across 70 minutes, up to 10 delegates per group
Also invited to Innovation café: shorter format; running order to confirm
Presenter laptop: this Mac; browser/version to record at rehearsal
Projector / screen arrangement: Mac connected to screen/projector; adapter to check
Recording: 27 September 2026, for BMJ YouTube/social channels
Abstract deadline: 23 October 2026
Physical iPad / Android / other test devices available:
Expected internet access:
Preferred live examples (up to five for the initial batch):
Any example that must remain conference-only:
BMJ video: longer option, landscape, 2–2.5 minutes; maximum 2:30
BMJ abstract word limit/format, if supplied:
```

The immediate engineering work can proceed while you complete this sheet. Final
public media inclusion and the exact live rehearsal depend on these selections.
