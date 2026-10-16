# Initial Pages preview: acceptance record

Candidate revision: `pages-preview-2026-09-26.1`. The repository remains private
until the researcher selects the public-source publishing arrangement. The Pages
workflow is manually dispatched and deploys only the inspected `site/` directory.
The intended destination is `https://Synthetic-Realities.github.io/sda-vision/`.
No GitHub release, tag or Zenodo software deposit is created by this checkpoint.

## Confirmed decisions

- Synthetic-Realities owns the repository; IntoTheDigital is its academic owner
  account and Git authentication identity. Commit attribution is Synthetic
  Realities — Dr Sam Martin, smartin@mmu.ac.uk.
- MIT is the agreed project code licence, explicitly confirmed by the researcher
  on 26 September. The existing copyright and MIT text are unchanged.
- Public website: prepared examples and saved findings, no visitor uploads or
  new provider calls. All eleven originals and saved report surfaces match the
  preceding tested checkpoint byte-for-byte. Rights and source credits are in
  `examples/CREDITS.md`; restricted videos and private source keys are excluded.
- Education benefits are optional and the application is deferred.

## Changes made for this candidate

- Replace the PyMuPDF dependency with pinned pypdf/PDFium packages; retain exact
  wheel hashes and installed licences. This input-preparation change is separately
  recorded in `docs/PDF_Dependency_Change_2026-09-26.md`.
- New live method version: `pdf-preparation-2026-09-26.1`. The existing deep-pass
  guard rejects older-method reports. Saved demo results retain their preceding
  method and original provider replies; no inference was rerun.
- Add a licensed Noto Sans Math fallback to support the podcast's ≤ symbol in
  session PDF/PPTX exports. No report text is rewritten. If neither font covers
  the complete text, the existing explicit CSV fallback remains.
- Add exact frontend dependency/font/Adobe sample notices, linked credits and
  an About page explaining scope, hosting and the remaining rehearsal checks.
- Validate the CFF citation; omit historical draft version/date and invented DOI.
  Funding remains in the README/About page and citation comments.
- Add a manually dispatched Pages workflow using pinned official action commits.

## Checks completed locally

- Fresh native Apple Silicon Python 3.12 environment: hash-locked installation
  succeeded; `pip check` passed; PyMuPDF/fitz absent.
- **312 Python tests passed**, with external sockets blocked and local Unix
  sockets allowed for the test runner. Two upstream deprecation warnings remain.
- PDF comparison across 36 input/mode/cap cases matched former frame labels and
  counts. New tests cover invalid/encrypted PDFs, figures, caps, deep labels,
  original bytes and concurrent rendering. Rendered pixels may differ.
- Fresh `npm ci`: zero reported advisories. TypeScript, research and public
  showcase builds passed. Citation validated against CFF 1.2.0.
- Pure exporter checks generated a 15-page podcast session PDF and 34-slide PPTX;
  both retain ≤1800s. CSV generation, original-record preservation and unsupported
  glyph rejection passed.
- Browser review at `/sda-vision/`: Developer, Community and trainer views use
  bundled selection. Podcast saved results/audio controls, separate pasted notes,
  and the About/credit links appeared correctly. The repaired PDF action showed
  no app error. The in-app browser's download event did not yield a saved file;
  browser-save completion is therefore not claimed by this check.
- All 11 original hashes match the manifest. Existing recorded reports, exports,
  graph data and thumbnails are unchanged. Site and source scans found no known
  credential patterns, personal project paths or previous commercial-account
  references; archive entries were included in the site scan.

The unchanged recorded files also retain the preceding checkpoint's 55 matched
original/report downloads and desktop/mobile, batch, session and export checks.
Those are earlier evidence, not a claim that every browser check was repeated.

## Remaining checks

- Researcher selects publishing the full source repository publicly alongside
  Pages; then verify the actual HTTPS deployment and its commit.
- Physical iPad/Safari, Android/Chrome, projector and native PowerPoint/Keynote
  rehearsal; verify file saving in the browsers used by participants.
- Presenter live-provider/latency/cost rehearsal, separate from this static site.
- Agree final software version/tag and complete Zenodo software metadata/archive.
  Podcast deposit and conference packs remain separate outputs.

Private local evidence is retained in the project's review cache; it is excluded
from the public source and website. The source candidate manifest records exact
file checksums. Public launch status must be verified remotely, not inferred from
this document or from a successful local build.
