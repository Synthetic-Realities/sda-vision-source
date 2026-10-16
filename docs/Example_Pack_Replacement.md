# Replacing The Example Pack

The Research app reads files directly from `examples/`. The Conference profile
exposes only its reviewed manifest-listed originals; the public static showcase
uses its separately built example set. Keep new originals in the private review
folder first. Do not overwrite old media or reuse old reports for new files.

**26 September naming decision:** use neutral participant filenames and a private
source key. This supersedes the earlier provider-prefixed naming suggestion.
See the [offline handover](EXAMPLES_OFFLINE_HANDOVER_2026-09-26.md).

## Where To Put Things

| Purpose | Location relative to the app folder | Action |
|---|---|---|
| Incoming originals and private source key | `.review-cache/example-review-2026-09-26/` | Preserve source-labelled originals here while the researcher completes the handover |
| App/presentation copies | Explicit review bundle, then the clean candidate's `examples/` | Prepare byte-identical copies under neutral IDs; keep the original-name mapping private |
| Source/licence credits | `examples/CREDITS.md` | Add a row for every new original |
| Structured evidence inventory | `release/ASSET_REGISTER.csv` | Record generation, hash, transformations and checking evidence |
| New showcase selection | `scripts/bake_showcase.py --example-bundle` | Supply a neutral-name/hash manifest; the legacy `CURATED` list and reports remain historical |
| Source archive media selection | `scripts/package_candidate.py --example-bundle` | Include only the explicit bundle; the default source candidate contains no example media |
| Existing cached analyses | `frontend/showcase-data/` | Historical: do not rename reports to match new media |
| Existing frozen showcases | `frontend/dist-showcase/`, `frontend/dist-showcase-workshop/` | Leave unchanged until their replacements pass review |

Neutral participant-name examples (numbers do not designate a provider):

```text
Example-001.png
Example-002.jpg
Example-003.pdf
Example-004.pptx
Example-005.m4a
```

Record the actual creation date/product/model in the private source key. Preserve
downloaded original bytes and keep source images used inside each PDF/PPTX
separately. Compare hashes of the original and neutrally named copy. Opening and
re-exporting media can alter its credentials; filename changes alone do not alter
the file contents. Do not add provider labels to the image pixels for naming.

Use neutral names for mixed-source documents too, with a private page/slide/source
inventory. OA, NLM and similar abbreviations can disclose the source. Image/frame
prompts currently include filenames, so use the neutral filename at the time of a
new analysis. Do not rename a historical report to imply its model lacked an
earlier clue. No provider prompt or analysis method has been changed by this
documentation update.

Check for clues in the media itself and its visible/spoken credits. Keep the
original credentials and metadata intact; any separately prepared teaching
derivative needs its own transformation record. Neutral names support an initial
source-uninformed discussion but do not make downloadable static assets secret
or enforce a controlled blind study. Plan the source reveal after initial
responses and retain required attribution.

## Small Replacement Sessions

1. Generate and download two originals, one from each intended generator.
2. Record the exact generator/product, date, prompt reference and hash. Keep any
   sensitive prompt or account details in your approved private record, not here.
3. Run the relevant vendor verification on each original in a fresh check. Save
   its full dated response. Record C2PA and watermark results separately.
4. Prepare neutral copies with matching hashes in a separate review bundle. Source
   packaging places only those copies in the candidate's `examples/`. Update the
   Conference manifest when applicable. New files do not
   automatically enter the frozen showcase or public archive.
5. Create PDF/PPTX derivatives, record the source-image hashes and slide/page map,
   then test the extracted/rendered frames separately. Do not assume a container
   or rendered slide retains the source image's watermark or credentials.
6. After the new pack passes, move superseded originals to a private folder under
   `.review-cache/legacy-examples/` if you want to hide them from the live picker.
   Keep originals needed by the current regression fixtures until those fixtures
   are deliberately updated. No old files have been moved by this change.
7. Request a staged showcase rebuild. Fresh media needs fresh inference with
   explicit spending approval; export-only refresh is not a new analysis.

## Explicit bundle format

The five-example review set prepared on 26 September uses `manifest.json`,
`README.md`, `CREDITS.md` and an `originals/` directory. The manifest contains only
`schema_version: 1` and an `examples` list of `filename` / `sha256` pairs. Private
source mappings and unrelated files are rejected. Names use `Example-NNN` with
unique IDs and an image, PDF or PPTX extension; this first bundle does not admit
audio or video. Expanding its format/media scope requires a separate review.

Supply the same `--example-bundle` to the bake, static build and source packaging
commands. Cached records must match the neutral filename and both the manifest
and report input hashes. An export-only refresh does not repair a missing report
or replace an old report's filename. New inference still requires explicit
provider-send/spending permission and `--allow-provider-calls`.

The source candidate flattens only the five originals into `examples/` for the
research application. To reuse its selection as a build bundle, first stage the
listed originals beneath an `originals/` directory with the three public text
files. Do not copy the whole development examples folder.

## Watermark Evidence

Your 24 September screenshot test is recorded as a researcher observation:
Gemini reported SynthID and identified the screenshot. Preserve the original,
screenshot, their hashes, capture method, exact reply, date and Gemini interface.
It is evidence for that pair, not a general screenshot-survival rate.

OpenAI's current provenance documentation explicitly lists C2PA and SynthID for
supported OpenAI media, while warning that older generation models or files made
before signal availability may not be detected. Do not infer an exact historical
cutoff or a watermark's presence from a filename or generation date alone.
Older known-generated files remain useful *legacy/unsupported-signal controls*.
[OpenAI content provenance](https://developers.openai.com/api/docs/guides/content-provenance)
(reviewed 24 September 2026).

The linked OpenAI verification service is distinct from the app's OpenAI vision
opinion. The newly documented provenance API is not integrated here; introducing
it would require a separate processing review, including its lack of Zero Data
Retention eligibility. Google external verification also remains researcher-operated.

Sources: [Google SynthID](https://deepmind.google/models/synthid/),
[OpenAI content provenance](https://developers.openai.com/api/docs/guides/content-provenance).
