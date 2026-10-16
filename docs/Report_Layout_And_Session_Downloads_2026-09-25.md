# Report Layout And Session Downloads

## Scope

Presentation changes requested during workshop testing. These do not change
provider prompts, aggregation, numeric ratings, credential trust policy or stored
research reports. Historical provider text and researcher notes remain their
original observations, not newly verified findings.

## What Changed

| Area | Current behaviour |
| --- | --- |
| Community Workshop evidence | Provider evidence opens with results. White panel, orange border, orange top accent and pale-orange heading. The repeated yellow origin/claim strip is removed; contextual scope remains in checks and standalone reports. |
| Workshop summary | Choice of genuine PDF, editable PPTX and UTF-8 CSV. The former Print/save button is removed. |
| Media preview | PDF starts with the selected image or available media thumbnail; PPTX includes a dedicated preview slide. Captions distinguish sampled video frames, document previews and audio cover artwork/waveforms. CSV remains text-only. |
| Responses | Included by default as requested; untick to exclude. Participant responses are clearly separated from research findings. |
| End session | Downloads the selected format. Leaves notes, findings and selections intact. |
| New session | Opens a save/check/confirm dialogue. Clearing requires a separate acknowledgement. Cancelling preserves the current page. |
| Full research formats | JSON, Markdown, CSV, PPTX and PDF remain available. PDF/PPTX now use structured report sections and tables. |
| Long entries | Continue onto additional pages/slides with repeated table headings. Full research exports include all supplied provider evidence and recorded visible/extracted/transcribed text, instead of the former evidence/text caps. |
| Clipboard | Gemini prompt is visibly selectable as backup. Copy runs within the click handler; the app no longer invokes the asynchronous Clipboard permission path. Browser policy remains in control. |

## Report Structure

| Section | Purpose |
| --- | --- |
| Assessment summary | Finding, recorded verdict, confidence, rating, basis, explanation and coverage |
| Provider overview | Compare provider, status, assessment and rating |
| Provider evidence | Model, status, role, summary and individually labelled evidence rows |
| Content Credentials | Provenance evidence, integrity/trust qualifications and declared scope retained separately |
| Frames / soundtrack | Relevant sampled-frame and audio records; audio scope stays separate |
| Contributions | Supporting and additional findings as recorded |
| Second opinions | Original pasted note, optional scored read and session attestation clearly labelled |
| Source checks | Suggested action, source record and recorded human check |
| File and analysis record | File, ID, date, models, method and original-file hash |

The workshop version uses plain-language headings and adds selected workshop
responses. It remains a summary, not a replacement for the structured JSON
research record. PowerPoint output is a report deck, with continuation slides
instead of shrinking long notes into tiny type.

## Processing And Dependencies

- Workshop PDF/PPTX/CSV generation runs in the browser. Workshop response text is
  not posted to the backend or an external export service. Same-origin app assets
  and a bundled font are loaded when needed.
- Full research exports retain the existing local `/api/export/*` routes.
- New pinned frontend libraries: jsPDF 4.2.1 (MIT), PptxGenJS 4.0.1 (MIT),
  Marked 18.0.14 (MIT). They are included in the frontend lockfile. Marked tokenises
  escaped app-generated text; no Markdown HTML is executed or remotely fetched.
- Noto Sans Regular is bundled under the SIL Open Font License. The licence sits
  beside the font in `frontend/src/assets/fonts/OFL-NotoSans.txt`. Source:
  https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans
- Research PDF uses the same bundled font. Source packaging includes the exact
  font and licence; no system font installation is required.
- Workshop PDF/PPTX checks font coverage and gives an actionable CSV fallback
  rather than silently omitting unsupported characters. CSV retains Unicode.
- PowerPoint uses Arial with local viewer substitution. Font/layout appearance
  should still be checked on the actual conference laptop and tablet.

## Verification And Manual Checks

Automated tests use mocked providers and synthetic report fixtures, never new
paid analyses. They cover inclusion/exclusion, report immutability, long-note
pagination, extra evidence, literal markup, formula-safe CSV, download failures,
preserving notes on End session and confirmation before New session. Generated
PDFs and PowerPoints are also rendered for visual inspection. Local QA outputs
are under `.review-cache/polished-exports-2026-09-25/` and are not release evidence
about detector performance.

Completed verification on 25 September 2026:

- TypeScript and production frontend build passed.
- 107 targeted Python tests passed (existing dependency deprecation warnings).
- Community browser suite passed at desktop, tablet and phone sizes, including
  touch emulation; nine mocked analyses, zero real provider calls.
- Workshop download suite passed for all three formats before and after analysis,
  long notes, unsupported-character fallback, preserved notes and confirmed reset.
- Publication smoke passed at desktop and phone sizes with mocked providers.
- PDF and PPTX fixture reports rendered and visually reviewed. The final long-note
  marker survived both formats. Full research evidence beyond the former five-item
  cap and long recorded text are covered by regression tests.
- The approved local restart completed on port 8100. Both live export endpoints
  returned HTTP 200 and valid PDF/PPTX files from a synthetic report fixture.

| Done | Small manual check | Expected result |
| --- | --- | --- |
| [ ] | Refresh after saving existing notes | Orange evidence panel, no repeated yellow strip |
| [ ] | Add a distinctive workshop note; download each format | PDF/PPTX/CSV contain the note in the workshop-response section |
| [ ] | Untick response inclusion and download again | Findings remain; workshop responses are absent |
| [ ] | Select End session | Download starts; note remains editable |
| [ ] | Select New session and cancel | Notes and report remain |
| [ ] | Save/check downloaded file, then confirm New session | Fresh activity with no carried-over responses |
| [ ] | Download a full research report containing second opinions | Separate labelled tables, full notes, unchanged recorded findings |
| [ ] | Open PPTX in the actual conference presentation software | Table text fits, continuation slides readable, substituted fonts acceptable |
| [ ] | Try physical iPad/Safari and Android/Chrome downloads | Browser saves each file; manual prompt copy remains available |

Browser automation cannot certify that a file was saved where the participant
wants it. Check the downloaded file before clearing a session. Choosing another
input or reloading still resets in-memory workshop notes.

## Media Preview Follow-Up

The workshop PDF/PPTX now receives the same selected-file preview used by the app.
Still images are fitted without cropping, downscaled only when larger than 1600
pixels on the longest edge. Other media use the available recorded thumbnail:
sampled video frame, document page/slide/extracted image, or audio cover art/waveform.
An example preview that predates analysis is labelled as a preview, rather than
as an analysed frame. Text-only and unavailable-preview cases are labelled explicitly.
The decorative empty-workspace illustration is never substituted for the file.

Image loading is limited to local blob URLs, raster data URLs and same-origin
assets; arbitrary external image URLs and SVG data are not fetched. Preview
conversion takes place in the browser and does not change the original file or
its credentials. No new upload or provider call is introduced. Existing full
research export image inclusion has also been regression-tested.

Verification includes real downloaded PDF/PPTX files with embedded image objects,
aspect-ratio checks, video/audio/document captions, explicit missing-preview and
text-only cases, and rendered first-page/slide inspection. Fixture outputs are in
`.review-cache/media-exports-2026-09-25/`. Physical presentation-device checks remain
on the manual checklist above.
