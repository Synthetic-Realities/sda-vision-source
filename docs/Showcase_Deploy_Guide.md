# Static Showcase: Current Build and Release Guide

The staged builder prepares separate public and workshop candidates from approved originals and cached reports.

## What can be hosted

The researcher has confirmed the GitHub Pages release as a fixed-example interactive
demo with **no new visitor uploads**, within the stated DPIA and Ethics scope.
GitHub Pages can serve this static showcase and project resources. Heavy analysis,
report generation and graph preparation happen before publication, initially in
the local preparation environment. The showcase uses cached reports and approved
example downloads, without provider keys or new inference. Browser graph interaction
and workshop summary generation remain interactive and need device testing.

GitHub Pages serves this recorded demo directly as a static website.
The full FastAPI application remains the separate local research tool. Optional
remote preparation would need its own exact-file/account/cost review before use.

The researcher has explicitly selected saved results for the public website and
requested a **separate live Conference demo** for the Innovation cafe. A conference
backend can run on the laptop or on Render; it is not part of the static Pages
bundle. The [release plan](../release/INSTALLATION_AND_RELEASE_PLAN_2026-09-26.md)
records the proposed conference profile and rehearsal requirements.

## Current Controls And Acceptance

The local layout switch now says **Layout: Research controls / Compact**. It
changes presentation controls, while persistent labels identify Research,
Conference live analysis or the Public saved-results demo. The public and
conference profiles only accept their listed examples; Research retains its
local file workflow and separate storage settings.

The public Developer view supports bundled-example batches: up to ten queued
and five selected per operation. Session JSON/Markdown/CSV/PDF/PPTX downloads are
created in the browser. The full cached graph is labelled with its actual scope.

SynthID Detector and the OpenAI image checker appear together with visible paste-results boxes. Pasted replies are separate browser-session notes. The former Gemini chat shortcut is removed from the recorded demo. Saved findings retain their recorded values, and note scoring stays disabled in this profile. View switches preserve them;
new input/reset/reload requires downloading anything wanted first. Original
recorded-report downloads are separate from these new session exports. Public
and workshop variants retain their intended manual external-link differences.
The [participant instructions](Participant_External_Checks.md) and [facilitator guide](Facilitator_Guide.md) describe the current paste-only demo workflow.

Automated checks passed across the three views at a project subpath: 36 static
GETs, no API/provider/upload requests, unchanged cached report JSON and tested
session exports. See the full [acceptance record](DEMO_ACCEPTANCE_2026-09-26.md)
for exact evidence and remaining physical-device, example-rights and live checks.
Cached findings retain their original model/date context.

## Prepare a separate local candidate

Run from the app root with existing development dependencies. These commands preserve the current cache and frozen demo outputs, use only recorded analyses, and create separate local folders:

```bash
python3 - <<'PYBUNDLE'
from pathlib import Path
import shutil
bundle = Path('.review-cache/approved-showcase-bundle')
(bundle / 'originals').mkdir(parents=True, exist_ok=False)
for source in Path('examples').iterdir():
    target = bundle / source.name if source.suffix == '.md' or source.name == 'manifest.json' else bundle / 'originals' / source.name
    shutil.copy2(source, target)
PYBUNDLE
.venv/bin/python scripts/build_showcase.py both --source showcase-cache --example-bundle .review-cache/approved-showcase-bundle --workshop-starter illustration-1.png --output-root .review-cache/pages-workshop-review
```

Use a fresh review path for each candidate. The scripts preserve existing outputs by default; inspect an existing folder before deliberately choosing to replace it.

The builder copies the explicit approved bundle. Its opening illustration must match the displayed artwork and saved report by SHA-256. The illustration has a separate manifest entry and report; the menu and set graph contain the other ten examples. Curated status is a selection rule, not rights clearance. Review each original, thumbnail, cached note, report and download before publication. Cache refresh through new paid analyses is a separate authorised action; no new bake is required merely to rebuild static UI.

The resulting public and workshop folders are separate static outputs. The source-release ZIP is a different artefact and excludes the cache; it cannot supply these recorded demo data on its own.

## Required static checks

- Open the candidate under a project subpath resembling `/<repository>/`.
- Follow Notice → Discuss → Check → Open recorded findings → Reflect on the opening illustration in Community Workshop, then open the facilitator PDF, then test the ten menu examples and Developer batches.
- Exercise Developer batches using only bundled examples and saved results;
  verify combined/per-item downloads and the displayed graph's actual scope.
- Verify original downloads, report/graph files, media previews, fonts and workshop PDF/PPTX/CSV summaries.
- Test new Second Opinion notes separately from stored example notes: both source
  labels, attestation, full text in offered session exports, unchanged combined
  score and original cached report, view switches and reset/reload behaviour.
- Confirm failed/unchecked historical states and model/date labels remain accurate.
- Check session response inclusion, End session and confirmed New session behaviour.
- Inspect all external links. `VITE_HIDE_SECOND_OPINION=1` removes the second-opinion panel; separate Google image-search links can remain. Describe the actual variant.
- Confirm all files and relative asset URLs load without a live backend or provider request.
- Repeat the workflow with the local analysis backend stopped. Check saved-result
  labels and dates; opening a report must not claim a new provider analysis or
  local research-report storage.
- Verify all presentation modes offer only curated examples: no file picker/drop
  workflow, arbitrary-media import or live analysis request. Capture browser
  network evidence that in-demo actions do not transmit files or workshop responses
  to an analysis backend/provider. Check external user-operated links separately.
- Test the agreed tablet, browser and conference presentation software.

Current static-build acceptance is recorded in [release readiness](../release/READINESS_2026-09-26.md). A successful Vite build alone does not establish these behaviours.

## Publishing after review

Use a separately approved academic repository/organisation. Deploy only the reviewed static folder through a Pages publishing branch or a scoped Pages Actions workflow. Keep the publication contents limited to the reviewed static folder, with development files and private repair history retained separately.

GitHub Pages supports static HTML/CSS/JavaScript and is available for public repositories on GitHub Free and free organisations. Its host access logs and any external vendor pages remain separate processing flows; avoid claiming that a static site processes no personal data. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

The intended public page can combine a project introduction, recorded interactive demo, local-install instructions, citations and reviewed conference resources. Publish the software release and its Zenodo deposit through the [final release checklist](../release/RELEASE_CHECKLIST.md).
