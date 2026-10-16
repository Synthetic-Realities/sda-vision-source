# SDA Vision: Local Release Review

Prepared 15 October 2026. Software **0.1.3-rc.1**; facilitator guide and participant
sheet **1.7 review**. These are local candidates. No repository, website or Zenodo
record was changed.

## Start Here

1. Open the facilitator PDF and participant sheet in the pack's `03-guides` folder.
2. Work through [Review before publishing](REVIEW_CHECKLIST.md), one short session
   at a time. Record your decisions in a separate copy so the checksummed pack
   remains an exact snapshot.
3. Confirm final versions and destinations. Any changed text, media or version
   label needs a fresh build, checksums and final review before publication.

## Separate Outputs

| Pack folder | Contents | Intended use after approval |
| --- | --- | --- |
| `01-source` | Allowlisted app ZIP, fresh Research frontend, locked dependencies, selected original examples, tests and documentation | Contents of a clean source repository; software archive for Zenodo |
| `02-recorded-demo` | Static demo ZIP, saved findings, ten menu examples and one opening practice illustration | Separate demo repository or static hosting; prepared examples only |
| `03-guides` | Eight-page facilitator PDF, one-page participant PDF, Markdown instructions, editable HTML/CSS, previews and notices | Workshop handouts and a guide-resource deposit |
| `04-review` | Draft metadata, release notes, review checklist, verification record and inventories | Local publishing decisions; share only the appropriate completed public-safe records |
| Pack root | File-level manifest and SHA-256 checksums | Identify the reviewed bytes and verify later copies |

The source application supports researcher-operated live analysis. Its API keys
are unconfigured in the archive. It is distinct from the participant demo.
The demo uses the side-by-side SynthID and OpenAI boxes; its pasted notes stay in
browser memory and session downloads. Original saved findings and graph downloads
retain their recorded contents.

## Use Locally

- **Recorded demo:** extract its ZIP, open a terminal in the extracted folder and
  run `python3 -m http.server 8896 --bind 127.0.0.1`. Use a free port if 8896 is
  occupied. Visit `http://127.0.0.1:8896/#community`; the guide is at
  `http://127.0.0.1:8896/facilitator.html#participant-checks`.
- **Research source:** extract its ZIP and read its README. Installation with
  `./setup.sh` downloads dependencies; `./run.sh` starts an installed app.
  Configure only the accounts/material approved for the intended research.
  The current installer requires native ARM Python on macOS; other target
  platforms need their own installation rehearsal.
- **Handouts:** the two PDFs can be read independently. The HTML guide requires
  its accompanying assets; use the recorded demo for the complete web edition.

## Publication Decisions

The draft retains the established software and guide Concept DOI families, author,
ORCID, MMU affiliation, UKRI4010 funding and MIT code/documentation licence.
No new DOI, publication date or release tag has been assigned. The current remote
versions and drafts have not been checked in this local-only session.

The pack excludes Git history, API keys, the working `.env`, personal test films,
private corpus/run folders, institutional approval documents, local trust stores,
development dependencies and caches. It includes selected prepared media and
saved findings deliberately; inspect their visible content and embedded metadata
before sharing. Automated scans do not establish rights clearance or institutional
compliance.

Older guide PDFs and dated preparation records remain in the source/demo archives
for compatibility and traceability. Use **1.7 review** for this review, rather than
an earlier edition. The guide-only companion contains the current edition.

See [release notes](RELEASE_NOTES.md), [draft metadata](metadata.json) and
[verification](VERIFICATION.md). The [example inventory note](EXAMPLES_README.md)
reconciles the older preparation note with the actual packaged set.
