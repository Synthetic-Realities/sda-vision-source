# Private GitHub testing checkpoint — 26 September 2026

Academic home: [Synthetic-Realities/sda-vision](https://github.com/Synthetic-Realities/sda-vision).
The researcher authorised this private testing checkpoint. Public launch follows
acceptance testing; Pages and Zenodo publication remain separate steps.

## Eleven examples with descriptive names

The selection contains eight images, a PDF, a presentation and a podcast.
Names describe material types without adding a creator, provider or origin label.
Original bytes, embedded credentials, metadata, visible credits and signatures
remain intact. Required attribution is in `examples/CREDITS.md`; the facilitator
source key is kept separately outside the repository.

| Example | Available checks |
| --- | --- |
| animal-portrait.jpg | Saved three-model replies; local credentials checked |
| earth-image.jpg | Saved three-model replies |
| illustration-1.png | Saved three-model replies |
| illustration-2.png | Saved three-model replies |
| illustration-3.webp | Saved three-model replies; local checks repeated |
| infographic.pdf | Saved three-model replies; combined result Inconclusive |
| journal-diagram.png | Local checks only; LLM visual checks not run |
| journal-image.png | Local checks only; LLM visual checks not run |
| podcast.m4a | Saved three-model transcript replies; local audio and original-file credential checks |
| presentation.pptx | Saved three-model replies; combined result Inconclusive |
| social-media-image.png | Local checks only; LLM visual checks not run |

The ten earlier records are presentation copies with new descriptive filenames
and report IDs. Provider replies, scores, original analysis dates and acquisition
context are retained. The original records remain preserved. Renaming cannot
remove clues that a model previously saw. Three local-only examples have disabled
LLM rows and no model rating; their Inconclusive status reflects unavailable
visual assessments, rather than three Inconclusive model replies.

The podcast file is matched by SHA-256 to its saved 24 September report. Its
three unchanged model replies assess the transcript. The retained transcript
excerpt is 4,000 characters; the full original transcript is not retained in that
report. Local audio-track and original-file credential checks were repeated,
and the saved replies were combined under `verdict-consistency-2026-09-26.1`.
AI-origin detection from sound itself is outside this workflow. Reassembly and
original acquisition dates are distinguished in the report notes.

No new provider requests, paid inference or audio uploads were used for this
checkpoint. Display revision `descriptive-examples-audio-2026-09-26.1` enables
playback of the selected bundled podcast. The eleven-item catalogue is separate
from the existing ten-item queue and five-item batch limits.

Public media reuse terms remain a release-review item. Restricted videos are
excluded. The software licence does not automatically license example media.

## Academic Git attribution

The researcher confirmed **Synthetic Realities — Dr Sam Martin** and
**smartin@mmu.ac.uk** as the author and committer identity for this repository.
Synthetic-Realities remains its organisation owner. The two earlier commits are
reconstructed with this identity, followed by this example update; a verified
local Git bundle preserves the preceding private checkpoint. This changes commit
hashes, so any earlier clone must be reconciled before further pushing.

GitHub associates a commit with a personal profile through its email address.
An organisation is the repository owner, not a login or personal contributor
profile. Authentication and private audit activity remain separate from commit
attribution. Contributor statistics may take up to about 24 hours to refresh
after a history correction. Previously viewed commit URLs may remain cached;
this correction does not claim to erase GitHub's retained records.
See [GitHub account types](https://docs.github.com/en/get-started/learning-about-github/types-of-github-accounts)
and [contributor statistics](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors).

## Run the saved demo

From the root of the downloaded or cloned checkpoint:

```bash
python3 -m http.server 8776 --bind 127.0.0.1 --directory site
```

Open `http://127.0.0.1:8776/`. No backend, API keys or dependency installation
are needed for this saved demo. Choose an example, open its recorded findings,
play the podcast, run a saved batch, add browser-only Second Opinion notes or
download reports and originals. It has no visitor file-upload or fresh analysis
route. Save session exports before closing the page to retain your notes.

The research application in `frontend/dist/` has a different processing workflow;
follow the root installation instructions for live analyses with your own keys.
No keys are supplied with this checkpoint.

## Rebuild from the included saved results

After installing dependencies, use a temporary preparation bundle:

```bash
mkdir -p .review-cache/demo-bundle/originals
cp examples/manifest.json examples/README.md examples/CREDITS.md .review-cache/demo-bundle/
python3 - <<'PY'
import json, shutil
from pathlib import Path
for item in json.loads(Path('examples/manifest.json').read_text())['examples']:
    shutil.copy2(Path('examples') / item['filename'], Path('.review-cache/demo-bundle/originals') / item['filename'])
PY
.venv/bin/python scripts/build_showcase.py both --source showcase-cache --example-bundle .review-cache/demo-bundle --output-root .review-cache/rebuilt-demo
```

Hashes and saved records are validated before building. Existing outputs are
preserved by default. The workshop variant hides Second Opinion editing controls.
The prepared `site/` uses the public layout for private acceptance testing; the
Pages workflow template remains inactive.

## Tomorrow's physical acceptance checks

1. Check all eleven choices and readable text on the actual Mac/projector in
   Developer, Community Workshop and Train the trainer / Researcher views.
2. Play and seek within the podcast; distinguish transcript assessment from local
   audio measurements. Check the two Inconclusive documents and three local-only images.
3. Try a five-item batch, paste a Second Opinion note and save session exports.
4. Open downloaded PDFs and PPTX files in the applications used at the conference.
5. Complete the licence/contact/version and media reuse review before public launch.

Automated checks cover behaviour of this checkpoint. Physical-device rehearsal,
researcher review and native presentation-app checks remain outstanding.

## Automated verification

- 302 Python tests passed with network connections blocked; seven dependency
  deprecation warnings remain.
- TypeScript and the research, public-layout and workshop builds passed.
- All eleven examples and 55 original/report downloads matched their prepared
  bytes. Podcast playback and seeking passed in the automated Chromium check.
- Saved batches, browser-only Second Opinion notes, session exports, three views
  and mobile layout passed. The saved-demo run made 37 static GET requests and
  zero provider/API/upload requests.
- All eleven Markdown, CSV, PDF and PPTX reports were checked for method and
  coverage text; PDF text and slide-shape bounds passed.
- The ten earlier records retain their model replies and scores. All 482 files
  in the protected source, saved-run and earlier-cache inventory are unchanged.

These checks do not replace the Mac/projector and native presentation-app
rehearsal described above.
