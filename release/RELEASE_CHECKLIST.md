> Current update: the researcher confirmed MIT and requested the tested Pages
> launch. See [Pages acceptance](PAGES_ACCEPTANCE_2026-09-26.md) for the initial
> public preview. The remaining version/tag/DOI and conference rehearsal items
> below concern the later versioned software/Zenodo release, unless explicitly
> identified as unresolved in that acceptance record. Earlier private-checkpoint
> and dependency decisions are retained as preparation history.

# Final Release Checklist

Use this checklist to assemble the evidence for approval of the exact software
candidate. Publication is a separate, explicitly authorised step.

Reconciled 26 September 2026. Begin with [current readiness](READINESS_2026-09-26.md).
Unchecked items are unresolved or unrecorded, not scheduled checks. Earlier CSV
machine statuses are retained as history; do not interpret them as a current schedule.

## Before Making A Candidate

- [ ] Complete `TODO_RELEASE` entries using confirmed details; omit optional fields that remain unknown.
- [ ] Map the approvals already held to the exact configuration and intended demo/public use.
- [ ] Confirm code ownership/licence and dependency obligations, including the current pypdf/PDFium stack.
- [ ] Select the final examples and complete their rights and provenance register.
- [ ] Retest single upload, one-file batch, note/caption refresh and all report downloads.
- [ ] Check Community/Developer view switching and the facilitator PDF link and Notice/Discuss/Check/Reflect; preserve failed, unchecked, partial and inconclusive states.
- [ ] Check response inclusion/exclusion in workshop PDF/PPTX/CSV, media previews, long-note continuation, Unicode/CSV fallback and score isolation.
- [ ] Check End session preserves notes; New session cancellation preserves them and clearing needs acknowledgement; explain reload/input-change resets.
- [ ] Open downloads on physical iPad/Safari, Android/Chrome and the actual PowerPoint/conference setup.
- [ ] Test each newly selected live provider with approved inputs; record latency and cost.
- [ ] Record the C2PA trust-policy decision and limitations without claiming certification.
- [ ] Rehearse platform questions using the dated capability matrix; fill `PLATFORM_TEST_RECORD.csv` with actual original/derivative outcomes, not assumed support.
- [x] Confirm software author and affiliation (Dr Sam Martin only; MMU), ORCID and exact funding acknowledgement (UKRI4010), from the submitted forms on 26 September.
- [ ] Complete disclosure and paper/conference metadata; software authorship does not establish other outputs' author lists.
- [ ] Choose the final version; align config/package/citation/release fields deliberately.
- [ ] Validate completed CFF and, if used, JSON metadata. Templates are not ready metadata.
- [ ] Rebuild frontend and run the offline suite. Test a clean extracted archive on intended systems.
- [ ] Verify source illustration, font/licence and workshop helper tests survive packaging; retain required notices for the new frontend dependencies.

## Prepare The Academic Release

1. Generate the allowlisted candidate using `scripts/package_candidate.py`.
2. Inspect every manifest path, checksum, credential-scan result and example licence.
3. Confirm `.env`, `.git`, `.review-cache`, `dev_runs`, corpora, confidential approvals,
   trust stores, private backups and historic showcase caches are excluded.
4. Use a **new, separately approved public repository**, initialized from the
   inspected source export, with the local repair history retained privately.
5. Confirm the public account/organisation and repository URL before adding any remote.
6. Obtain explicit final publication approval: TODO_RELEASE approver/date/archive hash.

The review ZIP remains labelled UNAPPROVED even when technical checks pass. Rebuild
it after changing metadata or examples so each reviewed archive retains a stable
checksum and an identifiable version.

## GitHub And Zenodo

- [ ] Confirm academic repository owner and account plan. Review the [organisation/multiple-account options](PUBLISHING_ROUTE_2026-09-26.md) before creating another free personal account.
- [ ] Confirm repository-scoped Git/integration identity without changing the commercial configuration.
- [ ] Choose a project/resource site and recorded showcase for Pages, or separately scope a live backend. Keep provider keys out of static assets.
- [ ] Build a new staged showcase from reviewed cached records and rights-cleared originals; keep historical frozen demos unchanged.
- [ ] Test relative paths, all views, images/fonts, summaries, graph/report downloads and external links at a project subpath. Check the actual external links present in each built variant.
- [ ] Check the existing podcast draft in its owning Zenodo account; match files, intended report, attribution and rights before publication. Keep its DOI separate from software.
- [ ] Reconcile any existing deposit before creating another record; choose one software archiving route.

After approval, publish the inspected source to the chosen repository, create a
versioned release, and either archive it through the linked Zenodo integration or
make a deliberate manual software deposit. Verify the resulting record, files,
authors, licence and DOI before citing it. Avoid accidentally creating duplicate
records through both paths. Keep the paper DOI separate from the software DOI.

Place the validated `CITATION.cff` at the new repository root for GitHub citations.
If `.zenodo.json` is also used, Zenodo uses it in preference to CFF. Both must agree.
Store any reserved DOI only once it actually exists. Record the exact source
release/tag/commit and archive hash in the paper's reproducibility statement.

Official workflow references, reviewed 24 September 2026:
[GitHub citation files](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-citation-files),
[Zenodo metadata](https://help.zenodo.org/docs/github/describe-software/zenodo-json/),
[Zenodo GitHub archiving](https://help.zenodo.org/docs/github/archive-software/github-upload/).
