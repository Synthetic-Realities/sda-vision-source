# Conference Live Profile: Preparation And Rehearsal

The conference profile is a presenter-operated live app. The public demo continues
to open saved results. Both use a listed example set; the research app remains a
separate profile with local file selection.

Confirmed delivery: this Mac with a projector for BMJ's 29 October Problem Clinic,
repeated groups of up to ten across 70 minutes. Recording is due 27 September and
the abstract 23 October. See the [recording/session plan](BMJ_RECORDING_AND_SESSION_PLAN_2026-09-26.md).

## Local upload-enabled presenter app

Current installed-build verification: [28 September local presenter check](Local_Presenter_Check_2026-09-28.md), including the local About page, guide 1.4 and uploaded slide previews.

For local file uploads, open the Research app at http://127.0.0.1:8100/ while its backend is running. Its current installed frontend shares the website branding and interaction improvements. Choose a file and use the existing consent controls for live analysis. The named Conference profile below uses a reviewed example list. See [local profile details](Partners_And_Local_Demo_2026-09-27.md).

## Prepare Locally

1. Complete the [example handover](EXAMPLES_OFFLINE_HANDOVER_2026-09-26.md).
2. Copy `config/conference-examples.template.json` to a local review manifest.
   For each selected original, add an object containing `filename` (basename in
   `examples/`) and `sha256` (the actual lowercase SHA-256). Only these files are
   exposed by the conference API. Empty lists support setup checks without media.
3. Build a separate frontend using `scripts/build_conference.py --output` and a
   new path beneath `.review-cache/`. Keep the research/frozen builds intact.
4. Run the backend with `SDA_PROFILE=conference`, `SDA_FRONTEND_DIR` set to that
   frontend, `SDA_CONFERENCE_MANIFEST` pointing to the reviewed manifest and a
   `SDA_CONFERENCE_PASSWORD` of at least 20 characters. Use the username
   `presenter`. Set the password privately in the local process or Render settings;
   it is not frontend configuration. Use loopback for a local rehearsal and HTTPS
   for the hosted service.
5. Begin with `SDA_CONFERENCE_MAX_RUNS=0` and all three model providers disabled.
   Check profile labels, authentication, examples and prepared fallback before
   enabling the specifically agreed provider accounts and run allowance.

The existing `.env` takes precedence over non-empty process values for most
settings. Use an isolated reviewed extraction without the researcher's `.env` for
conference setup, and enable test inference after the input, accounts and run
allowance have been reviewed. The frontend must be built with `VITE_CONFERENCE=1` and
`VITE_SHOWCASE=0`; a frontend/backend mismatch blocks the workflow.

## Boundaries And Storage

- The presenter signs in before accessing the frontend, examples or API. The
  unauthenticated health endpoint reveals only readiness/profile status.
- Analysis accepts a listed example identifier, mode and explicit processing
  consent. The server reads and hashes the original. Arbitrary files, remote
  URLs, filesystem paths, captions and workshop responses are not analysis inputs.
- The general upload, corpus-file, deep-pass, annotation, optional audio/vendor
  sends and pasted-note scoring routes are unavailable in this profile. These
  remain separate full research-app workflows.
- One analysis runs at a time. A configurable attempt allowance is **per server
  process** and resets on restart; it is not a persistent monetary budget. Run
  exactly one worker and one instance. Failed/time-limited attempts count.
- The total request timeout defaults to 180 seconds. A provider may already have
  received a request before a timeout; a timeout does not reverse a charge.
  Native conversion cannot be forcibly cancelled: after a timeout the run slot
  stays occupied until that conversion exits, and subsequent provider stages are
  skipped. Use the saved fallback while cleanup completes.
- Research-run saving is off in this profile even if the research `.env` enabled
  it. Reports remain in browser memory until downloaded/reset; processing uses
  memory and native-library temporary files. Host access logs, provider retention,
  original files and downloaded reports have their separate lifetimes.
- Conference report/graph exports use the authenticated backend; public saved
  demo session exports are generated in the browser. State this distinction when
  describing storage or network behaviour.

## Render Candidate

`scripts/prepare_conference.py --manifest <reviewed-manifest> --output <new-folder>`
stages an explicit container context. It copies application/frontend source,
locked dependencies and only the manifest-listed media. It does not copy `.env`,
research runs, the corpus, caches or Git history, and performs no remote action.
The staged manifest records every file's hash.

The accompanying Blueprint proposes one Docker web service with a health check,
manual deploys, no previews, no persistent disk, a generated presenter password,
disabled model providers and a zero initial run allowance. The proposed Starter
plan and Frankfurt region are review choices, not provisioned resources or a
statement of institutional approval. Add approved API credentials only as runtime
secrets; no key belongs in a build argument, frontend bundle or repository.

Docker supplies ffmpeg and LibreOffice for the media workflows. The image recipe
uses Python 3.12 and Node 22 Debian images and the locked application dependencies.
Record the resolved base-image digests after the first successful Linux build;
minor-version tags can change. A successful macOS build does not verify this Linux
container. Actual container build, memory limits, region, provider settings and
hosted acceptance must be checked before the conference service is enabled.

The Blueprint passes Render's current official JSON schema. Hash-checked CPython
3.12 Linux x86_64 wheels are available for every locked Python dependency. Docker
is unavailable on this Mac, so neither check establishes container execution.

The Render connection is verified for **Synthetic Realities**. The management
plugin's create-service route does not currently support Docker creation; use the
reviewed Blueprint/Dashboard route when the concrete deployment is authorised.
[Render Docker](https://render.com/docs/docker),
[Blueprint reference](https://render.com/docs/blueprint-spec).

## Rehearsal And Saved Fallback

- Use the same approved originals in the live rehearsal and saved fallback.
- Set `VITE_CONFERENCE_FALLBACK` at build time only to a tested saved-demo URL.
  Otherwise keep a clearly named saved-demo browser tab open alongside Conference.
- For a local fallback, serve the accepted static folder on loopback in advance.
  Exercise it with the analysis backend stopped and external networking disabled.
  Loading assets earlier is not a substitute for this offline check.
- Rehearse one item, a small batch, provider failure, total timeout and the saved
  fallback. Keep original model/date labels visible and introduce fallback findings as
a previously recorded analysis.
- Test the actual laptop/projector, physical iPad/Safari, Android/Chrome and
  PowerPoint/Keynote available for the event. Automated desktop/mobile viewports
  are preliminary evidence and do not replace those physical checks.

Record the event date, exact build/example hashes, accounts/settings, tester,
device/browser versions, elapsed times and remaining issues in the release test
record. Fresh provider calls require the agreed input/account/spending scope.
