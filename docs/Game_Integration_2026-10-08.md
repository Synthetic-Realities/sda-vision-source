# Hearsay Harbour in SDA Vision

Website integration revision: `game-arcade-2026-10-09.1`.

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

- [Game repository](https://github.com/Synthetic-Realities/hearsay-harbour#hearsay-harbour),
  inspected at `ca29499d857a7488eabdeb37ae20f967bf872d65`, after the 1.3.0 release.
  Its Pages deployment completed successfully at this commit.
- [Public game](https://synthetic-realities.github.io/hearsay-harbour/).
- [Game Concept DOI](https://doi.org/10.5281/zenodo.23243671), verified as the
  parent of version record `10.5281/zenodo.23243672` (1.3.0).
- Three live-game captures (island, Notice and the Arcade title screen) and three unchanged repository
  screenshots accompany the introduction and local Studio guidance. Their MIT
  licence and third-party acknowledgements are
  bundled in `frontend/public/game/LICENSE.txt` and each generated build.
- Citation and credits name Dr Sam Martin, Synthetic Realities, Manchester
  Metropolitan University, Smart Data Research UK (UKRI), grant UKRI4010 and
  ORCID 0000-0002-4466-8374. Hivebound by zernonia is acknowledged as recorded
  by the game repository.

## Layout and current game resources

The session introduction and Dev introduction use the available page width.
The Dev introduction has an open layout with its heading, text and actions aligned
to the page content. The game citation uses “cosy” and the verified 1.3.0 Concept DOI.
Island and Notice previews show the standard game; an Arcade title-screen preview shows
the remote/controller option and focus highlight. Versioned image filenames keep
previously cached previews separate. Reveal and Studio screenshots match the
current repository assets, which were unchanged in the GUI update.

## Arcade, TV controls and named findings

The Game introduction covers individual play and Workshop mode. The full-width
session text explains the optional keeper or group/class name on the certificate,
final recap and exported findings. The game stores the name with progress locally
in browser storage. Nicknames or session labels can be used. Findings downloads
work from the game's own tab; its embedded export path presents an image preview.

A big-screen section explains arrow/D-pad navigation, OK/Enter/A to choose and
Back/Escape/B to close. A new-tab action opens the live game with `?arcade`.
The game itself offers large Back and Continue side zones on suitable screens.
Dev guidance includes trying packs with the intended controls and accounting for
names in research exports. All game GitHub links open the README's Hearsay Harbour
heading, including the setup and full-credits links.

Zenodo's latest published record checked on 9 October is version 1.3.0,
`10.5281/zenodo.23243672`, under Concept DOI `10.5281/zenodo.23243671`.
The named recap and arcade commits follow that release. The site distinguishes
current GitHub source/live features from published Zenodo downloads. No Zenodo
record or game repository was changed by this SDA Vision presentation update.

## Verification

Current revision: TypeScript, all three builds and the existing Game component
suite; browser checks of Game and Dev copy, new-tab URLs, image loading and
desktop layout at 1600 CSS pixels. The Arcade title screen and welcome guide were opened in
the live game. Named recap/CSV behaviour was confirmed from its implementation.
Physical TV/gamepad checks and a full six-picture completion were not repeated.

Earlier integration verification:

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
