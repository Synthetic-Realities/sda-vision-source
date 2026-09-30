# Community header on narrow screens

Display revision: `community-header-2026-09-30.1`.

The Community Workshop logo and introduction share a wrapping row. The logo's
container reserves the artwork's width and the image stays within that container.
Where the row cannot comfortably fit both items, the introduction moves beneath
the logo. The header uses the full available width when its desktop session label
is hidden. Partner logos and the centred tab navigation retain their layout.

## Verification

- Reproduced the reported overlap in the live website at 440 CSS pixels: the
  160-pixel logo extended beyond its 133-pixel flex item into the introduction.
- Checked the corrected preview at 320, 375, 390, 414, 440, 650, 768, 1024, 1280
  and 1920 CSS pixels: no logo/text overlap or horizontal page overflow.
- Standard, large and workshop text settings passed at 320 and 440 CSS pixels.
- Confirmed the Journal image selection and navigation between Community
  Workshop, Facilitator guide and Developer. The logo and selected media render.
- TypeScript checks passed in the maintained private and public source checkouts.
  Public demo, Research, Conference and installation builds passed and share the
  same corrected stylesheet.
- No app errors were reported by the inspected browser log; an unrelated browser
  extension reported its own search-engine error.

Browser checks use desktop Chrome at phone, tablet and desktop widths. LinkedIn's
embedded iPhone browser requires a physical-device check by the researcher.

This CSS revision is included in the live demo, current GitHub source and local
builds. The published software 0.1.1 archive and facilitator guide 1.4 remain
frozen; a future versioned software archive can include this correction. Provider
prompts, consent controls, scoring, original media and recorded findings retain
their existing behaviour and contents. No new provider calls were made.
