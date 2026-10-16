> Current update: the researcher confirmed MIT and requested the tested Pages
> launch. See [Pages acceptance](PAGES_ACCEPTANCE_2026-09-26.md) for the initial
> public preview. The remaining version/tag/DOI and conference rehearsal items
> below concern the later versioned software/Zenodo release, unless explicitly
> identified as unresolved in that acceptance record. Earlier private-checkpoint
> and dependency decisions are retained as preparation history.

# Release Readiness: 26 September 2026

The public saved-results workflows, separate Conference profile and automated
installation/acceptance work are implemented. **224 tests passed in both the
working environment and a fresh isolated macOS extraction.** This is engineering
readiness for researcher rehearsal; it does not mark a public release or live
conference deployment complete.

The subsequent neutral-bundle preparation passes **239 local Python tests** and
TypeScript/research-frontend build checks. This includes new media/hash/private-file
boundaries and generated PDF/JPEG/signed-credential fixtures replacing tests'
dependencies on particular researcher example filenames. The 224-test extraction above remains a historical check;
the updated source candidate has its own verification record.

Example handover update: five files are selected for local preparation, with
researcher-supplied source/product descriptions and credits matched to the
inspected hashes. PDF/PPTX use scopes and the four video decisions are recorded
privately. Five neutral byte-identical copies and explicit hash-validated selection
manifests are now prepared. New saved results and the final Pages candidate remain
to be prepared. These form answers do not authorise publication, external
media sends or paid inference; the remaining release checks below still apply.

Start with the [acceptance record](../docs/DEMO_ACCEPTANCE_2026-09-26.md),
[offline example worksheet](../docs/EXAMPLES_OFFLINE_HANDOVER_2026-09-26.md),
[Conference runbook](../docs/CONFERENCE_RUNBOOK_2026-09-26.md) and
[BMJ video script](../docs/BMJ_VIDEO_SCRIPT_2026-09-27.md).

## Immediate Dates

- **27 September:** record BMJ's longer video, landscape, maximum 2:30. The draft
  has 252 spoken words and confirmed Dr Sam Martin/SDR UK (UKRI)/MMU introduction.
- **23 October:** abstract deadline; draft prepared, word limit unconfirmed.
- **29 October:** Problem Clinic, 70 minutes of repeated groups up to ten on this
  Mac/projector. Also invited to the shorter Innovation café.

One or two examples cleared for the public recording are sufficient tomorrow.
The first mixed batch now contains two generated images, a source-documented
photograph, the selected 15-page PDF and 14-slide PPTX. Final media approval did not
block engineering. See the [next-step handover](NEXT_STEPS_GITHUB_PAGES_ZENODO_2026-09-26.md).

## Current Outputs

| Output | Present position | Remaining work |
| --- | --- | --- |
| Private GitHub repository | Synthetic-Realities/sda-vision created; the authorised organisation administrator CLI access verified; README only | Review/import a clean source export, resolve licence/media choices, then separately approve public visibility |
| Public demo | Fixed examples and saved results; batches, browser-only notes and five session export formats tested; zero API/provider requests | Final examples/rights, physical-device checks and exact Pages publishing candidate |
| Conference profile | Presenter authentication, exact-file allowlist/hash checks, consent, attempt/concurrency/timeout limits and saved fallback instructions implemented | Chosen originals/accounts/run allowance, actual microphone/projector rehearsal; decide local or Render hosting |
| Render | Connection verified; schema-valid Docker Blueprint and empty-media context prepared | Actual Linux build/runtime, resource/region/cost review and any deployment authorisation |
| Installation | Clean extraction/setup, hash-locked Python packages, npm ci, TypeScript/Vite, pip check and 224 tests pass | Independent Windows/Linux installation and physical devices remain untested |
| Dependency review | image-size override 2.0.4 resolves the two known npm advisories; audit now reports zero | Full notices/licence review, including PyMuPDF and native tools |
| BMJ materials | Confirmed brief, 2:30 script and abstract draft prepared | Timed human take, example recording rights, abstract word limit and final editorial review |
| Zenodo software | Metadata templates and publication workflow available; sole author Dr Sam Martin, MMU, ORCID and exact UKRI4010 funding acknowledgement confirmed | Final release version/licence/DOI, public contact, accepted archive checksum and publication decision |
| Podcast media | Unpublished preview 21302105; reserved all-versions DOI 10.5281/zenodo.21302104; audio checksum matched capture | Version DOI, matching report/checker evidence, metadata and rights |

## What was reconciled

- Community Workshop and the illustrated facilitator guide share Notice / Discuss / Check / Reflect activities, optional multiple origin choices and separate participant responses.
- Workshop PDF/PPTX/CSV summaries are generated in the browser. Responses are included by default and can be excluded; their content remains separate from research findings.
- End session downloads without clearing. New session requires acknowledgement; changing input or reloading still resets in-memory responses.
- PDF/PPTX summaries include the selected image or a labelled available thumbnail. CSV is text-only. Unsupported font characters receive a CSV fallback.
- Full research PDF/PPTX use structured tables and continuation pages/slides, retaining long notes, all supplied evidence and recorded text. Historical observations retain their original text.
- The dependency/asset review now covers jsPDF, PptxGenJS, Marked, Noto Sans and the approved decorative illustration.
- The source archive omitted the illustration imported by CommunityView. A regression reproduced the omission; the allowlist now includes the exact PNG and its provenance README. The workshop helper test and dated reconciliation documents are included explicitly.
- Governance wording is recorded separately from scientific method `publication-repair-2026-09-24.3`; no prompts, thresholds, trust policy or provider permissions changed in this reconciliation.
- The older GitHub/showcase guides now point to current release instructions. The static build defaults to separate staging outputs; the old instructions to replace frozen outputs or copy every example are superseded.

## Later method correction

The researcher-approved revision `verdict-consistency-2026-09-26.1` preserves
explicit Inconclusive model replies as undecided observations. Five reports were
recomputed locally from the same saved replies; both document findings become
Inconclusive, with all numeric ratings and the three image findings unchanged.
The full 298-test suite passed with network access disabled. See the
[method record](../docs/Method_Change_Record_2026-09-26.md) and
[latest validation](VALIDATION.md). Earlier method/build checkpoints above remain
historical evidence. The old source archive needs refreshing before import.

## What Remains Before Release

1. Rehearse tomorrow's recording with the actual capture/audio setup and selected
   examples. Scope any fresh provider run explicitly; the implementation tests
   used mocks or a zero-run backend with no provider keys.
2. Review final originals/credits/redistribution, refreshed cached exports and
   source/download manifests. Current local candidates remain unapproved.
3. Complete Mac/projector, physical-device and PowerPoint/Keynote checks. Desktop
   and touch viewport tests, plus LibreOffice rendering, do not replace them.
4. Complete the processing-record crosswalk, software/dependency rights and
   software/podcast metadata. Retain unresolved C2PA signer-trust scope.
5. Freeze the software and static site separately, finish the conference packs
   against those versions, and approve exact destinations/files before publication.

No new paid inference, media upload, remote Git push, Render service, public
repository change or Zenodo publication was made during this implementation.
[Installation/release plan](INSTALLATION_AND_RELEASE_PLAN_2026-09-26.md),
[podcast review](PODCAST_DEPOSIT_REVIEW_2026-09-26.md).
