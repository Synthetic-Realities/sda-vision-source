# Next steps: GitHub, GitHub Pages and Zenodo

**Current private checkpoint, 26 September:** the selection has eleven examples
with descriptive filenames, including the podcast. Eight reuse saved model
replies and three have local checks only. The researcher confirmed the academic
Git identity **Synthetic Realities — Dr Sam Martin <smartin@mmu.ac.uk>**.
The [testing handover](../docs/GitHub_Testing_Checkpoint_2026-09-26.md) supersedes
the earlier preparation status below. Public launch follows testing; no new
inference, Pages deployment or Zenodo publication is authorised by this update.

Working handover, 26 September 2026. Preparation can continue while the remaining
metadata is completed. The five-example decision is sufficient for local copying,
packaging and mocked tests. Sam subsequently approved one exact provider run; it
has completed with 33 usable replies and no retries. That approval is consumed.
Publication and any additional provider attempt remain separate decisions.

## 1. GitHub: prepare and test privately

**No new login or connection is needed for the current work.** GitHub CLI access
as **the authorised organisation administrator** was checked again on 26 September. The
[Synthetic-Realities/sda-vision repository](https://github.com/Synthetic-Realities/sda-vision)
is private, contains its initial README only, and grants this login administration
and push access. Pages is disabled. The separate plugin's access is not needed for
this CLI route.

Prepared locally:

- Five neutral, byte-identical example copies: three images, a PDF and a PPTX.
  Their original-name mapping is in the private facilitator key, outside release
  archives. All 18 source originals remain unchanged.
- Explicit selection and SHA-256 checks for source and showcase packaging. The
  default source archive includes no media; the selected bundle is supplied
  explicitly. Restricted videos and the podcast are outside this first selection.
- A fresh research frontend and an unapproved source review archive. This is the
  installable research application; its uploads/live processing are separate from
  the planned static Pages demo.

Next: inspect the exact clean source archive, import it into the private
repository without this working directory's history, and run acceptance against
that imported version. No source was pushed in this preparation step.

**Academic commit identity confirmed by the researcher:** `Synthetic Realities — Dr Sam Martin <smartin@mmu.ac.uk>`. Apply only to the clean release checkout. The organisation owns the repository; GitHub links a personal profile only when the commit email belongs to it. Global Git settings and other projects remain unchanged.

**Before making it public:** complete the code/dependency licence decision and
the selected examples' public reuse wording, reconcile the held processing
approvals with this exact build, and approve the reviewed candidate. The existing
MIT notice is not a completed review of dependency or media terms; see
[third-party review](../docs/Third_Party_Release_Review.md). Existing approvals are
recorded; this is a release-scope reconciliation, not a request to obtain them again.

## 2. GitHub Pages: saved-results interactive demo

Proposed address: **https://synthetic-realities.github.io/sda-vision/**. It is not
live. A custom domain is optional. GitHub Free supports Pages from public
repositories, including free organisations, so keep acceptance local while this
repository is private. [GitHub Pages scope](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

The public build allows selection of included examples, batches of saved results,
browser-only Second Opinion notes and approved downloads. It has no visitor
file-upload workflow or fresh model calls. GitHub serves the prepared files; the
researcher's laptop can be off. **Render and Vercel are not needed for this site.**
The separately authenticated Conference profile supports presenter-led live
analysis; its hosting/rehearsal is a separate decision.

The first five examples now have freshly generated saved analyses under their
neutral filenames, matched by original-file hashes. Earlier reports remain
unchanged. This avoids presenting renamed historical reports as new analyses;
neutral filenames do not hide visible source clues or original metadata.

Local preflight with network blocked found:

| Input | Available units | Initial sampled units |
| --- | --- | --- |
| Three images | Three original images | Three images |
| PDF | 15 embedded figures | Four figures, from pages 1, 6, 10 and 15 |
| PPTX | 14 embedded slide images | Four images, from slides 1, 5, 10 and 14 |

This is **11 visual inputs to each of three configured providers**. The approved
runner completed exactly **33 requests with no retries** using `claude-opus-5-5`,
`gpt-6-astra` and `gemini-3.8-flash`. Returned model identifiers matched. The normal
app's retry setting was bypassed by the reviewed single-attempt runner. No SynthID
endpoint is configured. Reported usage gives an estimate of **US$0.68** before tax,
conversion or account-specific terms, not a provider invoice.

**Method correction completed with Sam's approval:**
[`verdict-consistency-2026-09-26.1`](../docs/Method_Change_Record_2026-09-26.md)
requires matching verdicts and ratings for a directional vote. The two document
results now remain Inconclusive; the three image findings and all ratings are
unchanged. The original reports are preserved, and revised reports were recomputed
locally from the same saved replies with no new paid calls. The
[results review](SAVED_RESULTS_REVIEW_2026-09-26.md) links the comparison.

The static candidates are built and tested locally under the
`/sda-vision/` path. All three public views, batches, Second Opinion notes, session
exports and the workshop variant passed; no API/provider/upload requests occurred.
Five original downloads and twenty report downloads matched their local bytes.
Next: review the revised results, exports and visible credits/reuse wording,
complete the
physical-device/projector checks, and approve publication. The
[manual Pages workflow template](pages-workflow.yml.template) is inactive until
installed and configured for the approved candidate. It deploys only a reviewed
`site/` directory and never runs inference. The first live deployment also needs
a URL/download check. [GitHub custom workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 3. Zenodo: separate software and podcast records

The software needs its **own** DOI. The existing podcast preview is record
**21302105**, with reserved all-versions DOI **10.5281/zenodo.21302104** shown in
the supplied capture. Preserve that draft; its version DOI and current listing
still need confirmation in the owning account. The reserved media DOI is not the
software DOI. [Podcast deposit review](PODCAST_DEPOSIT_REVIEW_2026-09-26.md)

For the first software deposit, the proposed route is a **manual, reviewed source
ZIP** matching the final GitHub tag. It gives us an explicit file/metadata review
before publication. GitHub-to-Zenodo archiving is also available, but enabling a
repository makes new published GitHub releases trigger deposits. Choose one
route for a version; do not duplicate it through both.
[Manual software deposit](https://help.zenodo.org/docs/github/archive-software/manual-upload/),
[GitHub integration](https://help.zenodo.org/docs/github/enable-repository/)

**From Sam, in a short metadata session:**

1. Access to the Zenodo account holding the podcast draft, when we reach that step
   (sign in yourself; no password or token needs to be sent in chat).
2. Software authorship is confirmed: **Dr Sam Martin only**. Affiliation, presentation role and ORCID
   [0000-0002-4466-8374](https://orcid.org/0000-0002-4466-8374) are already recorded;
   the researcher supplied this ORCID during this preparation step.
3. Public contact, software licence decision and separate media terms remain open.
   Funding is confirmed exactly as: “This work was supported by Smart Data Research
   UK, a UKRI investment; Grant number UKRI4010.” This replaces the older draft
   grant reference; author/funding questions do not need to be asked again.
4. For the podcast, recover its actual attached July report and original checker
   reply from the existing draft/source record. The screenshot locates the asset
   but does not replace those files or establish the checker claim's scope.

Codex will prepare a consistent citation, description, release notes, version/tag
proposal, checksums and DOI links. The current citation's version/date are historical
draft values, not an agreed September release. Review the final record and archive
before publication; then verify the assigned software DOI and link it back to GitHub.

## Smallest next session

The connection work is done. Citation/Git identity, sole software authorship and
funding are confirmed. Sam confirms that all three configured API accounts are
her own accounts used for this research, with **£200 as a planning ceiling only**.
The [five-example analysis proposal](ANALYSIS_RUN_PROPOSAL_2026-09-26.md)
records model-access checks, actual sending scope, current price scenarios and
implemented run limits. Sam reports **SamVision-1, paid Tier 1, Prepay**; the key's
project mapping and available credit have not been independently checked. The
guarded runner passed 32 mocked checks, and the subsequently approved live run
completed. The separately approved aggregation correction is implemented and
compared using the saved replies. Next are licence/contact/final-candidate
decisions, still through short forms. The other 13 examples do not block this
selection. Revised local preview: <http://127.0.0.1:8774/sda-vision/>; the earlier
8773 comparison preview remains unchanged.

Only the explicitly approved inference/media sends occurred. No push, Pages
deployment, Render service, Zenodo reservation or publication occurred.
