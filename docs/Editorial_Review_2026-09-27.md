# Copy review — 27 September 2026

Copy revision: `editorial-2026-09-27.1`. Analysis method:
`pdf-preparation-2026-09-26.1` (unchanged).

## Purpose and changes

The researcher requested prose that introduces the purpose of each feature,
describes its actual coverage and invites informed review. The current copy
reduces repeated disclaimers and replaces general prohibitions with concrete
choices, processing facts and useful next steps.

The About page, README, privacy footer, external-check guidance and workshop
summaries now follow that approach. Explicit limits remain beside the relevant
check: Inconclusive, unavailable and failed results stay distinct; ratings are
not calibrated probabilities; sound-origin detection remains outside the
workflow; graphs retain “Distribution history: not assessed”.

The website continues to use ten prepared examples and saved findings. Every
original, saved report, prepared export, graph and media-credit file remains
byte-identical. Earlier results may therefore retain their original wording.
Session export labels use the current copy while preserving the recorded analysis
and separately entered notes. This revision makes no new provider requests.

## Verification

- Offline Python checks: 313 passed, with two existing dependency deprecation warnings.
- TypeScript and research/public production builds passed.
- Community presentation checks passed, including failed/unchecked/inconclusive
  states, sampling, provenance, response inclusion and report immutability.
- PDF/PPTX/CSV export-font checks passed with the original report unchanged.
- Browser checks confirmed Community Workshop as the default, ten choices,
  the revised recorded-finding summary, privacy text and About page. The
  390-pixel viewport had no horizontal overflow or file-upload inputs.
- The rebuilt site contains 272 files; prepared examples and results retain
  their previous hashes. Method rules, consent controls and dependencies are unchanged.

These are software and browser-viewport checks. Physical-device, projector,
browser file-saving and native presentation-software rehearsals remain to follow.

Local collaboration and contribution guides are excluded from the current
repositories and release package. The public demo contained neither guide.
The full source remains private; this update publishes revised demo copy.

## Repository audit scope

The audit started from the researcher's committed edits: private `75ce95e` and
public `92f5e2d`. Their revised verdict, launch, health-lens and privacy sections
were preserved; the duplicate privacy link was removed and the remaining
introductory copy was aligned with them.

| Surface | Review outcome |
|---|---|
| Private README, privacy and security | Purpose and processing first; retained recipients, consent, retention and status boundaries. Added the agreed ORCID link. |
| Public README and About | Invites exploration; explains prepared results, browser-session notes, external services and host privacy. |
| Workshop and external checks | Replaced repeated “needs human review” with source/context comparisons; kept status distinctions and manual attachment choices. |
| Session downloads | Updated app-owned scope text; original provider replies, findings and notes remain intact. |
| Release and Conference guidance | Clear actions and current configuration; corrected stale descriptions of implemented note entry and the Conference profile. |
| Example inventory | Clarified eleven private preparation examples versus ten public examples; media bytes and credits unchanged. |
| Saved reports, graphs and prepared exports | Reviewed as historical research records; retained verbatim. |
| Method, acceptance, capability and compatibility records | Retained dated evidence and uncertainty; current entry-point guides link to this review. Historical capability statements are not a fresh vendor assessment. |
| Code, configuration, prompts and tests | Reviewed wording surfaces; processing rules, model prompts, consent controls and structured statuses unchanged. Existing wording assertions updated with their underlying safety checks retained. |
| Licences, third-party notices and rights terms | Retained exactly. The scope document's obsolete contribution-guide link was removed; its terms were preserved. |
| Local guidance | Removed AGENTS.md and CONTRIBUTING.md from current tracked files and the package allowlist at the researcher's request; local workspace copies retained. |

## Packaging correction

The full check exposed an existing package-builder error: directories with no
filename extension were being selected alongside extensionless licence files.
The builder now skips ordinary directories, retains the notice files and
continues to reject symlinks. A regression check covers that distinction and
the exclusion of local guidance. This is a packaging repair, separate from
scientific method and copy revisions.

The earlier commits in the private repository remain historical Git records;
removing a file from the current tree does not erase its earlier versions.

## Editorial references

Privacy wording was checked against ICO guidance on
[controller and processor roles](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors/),
[special-category data and DPIAs](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/),
and [publicly available personal data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-common-issues-might-come-up-in-practice/).
This review changes explanatory language; institutional decisions remain in
the approved processing record.

## Workshop presentation - 27 September browser checkpoint

Display/workshop revision: `workshop-flow-2026-09-27.1`.

Community Workshop and Facilitator use a bold, black Start here heading. The
opening illustration has an exact-file saved analysis covering Claude, OpenAI
and Gemini readings. Its Notice, Discuss, Check and Reflect activities share the
current response. The ten menu examples and their set graph form a separate set.

Discuss offers media-specific observations. Check presents recorded findings;
image/file history and C2PA details sit within Provider evidence and ratings.
Response-storage information is in About/privacy guidance and the reset dialog.
The compact footer provides credits, repository and privacy links. The [workshop guide](Workshop_Activities_2026-09-25.md)
describes controls, response handling and downloads.

Scientific method and raw saved reports retain their recorded versions. Model
inference is outside this display revision. Physical-device and native-download
acceptance is recorded separately from automated and browser checks.

The findings overview and Evidence box each span the workshop page width. Provider evidence and ratings brings together model readings, supporting and additional findings, and the expandable file-history record. The footer groups credits, repository and privacy links.

Verification for this display revision: 27 focused Python checks, research/public workshop render checks, community export helpers, TypeScript and both builds passed. Browser review covered the opening four-step journey, both workshop views, preserved responses, C2PA detail, podcast sound scope and phone/desktop widths. Physical-device and native-download acceptance remains with the researcher. This checkpoint preceded publication of the illustrated facilitator guide.

## Current presentation and attribution

Display revision: `facilitator-guide-2026-09-27.1`.

The app offers Community Workshop, Developer and Facilitator guide in one centred menu. The guide tab includes an introduction, activity previews and a download of six-page version 1.1, with screenshots, group questions and practical session guidance. The workshop guide and README display the cover and link to the PDF. The project attribution includes Dr Sam Martin, Smart Data Research UK (UKRI) Fellow (Grant number UKRI4010.), Manchester Metropolitan University (MMU) and ORCID 0000-0002-4466-8374.

The MIT permission and warranty terms retain their exact wording. The project copyright notice and attribution reflect the confirmed name, university and grant. Third-party notices, original media, historical reports and saved model replies retain their existing content.

The guide and its metadata are included in the Zenodo preparation pack. A Zenodo guide DOI has not been recorded.

Validation: 27 focused Python checks passed, alongside the workshop navigation/render checks in research and public profiles, community export helpers, TypeScript and both frontend builds. Browser checks covered the opening example through Notice, Discuss, saved Check findings and Reflect, with preserved first impressions and a 390-pixel layout. The PDF has six visually reviewed pages, matching copies and valid links. Saved analysis and media bytes are preserved. Physical-device and projector rehearsal remain separate acceptance checks.

## Podcast preview presentation

Display revision: `workshop-resources-2026-09-27.1`.

The podcast uses Dr Sam Martin’s supplied diagram as preview artwork in Community Workshop and Developer views. Its citation remains visible. A separate headphones/player box occupies the clear area below the artwork, with native play, pause and seeking controls. The artwork remains visible when recorded findings open and is matched to the approved audio’s SHA-256. The audio download, saved report thumbnails, provider replies and scientific method retain their existing content.

Verification: artwork matching and mismatched-file fallback, recorded-findings persistence, workshop flow, TypeScript and research/public builds passed. Browser review covered both views and 390-pixel and desktop layouts, with no horizontal overflow or upload controls in the public demo. Physical-device playback remains part of researcher acceptance.

Reflect offers four practical next steps: find the original source, compare other evidence, ask someone with relevant expertise and pause before sharing. **Open Google Lens** sits beside the source-search choice and opens Google’s image-search page in a new tab. The researcher chooses any image to share on Google’s page; following the link is independent of recording a checkbox response. Date and context remain covered in the other relevant activities.

The **Facilitator guide** tab contains an introduction for community facilitators, trainers, educators and researchers. It explains preparation, group use and closing a session, shows exact page previews of Workshop Activities 1 (Notice) and 2 (Discuss), and offers the complete version 1.1 PDF. GitHub documentation and the Zenodo preparation bundle carry the same introduction and previews. The current PDF has refreshed activity screenshots. The approved version 1.0 PDF and local-only editable PPTX remain available as earlier versions.
