# Reflect: reviewing the recorded findings

UI revision: `reflect-review-2026-09-29.1` · 29 September 2026.

Reflect starts with **Revisit the recorded findings** collapsed. Opening it shows
the recorded findings and the complete Evidence box together, including source
notes, original-file downloads and the available Second Opinion controls.
Returning to Reflect closes this review again. Check shows the same findings and
evidence directly, and notes remain available when moving between the two steps.

The reflection questions, **Download session notes** and **New session** remain
visible outside the review. The separate report downloads and relationship graph
keep their existing controls.

This behaviour applies to the public demo, local research and conference views,
the workshop build and the installation source. Scientific rules, saved findings
and original media retain their existing versions and contents.

## Verification

- TypeScript and all five frontend builds passed.
- 60 browser scenarios passed: five builds, widths of 390 and 1440 pixels, and six
  selections covering images, PDF, podcast, slides and video.
- Checks covered the initially closed review, keyboard reopening, visible session
  actions, preserved source and Second Opinion notes, and repeat Check/Reflect navigation.
- Image-only Google Lens availability and original downloads remained covered.
- Provider requests were mocked; no new external analysis or media upload occurred.
- Desktop and phone-width screenshots were inspected. Physical phone and television
  checks have not been repeated for this display revision.

The published Zenodo 0.1.0 deposit remains the frozen release. Software 0.1.1 includes this revision; see the [release record](../release/RELEASE_0.1.1.md).
