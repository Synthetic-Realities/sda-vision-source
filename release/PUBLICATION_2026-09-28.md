# Publication record — 28 September 2026

Dr Sam Martin approved both deposits and the clean public software repository. Both Zenodo records are published. The software description preserves the researcher’s final “AI-generated and traditional media” wording.

| Resource | Published version | Version DOI | Concept DOI (latest published version) |
| --- | --- | --- | --- |
| SDA Vision software | 0.1.0 | [10.5281/zenodo.23008103](https://doi.org/10.5281/zenodo.23008103) | [10.5281/zenodo.23008102](https://doi.org/10.5281/zenodo.23008102) |
| Facilitator field guide | 1.4 | [10.5281/zenodo.23008189](https://doi.org/10.5281/zenodo.23008189) | [10.5281/zenodo.23008188](https://doi.org/10.5281/zenodo.23008188) |

The software record’s publication date is 28 September 2026; the guide retains its issue date of 27 September. Public record pages, file MD5 checksums and Concept DOI links were verified in the browser.

- Public source: https://github.com/Synthetic-Realities/sda-vision-source
- Public website: https://sdavision.io/
- Demo repository: https://github.com/Synthetic-Realities/sda-vision-demo
- Development repository: remains private.
- Public source root commit: 158bd00, importing the 381 approved archive files.
- Approved source ZIP SHA-256: d9ea464e5cd386830307dd99928abfbe55b83321185c60394094ce7ebba27cc0.

The five approved Zenodo files retain their checked bytes. The attached acceptance record and archive manifests describe the pre-publication checkpoint; this record supplies the completed publication status. Publication metadata and links are separate from scientific method versions. No provider calls or changes to saved analyses were made.

## Future versions and GitHub integration

GitHub account linking and repository release archiving are separate settings. Zenodo’s built-in integration archives published GitHub releases, rather than commits. Its current first-release implementation creates a record; subsequent releases use the preceding integration record. It does not provide a user-facing association to this manually deposited series.

To retain today’s Concept DOI, create subsequent versions from the existing software record’s **New version** action, or use an explicitly configured API release workflow targeting that series. Confirm any migration with Zenodo support before enabling a standard repository webhook. The software and guide continue as separate series. No GitHub release or repository auto-archive switch was created or enabled during this publication.

Sources: [Zenodo release guide](https://help.zenodo.org/docs/github/archive-software/github-upload/), [upstream release implementation](https://github.com/inveniosoftware/invenio-rdm-records/blob/master/invenio_rdm_records/services/github/release.py), [version management](https://help.zenodo.org/docs/deposit/manage-versions/).

## Verification

TypeScript and the public/research builds pass for the publication-link revision. The previously approved acceptance checks remain the evidence for analysis behaviour and physical devices. GitHub visibility, commit authorship, Pages deployment and live publication links are verified separately at completion.
