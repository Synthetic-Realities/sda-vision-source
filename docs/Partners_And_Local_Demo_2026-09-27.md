# Partner artwork, original downloads and local demo

Historical display record. For the current installation and published release links, see the [28 September local presenter check](Local_Presenter_Check_2026-09-28.md).

Display revision: `partners-2026-09-27.1`. Guide edition: 1.4.

Community Workshop and Facilitator headings sit beside the SDA Vision logo. The shared menu keeps the three tabs centred, with MMU, Smart Data Research UK and UKRI on the right at desktop widths and a separate row on narrower screens. The same order appears in the facilitator PDF, current screenshots and repository acknowledgements.

**Download original file** sits alongside Google Lens in Reflect and the Evidence box. The link saves the chosen original (or the opening illustration). Lens opens a separate tab; the participant chooses any image sent to Google. Reflect offers this route for plain images. Session responses and saved analyses remain separate from these actions.

## Local presenter use

The upload-enabled app is the **Research** profile. Open http://127.0.0.1:8100/ while the local backend is running. Its installed frontend includes the current branding, guide, workshop controls and Developer layout. Local file selection, batch uploads, live checks and existing consent controls remain available. Provider credentials and runtime settings retain their existing configuration. Live provider checks need networking and use the configured accounts.

The separate **Conference** profile supports a reviewed list of approved examples, presenter authentication and live analysis. Its frontend is built from the same updated source; it is not a running hosted service. See the conference runbook for backend setup. The public Pages demo opens saved results.

## PowerPoint previews

Developer offers **Preview slides** in an enlarged viewer; Community Workshop keeps the inline slideshow. Uploaded presentations use local LibreOffice rendering, separate from analysis. The same source serves installed and conference profiles. See [PowerPoint preview setup](PowerPoint_Preview_Setup.md).

## Verification

Thirty preview and conference tests cover rendering limits, errors, temporary-file cleanup and profile boundaries. The approved 14-slide deck rendered locally in about four seconds without provider calls. A six-slide editable deck also rendered through the running local app and carried between Community and Developer views. TypeScript and workshop component regressions cover original download URLs and filenames, absent download sources, non-image reflection choices, existing analysis states and profile boundaries. Public, Research and Conference frontends build from the same source. Browser checks cover centred navigation, partner image loading, responsive headers and download links. The six-page PDF and six-slide editable PowerPoint are rendered and reviewed; the PowerPoint retains editable text and the three original embedded font faces.

The installed Research frontend is backed up before replacement. Fresh provider calls, physical-device file saving, conference hardware and projector rehearsal remain outside this display check. Original media, saved analyses, provider prompts, aggregation and consent policy retain their prior contents.

The public repository contains the website and PDF; the full source stays private. The editable conference PowerPoint is local only and excluded from GitHub and Zenodo packs. The Zenodo pack is prepared; deposit and DOI assignment remain pending.
