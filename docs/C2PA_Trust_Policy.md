# C2PA Trust Policy

Candidate policy: `embedded-offline-reviewed-trust-v3`, 24 September 2026.
This is a technical policy, not a claim of C2PA validator certification.
Version 2 is the historical 19 September policy; older reports are not rewritten.

## Current Behaviour

| Question | Behaviour |
|---|---|
| Which SDK? | `c2pa-python==0.37.12`, native SDK `0.91.0`; full environment in `requirements.lock` |
| Which standard target? | C2PA 2.4; scoped compatibility, not full conformance certification |
| Does media leave the device for C2PA? | No remote manifests or OCSP fetches; network host list is empty |
| Are integrity and signer trust distinct? | Yes; SDK state and validation codes are retained |
| Is an SDK trust result enough to override? | No; a reviewed local policy must also be present, valid and checksum-matched |
| Is a trust snapshot installed in this candidate? | No. Overrides remain disabled; declarations are informative |
| Are signatures probabilities? | No. C2PA has no numeric synthetic rating |
| Does camera provenance prove the scene is true? | No; it cannot override the overall verdict to authentic |
| Are missing credentials evidence of AI generation? | No |
| Are current revocation/freshness checks claimed? | No. Offline verification has that limitation |

The [upgrade record](C2PA_2_4_Upgrade_2026-09-24.md) records upstream release
status, local validation and remaining C2PA 2.4 tests. The
[platform scope](Platform_Provenance_Scope_2026-09-24.md) distinguishes file
credentials from vendor verification, social labels and visual interpretation.

The previous repair used `Settings.from_dict` as though it mutated an existing
object. It returns a new object. This candidate passes the returned, configured
object into the reader context and tests that exact boundary. Earlier claims of
enforced offline settings should not be treated as verified by that earlier code.

## Installing A Reviewed Snapshot

First, `python scripts/prepare_c2pa_trust_review.py` can fetch the official public
signer and timestamp lists to a new `.review-cache/c2pa-trust-review` folder. This
is an explicit network operation, not part of app startup. It records the source
commit, file hashes, roles and certificate details; the generated policy is
unapproved. No independent list-signature verification is claimed. A diagnostic
comparison is not installation or approval.

Do this only after a named institutional/technical reviewer has selected and
verified the appropriate signer and TSA roots, their source and validity period.
Use `trust-store/c2pa-policy.json` and a public-certificates-only PEM file in that
directory. This directory is ignored by Git and excluded from the candidate ZIP.

```json
{
  "schema_version": 1,
  "approved": false,
  "label": "REVIEW REQUIRED: official C2PA and TSA anchor snapshot",
  "source_url": "REPLACE WITH VERIFIED PRIMARY SOURCE",
  "reviewed_at": "REPLACE WITH UTC ISO TIMESTAMP",
  "valid_until": "REPLACE WITH REVIEWED EXPIRY TIMESTAMP",
  "trust_anchors": {
    "file": "anchors.pem",
    "sha256": "REPLACE WITH SHA256 OF EXACT PEM BYTES"
  }
}
```

After review, install the exact reviewed public anchors and completed policy in
`trust-store/`, setting `approved` to true only after the named review has finished.
Record the reviewer and renewal owner in your technical review record.
The template is deliberately not enabled. A checksum proves consistency with
the reviewed bytes, not legitimacy of a certificate or source. Never copy a
certificate from the inspected media into an allow-list merely to obtain a
trusted result. The implementation replaces default anchors with the reviewed
snapshot; it does not use `allowed_list` to bypass chain validation. Invalid,
expired, future-dated, changed or missing policy files fail closed for overrides.
The report retains policy/anchor hashes and review dates when a snapshot is used.

## Remaining Validation

- [ ] Review the official C2PA and TSA lists and any signature on the list delivery.
- [ ] Decide how legacy ITL results should be identified separately, or excluded.
- [ ] Validate actual trusted, unknown, expired, revoked and timestamped chains
  against the reviewed snapshot, not just synthetic SDK-response fixtures.
- [ ] Test original, modified, cropped, resized, re-encoded and screenshot assets.
- [ ] Set renewal ownership and expiry policy; offline does not mean permanently current.
- [ ] Reconcile the precise behaviour with the approved processing record.

Primary sources rechecked 24 September 2026:
[SDK settings](https://github.com/contentauth/c2pa-python/blob/main/docs/context-settings.md),
[official trust-list guidance](https://opensource.contentauthenticity.org/docs/conformance/trust-lists/),
[SDK package](https://pypi.org/project/c2pa-python/0.37.12/).
The guidance distinguishes official C2PA/TSA trust from the frozen legacy ITL.
Consulting one must not silently be described as using the other.
