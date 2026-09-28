# Soundtrack Inspection And Optional Vendor Checks

Implementation date: 24 September 2026. Method `publication-repair-2026-09-24.3`.
The three-model visual panel and its scoring thresholds are unchanged.

## What Is Implemented

| Operation | Default or optional | Result | Boundary |
|---|---|---|---|
| Audio-track inspection for every supported video | Automatic, local | Presence, codec, channels, sample rate, duration, decode outcomes and sampled signal levels | Not a music, voice or AI-origin classifier; no platform-name prerequisite |
| Original-file C2PA | Local | Credential integrity, trust and declarations remain in the provenance section | A container declaration is not automatically a track-level claim |
| Standalone-audio C2PA | Automatic, local, before transcription | Original-file provenance retained even when no transcript is produced | Supported formats depend on the installed SDK; unavailable is not absent |
| Soundtrack-content assessment | Checkbox plus explicit button | Google Gemini describes an excerpt and may transcribe clearly audible speech/lyrics | Not synthetic-music detection; no change to visual score |
| Suno credentials check | Separate checkbox plus explicit button | Vendor-reported result bound to the original file hash | Not an independent acoustic detector or a replacement local trust policy |

No new vision LLM was added. Neither optional action is triggered by normal video
analysis, recognition of a brand, graph building, note changes or exporting.

Video reports now use Visuals and Audio tabs. "Audio detected" means a stream was
found, not AI music detected. The audio table's coloured statuses describe check
completion, not authenticity. Optional controls and technical detail are collapsed
until opened; exports retain the full report regardless of the selected tab.

The item graph shows hash-matched local audio and any recorded optional checks as
teal, unscored observations with dashed context links. They never enter visual
vote counts or agreement links. Graph summaries and PNG/CSV/GEXF exports retain
this distinction. Batch graphs retain audio context on each item without changing
their similarity calculation. Unrun services are not invented as graph observations.

## Local Sampling

The inspector inventories audio streams with ffprobe and samples up to four
tracks. For each inspected track it decodes up to three 3-second windows near the
start, midpoint and end; short or unknown-duration tracks may have one window.
Decoding uses mono 16 kHz signed PCM. Signal above -60 dBFS is a simple energy
observation after downmixing, not perceptual audibility, silence over the whole
file, acoustic fidelity or AI-origin evidence. Phase cancellation, quiet sections
and unsampled content can affect it. Decode errors and tool unavailability remain
distinct from no audio tracks.

ffprobe has a 10-second timeout and each decode a 15-second timeout. Network
protocols are disabled for these local operations. Temporary derivatives are
cleaned up after normal processing; this is not a secure-erasure guarantee.

## Optional Excerpts

Select a track and start time. The app checks the original file's SHA-256 against
the displayed report, inspects original-container C2PA, then extracts up to 20
seconds as mono 16 kHz PCM WAV. Only that derivative is sent to the configured
Google Gemini API using the user's key. Original hash, excerpt hash, sample window,
model, prompt version, consent flag and limitations are recorded. There is no
automatic fallback to another vendor. The operational record is not a signed
consent attestation.

The prompt requests content type, observations, a short transcript and limitations.
It does not request authenticity, AI likelihood, identity or a synthetic score.
This feature has automated contract tests but has not yet had a live Google
audio-content validation run. An API error is not an origin finding.

Existing standalone-audio transcription remains a separate workflow: Google
transcription with OpenAI fallback, then transcript analysis. Its judgements must
not be described as acoustic detection. See [privacy notice](../PRIVACY.md).

## Suno Check And The Compatibility Result

Suno documents a public developer API for checking its C2PA credentials. This is
not a general AI-audio detector. Its documented limit is 100 MB; rate limiting
applies. [Official documentation](https://suno.com/suno-credentials)

After explicit permission, one original researcher-supplied Suno MP4 was submitted
once on 24 September 2026. It returned **HTTP 200 / `verified_suno`**, confirming
compatibility for that exact file. This does not establish universal MP4 support
or independently validate the service's accuracy, retention or trust policy.
The original hash was unchanged. No extracted-audio substitute, other asset,
redirect, fallback service or retry was used.

The app sends original bytes with a neutral transport filename to the fixed
developer endpoint. A successful response is retained as structured JSON; exports
include its reported verdict, time, original hash, response hash and limitations.
The local offline verifier's unresolved signer trust remains a separate result.
Missing Suno provenance is not proof of non-Suno or human origin. HTTP failures,
unknown response schemas and rate limits are operational failures, not negative
provenance findings.

This adds a recipient/data-flow option to the tool. Use the institution's approved
processing record to establish coverage before research use; neither an explicit
click nor this one test establishes institutional approval for future uploads.
No `.env` change is needed for Suno; Google uses the existing enabled Google key.

## Reporting And Retention

Local inspection, optional content assessment and vendor observations are separate
report fields, not providers added to the visual voting panel. They survive JSON,
Markdown, CSV, PDF and PPTX export. Matching-hash optional records survive a video
deep pass. Old reports explicitly lack the new inspection rather than acquiring
invented retrospective results. Optional records are browser-held until exported
or included in a later saved deep pass; the optional endpoints do not save them.

Raw Suno responses may contain content identifiers. Review JSON and other evidence
before publishing; original media and private compatibility-test records remain
outside the release allowlist. The prospective paper plan is also excluded from
the source candidate archive.

## Remaining Checks

- [ ] Researcher tests local inspection on silent, music, speech and mixed videos.
- [ ] Explicitly authorise and validate a Google excerpt on permitted material.
- [ ] Compare Suno MP3/WAV/M4A originals and different MP4 exports under a protocol.
- [ ] Check audio-track-specific provenance assertions before considering any future override.
- [ ] Reconcile recipients and processing with institutional records.
- [ ] Broader music-origin detection requires a separate validated method, not this content-description prompt.
