# GitHub, Pages, Zenodo and Account Options

Reviewed 26 September 2026; updated after authorised private-repository creation
and the researcher's clarification of the public demo scope.

## Confirmed repository and access

[Synthetic-Realities/sda-vision](https://github.com/Synthetic-Realities/sda-vision)
was created **private**, with default branch `main` and an initial README only.
GitHub CLI is authenticated as **the authorised organisation administrator**; active organisation admin membership
and repository read/write/admin permissions were verified. The separate connector
still returned 404 for the private repository. CLI access is available for the
current work; configure the relevant GitHub App separately if connector/cloud
access is required. No existing local remote or private repair history was changed
or pushed.

Public visibility remains deferred until setup, acceptance and publication approval.
The next import will use the reviewed clean source export. See the
[installation and release plan](INSTALLATION_AND_RELEASE_PLAN_2026-09-26.md).

## Confirmed GitHub Pages scope

The researcher states that the held DPIA and Ethics clearances cover an interactive
demonstration with **no new visitor uploads**. The existing showcase implements a
recorded-results route, now explicitly selected by the researcher. It does not
need a live processing backend for each visitor. Developer batches must open
bundled saved examples; report and approved original downloads remain available
for manual Second Opinion and Google Lens activities.
Fresh pasted Second Opinion replies can remain in the visitor's browser and be
downloaded locally. Saved analysis does not require a read-only interface. The
static editors and session exports now support this browser-only workflow.
Pasted notes remain outside automated scoring and are not sent to a backend in
the public demo.

| Stage | What happens | Hosting/processing |
| --- | --- | --- |
| Preparation | Approved examples are analysed and reports/graphs/exports prepared | Local initially; optional private preparation compute later. |
| Public site and recorded interactive demo | Visitors select approved examples, explore saved findings and use available browser-generated summaries/downloads | GitHub Pages, after review. |
| Conference demonstration | Presenter initiates fresh analyses for the Innovation cafe, with a saved-results fallback | Dedicated presenter profile implemented; local or Render hosting and live rehearsal still to be selected and tested. |
| Full research application | New inputs and live processing | Separate local installation. |

GitHub Pages serves static HTML/CSS/JavaScript and is available for public
repositories on GitHub Free, including free organisations. While this source
repository remains private, keep the acceptance build local rather than changing
visibility merely to preview it. [Pages scope](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

The implementation uses `VITE_SHOWCASE=1`, saved report/graph routes and staged
build outputs. In the final candidate, test all presentation modes, disabled upload
paths, static downloads, browser performance and network activity at a project
subpath. The full app's former Public preview toggle changed only the local layout;
it has been relabelled Research / Compact. The separately built static showcase has
saved-example batches, browser-only notes and session exports. Automated
acceptance passed for those workflows; final examples and the exact Pages bundle
still need review.

**Render and Vercel are optional for this demo.** The earlier hosted-upload trial
recommendation is superseded. Heavy analysis can be completed before publication;
the public website works with the researcher's laptop switched off. The separate
live conference requirement can use Render for Python/media processing and fresh
provider calls, making the laptop a presentation/browser device. Pages does not
automatically move the local backend to the cloud. The conference profile needs
presenter access, server-enforced approved examples, tested native dependencies,
account/cost/retention settings and rehearsal. These requirements are detailed in
the [release plan](INSTALLATION_AND_RELEASE_PLAN_2026-09-26.md).

Render management access is now verified after the researcher installed the
plugin within this chat. A live workspace query returned **Synthetic Realities**;
an explicit service query including previews returned `null`, with no service
entries. The separately reported project grouping, region and billing remain
unverified. The earlier missing-tool blocker is resolved. No Render service has
been created by this work.

GitHub host access logging and user-opened external checker/search pages remain
separate processing flows. Map the actual released variant to the held approvals
in [PROCESSING_RECORD.md](PROCESSING_RECORD.md).

## Academic separation and GitHub accounts

A free **academic/project organisation** provides a separate repository owner, public name and access controls, administered through a personal login. It does not merge repository histories or grant access to private commercial repositories. It also does not guarantee an anonymous separation: public author/profile links may connect projects. [GitHub organisations](https://docs.github.com/en/organizations/collaborating-with-groups-in-organizations/about-organizations)

GitHub's current terms limit a person/legal entity to one free account, with a separate exception for an automation-only machine account. Check the existing personal account's plan before creating another free personal login. Paying for a commercial organisation does not itself establish the personal login's plan. A free organisation is the practical starting option here; a university-owned organisation is another option if appropriate. [GitHub account requirements](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#3-account-requirements)

There is no need to establish Education-benefit eligibility merely to publish a public repository and Pages site under GitHub Free. Additional educator benefits have their own eligibility requirements. [GitHub Education](https://docs.github.com/en/education/quickstart)

## Can Codex work with both?

There are distinct access paths:

- **Local Git/CLI:** multiple accounts can be authenticated on one workstation. GitHub CLI can switch the active account; per-repository credentials or SSH keys can separate Git operations. An author name/email is attribution, not authentication. We should set identity and verify the destination per project, without changing the commercial project's configuration. [Multiple accounts](https://docs.github.com/en/account-and-profile/how-tos/account-management/managing-multiple-accounts), [CLI account switching](https://docs.github.com/en/github-cli/github-cli/using-multiple-accounts).
- **OpenAI plugins:** official documentation describes multiple simultaneous connections to a plugin, selected per tool call. This establishes platform capability, not confirmation that two GitHub identities are connected in this session. The available GitHub installation query returned an empty list during this check; that alone does not diagnose the user's reported commercial connection. Confirm the actual GitHub connection and repository selection in settings before any remote operation. [OpenAI multi-account documentation](https://developers.openai.com/plugins/build/auth#support-multiple-accounts).
- **Codex cloud:** select the repositories/environment the GitHub connection is permitted to use. A second independent cloud GitHub login was not verified here; plugin multi-account documentation is not proof of identical cloud-environment behaviour. [Codex cloud setup](https://learn.chatgpt.com/docs/cloud).

If the academic project is a separate organisation accessible to the existing login, a second personal login may be unnecessary. Grant the relevant integration access only to the intended academic repositories and retain the commercial installation as configured.

That organisation route is now the researcher's chosen arrangement. GitHub permits
the same GitHub App to be installed on a personal account and multiple organisations.
The academic repository now exists. If plugin access is needed, configure the
relevant integration for Synthetic-Realities and this selected repository, then
verify it through that connector. A second personal-account connection is not needed for this structure.
[GitHub App installation](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party).

## Zenodo routes

Keep three identifiers distinct: the source paper DOI, the podcast media DOI and the app's software DOI.

Choose either GitHub-release archiving through Zenodo or a deliberate manual software deposit. Reconcile metadata and files before publishing; avoid depositing the same release through both routes. The podcast's recorded reserved DOI must not be used as the software DOI. [Zenodo GitHub archiving](https://help.zenodo.org/docs/github/archive-software/github-upload/), [DOI guidance](https://help.zenodo.org/docs/deposit/describe-records/reserve-doi/).

For the podcast, the researcher's capture now locates unpublished preview record
21302105 and identifies 21302104 as its reserved all-versions DOI. Continue from
that existing account/draft; confirm the version DOI and final files there. A new
login does not transfer draft access. See the [updated deposit review](PODCAST_DEPOSIT_REVIEW_2026-09-26.md).

## Concrete handover when the destination is ready

1. Continue with verified the authorised organisation administrator CLI access to the private Synthetic-Realities/sda-vision repository.
2. Import the approved clean source export with repository-local authorship. Keep the private repair history local and complete private acceptance before public visibility.
3. Add the validated citation file and release notes, then publish the approved version/tag.
4. Deploy only the reviewed static site/showcase to Pages; verify the public URL and downloads.
5. Complete the chosen Zenodo workflow and verify public metadata, actual files and assigned software DOI.
