# Developer results and workshop preview

Display revision: `responsive-results-2026-09-27.1`.

Developer provider findings use labelled, stacked rows on narrow screens and
touch-oriented displays. Wide screens retain the comparison table. Each provider's
status, verdict, rating, confidence and evidence remain available; expandable
evidence supports keyboard navigation. Audio findings use the same responsive
layout and retain their scope and separate scoring status.

The README preview shows the complete Community Workshop Notice page, including
the illustration, response controls and footer. The same capture accompanies the
current release-pack previews and social preview.

## Verification

- Browser layout checks at 320, 390, 768, 1280 and 1920 CSS pixels: all five provider
  rows present, with no horizontally overflowing result cells or page overflow.
- Enlarged-text checks at 390 pixels; all four audio rows readable at that width.
- Keyboard focus reaches expandable evidence.
- Responsive component regression checks, existing workshop checks, TypeScript,
  and Public, Research and Conference builds pass.
- New screenshot inspected at full size: the complete illustration and controls
  are present, without the previous clipped area and blank tail.

These are browser viewport and keyboard checks. A final check on a physical phone
and the Amazon Silk TV browser remains useful. Provider replies, saved research
reports, scoring rules, consent controls and scientific method versions are
unchanged. This revision uses saved results and makes no new provider calls.

The software source remains private. Zenodo materials are prepared locally;
deposit publication is separate.
