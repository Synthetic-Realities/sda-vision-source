# Current decision, 26 September 2026

The researcher confirmed **MIT is the agreed project code licence**. The existing
copyright notice remains unchanged. The public-preview candidate replaces
PyMuPDF with pinned pypdf/PDFium dependencies; see
[the separate method change record](PDF_Dependency_Change_2026-09-26.md).
Exact browser dependency/font/sample notices are retained in `third_party/` and
in the deployed website. Python wheel notices remain installed with their packages.
No Python or ffmpeg binary is included in the source repository or Pages site.

The Adobe sample has been matched byte-for-byte to its official repository and
its MIT notice included. Researcher-confirmed permissions for the eleven examples
are described in `examples/CREDITS.md`; code MIT does not relicense the media.
The final versioned Zenodo software deposit remains a separate preparation step.
The table below is the earlier review record; its open questions are superseded
where this current decision and the Pages acceptance record give a result.

# Third-Party Release Review

This is a release gate checklist, not legal advice or a completed licence audit.
The project's existing MIT licence has not been replaced.

Reconciled 26 September 2026 with workshop export dependencies and UI assets.

| Component | Known issue | Required decision/evidence |
|---|---|---|
| Project code | Existing MIT notice; institutional ownership needs confirmation | MMU-approved copyright holder and licensing decision |
| PyMuPDF / MuPDF | AGPL or commercial licence; not covered by the app's MIT notice | Confirm applicable obligations, obtain appropriate licence, or plan a reviewed replacement |
| Python/JavaScript packages | Exact versions now recorded in lockfiles | Retain dependency notices; verify combined-distribution obligations |
| jsPDF 4.2.1, PptxGenJS 4.0.1, Marked 18.0.14 | Installed packages declare MIT; introduced for browser workshop exports | Retain exact dependency/transitive notices and include them in the final distribution review; npm advisory scan on 26 September is recorded below; licence review remains separate |
| Noto Sans Regular | Bundled font and SIL Open Font License text | Keep font and exact licence together; test font coverage/fallback and exported appearance |
| Community illustration | Researcher-approved app artwork; original AI-generated/edit history in the local asset README | Confirm public redistribution/attribution terms and reference-image permissions; app-use approval is not automatically public-pack clearance |
| ffmpeg / ffprobe | External binaries; build options affect licensing | Record the actual installed build/version/licence for the tested distribution |
| Adobe C2PA example | A published sample is not by itself a redistribution licence | Record original source and explicit permission/licence terms |
| NASA image | Existing credit says public domain and downscaled | Retain source, attribution and transformation record |
| Generated illustrations | Existing credits say project-generated | Confirm generator, generation date, terms and absence of third-party content restrictions |
| NotebookLM outputs | Authorship of a paper does not alone establish all publisher/media rights | Review source-paper terms and output redistribution rights |
| Podcast | Existing credits cite a Zenodo CC BY 4.0 record and a manual SynthID check | Verify record/licence and retain dated checking evidence; a pasted reply is not an integrated detector |

The [podcast review](../release/PODCAST_DEPOSIT_REVIEW_2026-09-26.md) records public
404 responses for the historically reserved DOI and the report/date discrepancy.
The owning account is needed to inspect a private draft. Existing credit text is
historical evidence to reconcile, not proof of publication or cleared rights.

Do not describe the complete stack as unconditionally suitable for a closed
commercial plugin. The release candidate ZIP is local and unapproved, and may
contain examples awaiting these checks. Do not upload it unchanged to Zenodo.

Primary source: [PyMuPDF licence and copyright](https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright)
(checked 19 September 2026). Its own documentation identifies the AGPL/commercial
choice. The practical obligations for this distribution should be confirmed by
the institution's research software/IP support, not inferred from an npm/pip audit.

## Export Dependency Check, 26 September

The installation rehearsal identified image-size denial-of-service advisories
[GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) and
[GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr). A scoped
PptxGenJS transitive override pins image-size 2.0.4. The lockfile was updated; npm
audit then reported zero known advisories. Browser PDF/PPTX exports, including
image-bearing workshop slides, passed. The current PptxGenJS browser code uses its
own image handling; retain the override review when upgrading that library. This
scan does not establish licence compatibility or absence of undisclosed defects.
