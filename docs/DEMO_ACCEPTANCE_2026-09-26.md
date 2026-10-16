# Demo Profiles And Installation Acceptance

Delivery revision: `demo-profiles-2026-09-26.1`. This is a local implementation and
engineering verification record, separate from scientific method
`publication-repair-2026-09-24.3`. Prompts, aggregation thresholds and signer-trust
policy were not changed. Historical reports retain their own dates/models/methods.

## Result

The public saved-results demo and presenter-operated Conference profile are
implemented. Automated acceptance and a fresh macOS installation passed. Public
publication, a Linux/Render deployment, fresh provider inference and physical
device/projector rehearsal have not been performed by this work.

The main research app retains local file selection and its existing analysis
workflow. Its former Research/Public preview link is now labelled as a **layout**
control. The persistent delivery label identifies Research, Public saved-results
or Conference live analysis across all three presentation views.

## Implemented Behaviour

| Area | Behaviour |
| --- | --- |
| Public inputs | Listed bundled examples in Developer, Community Workshop and Train the trainer. No file input, drop import or live analysis route. |
| Public batches | Up to ten queued examples; up to five selected per operation; saved reports with per-item notes and combined session downloads. A whole-set relationship graph is explicitly labelled as the full cached set. |
| Public Second Opinion | Gemini/OpenAI replies and fresh-chat statements stay in browser memory, separate from the original report. View changes preserve notes; new selection/reset/reload requires saving anything wanted first. No note scoring is offered. |
| Public downloads | JSON, Markdown, CSV, PDF and PPTX session exports contain separate original findings and visitor notes. Original recorded-report downloads remain separate. CSV neutralises formula-like cells; downloaded Markdown keeps pasted markup literal. |
| Conference inputs | Presenter HTTP Basic authentication; only manifest-listed originals with matching SHA-256. Analysis receives an example identifier, mode and explicit consent, not browser media or audience text. |
| Conference limits | One run at a time; per-process attempt allowance; timeout; request-size/origin checks; arbitrary-upload, deep-pass, annotation, optional audio/vendor and note-scoring routes rejected. |
| Conference consent | Reset on new selection, changed batch selection and run start. Disclosure names enabled recipients, material, server API accounts, provider terms and charges. |
| Timeout cleanup | A native conversion may outlast a request timeout. The run slot stays occupied until conversion exits; later provider stages are skipped. Already-issued provider requests may still incur charges. |
| Conference retention | Research-run saving is disabled. Backend exports/graphs still receive reports; original media, native temporary files, access logs and provider retention have separate lifetimes. |
| Render preparation | Explicit staging allowlist, Docker recipe and schema-valid Blueprint. Providers disabled and allowance zero initially. No service provisioned. |

## Verification

Evidence directory: `.review-cache/demo-implementation-2026-09-26/` (local QA only).

| Check | Result and scope |
| --- | --- |
| Python suite | **224 passed**, seven upstream deprecation warnings. Includes 16 conference-boundary cases and new staging/packaging regressions. |
| Fresh installation | Separate ZIP extraction with no `.env`, virtual environment, node_modules, Git history or research runs copied. `setup.sh` installed hash-locked Python requirements, passed `pip check`, ran `npm ci`, TypeScript and Vite. **224 tests passed again inside the extraction.** |
| Runtime scope | Apple Silicon macOS with Python 3.12.14 and Node 20.20.1 available on this Mac; Python supplied by the Codex bundled runtime. This is an isolated installation on the same machine, not a clean operating-system or independent-user installation. |
| Fresh real-app routes | Actual `app.main` loaded from the extraction with provider keys absent and zero allowed runs. Authentication, blocked general upload route, listed original bytes, profile settings, zero-run gate and absence of `dev_runs` passed. |
| Frontend builds | Research, Conference, public showcase and workshop showcase built into separate review directories. Existing working/frozen dist folders preserved. |
| Public browser | Chromium at a project-style subpath; all three views, five-item batch, selection limit, dropped-file rejection, paste/clear/view-switch/reload, unchanged original JSON and five session export formats. **36 static GETs; zero API/provider/upload requests.** External origins and non-GET requests were blocked by the test. |
| Workshop variant | All three views, saved result and no upload controls; Second Opinion editors hidden as configured. Google source-search links remain a separate manual feature. Zero API/provider requests. |
| Conference browser | Four mocked attempts: successful single/batch and timeout. Consent and its reset, exact identifier-only payload, disabled note scoring, profile mismatch and 390px layout passed. No real inference. |
| Existing presentation regressions | Community/trainer consent, view switching, source-search behaviour, workshop responses, media types, failed checks, keyboard controls and tablet/phone viewport tests passed with mocks. |
| Prepared recorded exports | Regenerated MD/CSV/PDF/PPTX, item maps and set graphs for all seven cached records with current export code, without inference. Historical report JSON preserved byte-for-byte; source cache/frozen outputs untouched. All seven originals and 28 report downloads matched their local files over loopback HTTP; the refreshed public workflow passed again with 36 static GETs. |
| Export regressions | Workshop PDF/PPTX/CSV, image-bearing slides, long notes, reset behaviour and unsupported-character CSV fallback passed. Public long-note PDF had 12 pages; PPTX had 28 slides; both retained end markers and stayed within page/slide bounds. |
| Export visual inspection | PDF first/continuation pages inspected. PowerPoint rendered locally in LibreOffice; representative first/continuation slides inspected. Actual PowerPoint/Keynote and physical-device rendering remain untested. |
| Dependency check | Scoped override pins PptxGenJS's transitive `image-size` to **2.0.4**. `npm audit` reports zero known advisories after the fix. PDF/PPTX browser and image-export regressions passed. This is not a complete dependency/licence audit. |
| Render preparation | Blueprint validated against Render's official JSON schema. All hash-locked CPython 3.12 Linux x86_64 wheels downloaded successfully. Docker is unavailable here: actual Linux container build/runtime and resource sizing remain untested. |

The initial full-suite failure concerned a pre-existing PowerPoint test that read
text frames but omitted the newer table cells. The assertion now reads both and
still requires the final evidence marker. A conference browser check found consent
clearing after asynchronous file loading; it now clears as soon as selection begins.
These were repaired and the affected checks passed.

## Local Candidates And Reopening The Preview

- Public/workshop candidates: `.review-cache/demo-implementation-2026-09-26/static-v3/`.
- Conference frontend: `.review-cache/demo-implementation-2026-09-26/conference-v2/`.
- Research frontend: `.review-cache/demo-implementation-2026-09-26/research-final/`.
- Empty-media conference container context: `.review-cache/demo-implementation-2026-09-26/container-context-v3/`.
- Installation-tested archive details: `.review-cache/demo-implementation-2026-09-26/package-final.json`.
- Final handover archive details, if regenerated after documentation updates:
  `.review-cache/demo-implementation-2026-09-26/package-handover.json`.

These are local, unapproved candidates. The static site and software ZIP contain
existing curated examples whose final redistribution review remains open. Do not
publish these folders wholesale. The container staging context uses an empty
example manifest for setup and does not contain those media.

The local public preview is `http://127.0.0.1:8772/dist-showcase/`. If its server has
stopped, run the following **from the project root**, then open that address:

```bash
.review-cache/native-install/bin/python -m http.server 8772 --bind 127.0.0.1 --directory .review-cache/demo-implementation-2026-09-26/static-v3
```

This serves only the static review candidate on this Mac. The analysis backend is
not needed. A published GitHub Pages site will be independent of the laptop.

The final handover archive differs from the installation-tested archive only in
updated documentation, test-record CSV and the packaging script’s document
allowlist. Runtime application/frontend code and dependency locks are compared
against the installed archive before handover.

## Remaining Human And Hosted Checks

1. **27 September recording:** confirm one or two examples for public video use;
   rehearse the actual microphone/capture setup and time the
   [252-word script](BMJ_VIDEO_SCRIPT_2026-09-27.md) to at most 2:30. No new provider
   run is assumed: agree exact originals/accounts/run allowance for any fresh call.
2. **29 October sessions:** Mac/projector/cable rehearsal; check browser version,
   projection text size, timed repeat/reset and saved fallback. The researcher is
   invited to both Innovation café and the 70-minute Problem Clinic.
3. Physical iPad/Safari, Android/Chrome, Windows installation and actual
   PowerPoint/Keynote are not certified by viewport emulation or LibreOffice.
4. Decide whether the live conference backend stays local or moves to Render.
   Hosted execution needs the real Linux container test, resource/cost choices,
   presenter credentials and agreed inference scope. The public site needs none
   of that backend processing.
5. Complete exact example/source/credit/reuse records, software/podcast metadata
   and final public candidate review. The [offline worksheet](EXAMPLES_OFFLINE_HANDOVER_2026-09-26.md)
   gives the first five-file batch: OpenAI image, Google image, source-documented
   photograph, short PDF and short PPTX. These decisions did not block engineering.

The BMJ abstract is due **23 October**; its draft and event plan are in
[BMJ_RECORDING_AND_SESSION_PLAN_2026-09-26.md](BMJ_RECORDING_AND_SESSION_PLAN_2026-09-26.md).
No new media upload, paid provider run, remote Git push, deployment, public
visibility change or Zenodo publication was performed during this implementation.
