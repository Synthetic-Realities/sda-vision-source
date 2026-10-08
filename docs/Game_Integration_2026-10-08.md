# Hearsay Harbour in SDA Vision

Website integration revision: `game-tab-2026-10-08.1`.

The main navigation offers Community Workshop, Facilitator guide, Game and
Developer. The Community Workshop remains the default opening view.

## Demo and Dev mode

- [Game → Demo](https://sdavision.io/#game) introduces Hearsay Harbour and its
  Notice, Discuss, Check and Reflect activities. **Play here** loads the public
  game in a titled, sandboxed frame. Individual play and Workshop mode remain
  inside that frame. A new-tab link provides a full-window view for different screens.
- [Game → Dev mode](https://sdavision.io/#game-dev) provides screenshots and links
  for running the separate Dev Studio locally, preparing picture packs and
  reviewing source records. The Studio itself runs with the game’s local dev
  server. Playing and manual pack editing require no model account.
- The game’s teaching checks use prepared findings. Its progress and settings
  are saved by the game in browser storage. The frame loads only after Play here
  and is removed when leaving Demo or Game. SDA Vision’s reports, credentials
  and configured provider accounts are not passed to the frame.
- The embedded game is hosted independently and requires an internet connection,
  including from the installed and Conference builds. Its live content follows
  the game deployment. For an offline session, use the game’s own local setup.

## Sources and credits

- [Game repository](https://github.com/Synthetic-Realities/hearsay-harbour),
  inspected at `bfe0cd2d039fe09e6d7952a5911e159671a3f882`, version 1.2.0.
- [Public game](https://synthetic-realities.github.io/hearsay-harbour/).
- [Game Concept DOI](https://doi.org/10.5281/zenodo.23237554), verified as the
  parent of version record `10.5281/zenodo.23240413` (v1.2.0).
- Five original repository screenshots accompany the introduction and local
  Studio guidance. Their MIT licence and third-party acknowledgements are
  bundled in `frontend/public/game/LICENSE.txt` and each generated build.
- Citation and credits name Dr Sam Martin, Synthetic Realities, Manchester
  Metropolitan University, Smart Data Research UK (UKRI), grant UKRI4010 and
  ORCID 0000-0002-4466-8374. Hivebound by zernonia is acknowledged as recorded
  by the game repository.

## Verification

- TypeScript and production builds passed for research, public demo and Conference.
- Component checks cover deferred game loading, local Studio scope, external
  link attributes, credits/DOI, navigation busy state and game-specific storage copy.
- Existing workshop-start, community presentation, podcast exploration and
  image-search scope regression suites passed. No new inference calls were made.
- Browser checks exercised Demo launch, individual play, the welcome guide,
  Workshop launch, the first noticeboard prompt, Dev navigation and deep links,
  keyboard sub-tab selection, frame removal and all four main views.
- Responsive layouts checked at measured CSS widths 320, 390, 487, 767, 1280
  and 1440 pixels, with no page-level horizontal overflow. Physical phone,
  television and screen-reader trials remain separate.
- The complete six-picture game and its local Studio are maintained and tested
  in their own repository; this pass checks the SDA Vision integration.

The new tab changes navigation and presentation. SDA Vision’s assessment prompts,
scoring rules, saved research records and method version are unchanged. Frozen
release archives and existing Zenodo records retain their published contents.
