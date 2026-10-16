# SynthID external-check implementation — 11 October 2026

Status: local review candidate. Proposed releases: software 0.1.3 and guide 1.6.
Publication requires Dr Sam Martin's review of this candidate.

## Behaviour and schema

The schema `external-check-v1` records a participant-entered SynthID Detector
outcome. It identifies both the original item and submitted material by filename
and SHA-256; carries original/derived/participant-selected relationships,
material description, size, dates with timezones, optional operator name,
reported origin/coverage and exact service text.

Six outcomes remain separate: detected, not_detected, inconclusive, unsupported,
failed and not_checked. Entries with a service outcome require a reply. An
original-file record must match the original hash. A service origin can be
recorded beside a detected outcome. API validation rejects mismatched parent
hashes and extra fields; the record has no rating field. Up to 30 entries are
held per item, each with up to 20,000 reply characters.

Downloaded known example assets are checked against their expected hashes.
Installed PDF/PPTX extraction uses the existing local frame route and makes no
model call. Material changes clear the prepared identity, status, reply, origin,
scope and attestation. Late asynchronous preparation is discarded after an item
change. Saving requires an explicit exact-file attestation. The browser reads
an alternatively selected file's identity without uploading it.

## Scientific method boundary

This is a new evidence-recording workflow. Provider prompts, thresholds,
aggregation, C2PA trust policy, legacy machine statuses and saved results retain
their existing definitions. The legacy endpoint adapter receives a wording
correction identifying it as separate from the public portal.

Manual records do not enter the watermark adapter or automatic verdict
override. Installed research graphs attach them only as unscored observations.
The static demo keeps cached graphs unchanged and directs added evidence into
session exports. Human/source conclusions remain distinct from model scores.

## Editorial revision

Coverage copy names the submitted file, Google as recipient and the separate
website account/terms. Built-in audio wording identifies its scope while
retaining the required AI-origin statement. UI, exports, guide and current
release documentation describe the workflow as present behaviour. Historical
provider replies and frozen reports are preserved.

## Verification

The installation audit identified build dependency `source-map-js` 1.2.1.
The lockfile pins the compatible 1.2.2 patch for
[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
The targeted update reported zero npm advisories on 11 October 2026.

See the candidate acceptance record for completed checks and outstanding
physical-device review. Routine tests use fixtures; test replies are labelled
and excluded from the published example records. The live pilot record is
separate from mocked verification.
