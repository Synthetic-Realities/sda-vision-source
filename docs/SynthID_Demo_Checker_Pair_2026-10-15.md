# Recorded Demo: Visible Checker Pair

Date: 15 October 2026

## Change

SynthID Detector and the OpenAI image checker now appear together, with a
labelled paste-results box under each. Community Check shows them directly
after opening recorded findings; Developer uses the same component. They sit
side by side on wider screens and stack on narrow screens.

The demo no longer offers the older Gemini chat-based SynthID shortcut or
requires opening the two former checker disclosures. The three-model analysis
panel, historical replies and frozen reports remain unchanged. The separate
research interface retains its existing controls.

## Processing And Method

- Prepared examples only; no media-upload input was added to the demo.
- Pasted replies remain browser-session notes outside the recorded scores.
- SynthID replies retain their prepared-material association. Each prepared
  presentation slide retains its own reply when switching slide selection.
- The existing OpenAI shortcut remains enabled for image examples only. Its
  visible paste box can record another image's reply with page or frame context.
- No changes to provider prompts, models, thresholds, aggregation, credentials,
  trust policy, method version or structured research records.
- Recipient, metadata, account, terms and charges information stays beside the
  workflow. External links were not followed during verification.
- Original recorded downloads and cached graphs are unchanged. Session JSON,
  Markdown, CSV, PDF and PPTX retain both pasted replies separately from findings.

## Verification

| Check | Result |
| --- | --- |
| TypeScript and recorded-demo production build | Passed |
| Twelve local frontend regression scripts | Passed |
| Additional SHOWCASE external-check tests | Passed |
| Image, audio, video, PDF, PPTX component cases | Two visible paste fields; original format limits retained |
| Integrated demo rendering | New pair present; legacy Gemini shortcut absent |
| Escaping and note isolation | Raw reply retained as text; frozen report unchanged |
| JSON, Markdown, CSV session exports | Both test replies retained |
| PDF and PPTX text extraction | Both replies and historical structured record retained |
| Browser: Community and Developer | Both replies survive view changes; recorded ratings unchanged |
| Browser: prepared presentation | Slide 1 and slide 2 notes remain separate |
| Browser: desktop, 487px and 320px CSS widths | Wide pair / narrow stack; no horizontal page or field overflow |
| Browser: demo upload and duplicate route | Zero file inputs; zero Gemini chat links |
| Browser console | No captured errors or warnings |

Screenshots were reviewed for the desktop and narrow layouts. The browser's
existing zoom was preserved, and temporary viewport overrides were reset.
Test-only notes were cleared before handover.

Live vendor availability, account access and watermark accuracy were not
retested. No paid inference, media uploads, remote Git operations or publication
were performed. This is an interface revision, not a scientific-method update.

## Local Preview

New static preview: <http://127.0.0.1:8894/#community>

Build: `.review-cache/synthid-checker-pair-2026-10-15/dist-showcase` in this
repository. The preceding preview on port 8893, the older app and earlier
checkpoints are preserved. No changes were made to `.env`.

Please review whether the shorter labels and shared explanatory copy feel
comfortable in a workshop before release.
