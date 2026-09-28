# PDF preparation change: pdf-input-2026-09-26.1

The researcher confirmed MIT as the agreed project code licence on 26 September
2026. The candidate replaces PyMuPDF with pypdf 6.19.0 (BSD-3-Clause) for selectable
text and raster figures, and pypdfium2 5.13.0 (Apache-2.0/BSD-3-Clause wrapper,
PDFium BSD and bundled third-party notices) for page rendering. The project MIT
notice is unchanged. Installed wheel notices must be retained with binary copies.

This is a separately recorded input-preparation change. Provider prompts,
aggregation, thresholds, provenance trust policy and saved reports are unchanged.
Original bytes still reach whole-file credential checks unchanged. Raster filters,
110 dpi page rendering, JPEG quality 85, cap sampling and stable figure labels
remain. Shared PDF objects are deduplicated across pages. Inline images can now
be extracted; image ordering and text layout can differ between parsers. Rendered
pixels are not promised byte-identical. New PDF reports include the preparation
revision in their notes. Historical demo reports retain their original inputs. The live method version is
`pdf-preparation-2026-09-26.1`, incorporating the unchanged verdict-consistency
rules. The existing deep-pass version guard rejects earlier-method reports,
preventing a new parser from silently adding frames to an old-method assessment.

A process-wide mutex protects PDFium, whose native API is not thread-safe.
Native documents/pages/bitmaps are closed before releasing the mutex. Failed text,
figure or page extraction is recorded separately; password-protected documents
requiring a password return no frames. No new provider calls were used to test
this change.

Validation: old/new comparison of 36 mode/cap/input cases (generated vector and
raster fixtures, approved NotebookLM PDF, invalid bytes) matched frame counts and
labels. Dedicated tests cover full/capped/deep labels, object deduplication,
filters, original preservation, selectable text, encrypted/invalid inputs and
concurrent requests. PDF report text, pagination, glyph bounds and embedded image
checks use the new permissive libraries. See release/PAGES_ACCEPTANCE_2026-09-26.md
for final suite and installation outcomes; those are recorded after execution.

Primary documentation: https://pypdf.readthedocs.io/en/stable/user/extract-images.html
and https://pypdfium2.readthedocs.io/en/stable/python_api.html .
