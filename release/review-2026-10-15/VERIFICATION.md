# Local Release-Pack Verification

Date: 15 October 2026. Candidate software 0.1.3-rc.1; guide resources 1.7 review.

## This Packaging Run

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| Fresh Research production build | Passed, separate output; existing frontend left unchanged |
| Extracted-source rebuild | Passed; all 92 built files byte-identical to the packaged Research build |
| Backend tests from extracted source | 362 passed; outbound socket connections disabled |
| Frontend regression scripts from extracted source | All 13 passed, plus a separate SHOWCASE external-check run |
| Packaging-focused tests | 30 passed, including current guide resources, notices and private-file exclusions |
| Research API smoke test | Passed using the existing installed runtime; all external-provider keys unconfigured |
| Built file delivery through app | 92 static files returned with matching SHA-256 hashes |
| Recorded-demo entry pages | 15 local linked targets resolved |
| Original media and saved reports | Eleven selected originals match the approved bundle and report input hashes |
| Guide resources | Eight-page facilitator PDF and one-page participant PDF; text and hashes match source, packaged app and recorded demo |
| Font notices | Exact Noto and Bitstream Vera notices included; no PDF bytes changed |
| Candidate source path scan | No personal home-folder paths found in selected text files |

The completed pack's `verification.json`, `source-build-check.json` and
archive manifests record the machine-readable results. Source and demo ZIP
contents are checked against file hashes; ZIP CRC checks and path checks run
during assembly. All packaged bytes, including ZIP/PPTX members, are scanned
for recognised secret patterns and exact working-key values without printing
those values. This is a technical check, not a content or rights clearance.

The source package allowlist now includes guide edition 1.7, the participant
instructions, current tests, game artwork/notice, and missing historical guide
assets needed by retained documentation. The pack's example README reconciles
the earlier inventory text. Source media, saved findings and original credits
remain unchanged.

## Limits And Follow-Up

The test runner reported two dependency deprecation warnings concerning
Starlette/httpx and AnyIO. These did not fail the suite; review them in a later
dependency update rather than changing the runtime during packaging.

The extraction rehearsal reused installed local Python and Node dependencies.
It does not replace a fresh dependency download/install or a current advisory
scan. Browser/device acceptance, live checker access, vendor format limits and
new model accuracy were not retested. No paid model calls, external media
uploads, Git remote operations, deployment or Zenodo changes were performed.

Earlier same-day browser and guide checks are recorded separately in
`docs/SynthID_Demo_Checker_Pair_2026-10-15.md` and
`docs/Guide_Workflow_Update_2026-10-15.md`. They are prior evidence, not a new
live service or physical-device test.
