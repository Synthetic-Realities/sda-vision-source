# Provider Upgrade: 24 September 2026

Status: adapter compatibility prepared and tested offline. Your private `.env`
has not been edited. Account access, latency, cost and live output remain to test.
No model upgrade is evidence of better detection accuracy.

## Edit Only These Settings

In the app's `.env`, replace the existing model lines (do not append duplicates):

```dotenv
ANTHROPIC_VISION_MODEL=claude-opus-5-5
OPENAI_VISION_MODEL=gpt-6-astra
GOOGLE_VISION_MODEL=gemini-3.8-flash
ANTHROPIC_SUMMARY_MODEL=claude-haiku-4-5-20251001
```

Keep your API keys, consent, retention, corpus and port settings unchanged. Retain
your previous model values privately for rollback. Stop ongoing analyses before
running `./run.sh` to restart. Refresh the browser and confirm the displayed model
IDs. Test one approved image before any batch; all three calls incur provider costs.

| Role | Selected model | Reason / compatibility change |
|---|---|---|
| Anthropic visual and text analysis | `claude-opus-5-5` | Current Opus generation; always-on thinking; low effort with 8,192 total output-token cap |
| OpenAI visual and text analysis | `gpt-6-astra` | Current flagship; Chat Completions remains supported for this tool-free JSON task; low effort, 8,192-token cap |
| Google visual/text analysis and existing audio transcription path | `gemini-3.8-flash` | Current stable Flash; low thinking, at least 8,192 output-token cap; `minimal` is rejected |
| Optional pasted-note scoring | `claude-haiku-4-5-20251001` | Retain the current small-model role, with a dated identifier; not a fourth visual assessor |

Anthropic also lists Fable 5.1 for demanding long-horizon work. Opus 5.5 is the
recommended current upgrade for this app's existing Opus role; the recommendation
is not a claim that Opus is the newest or largest model across every Claude tier.
Fable is not silently substituted or treated as tested here.
[Claude model comparison](https://platform.claude.com/docs/en/models/overview).

The higher caps accommodate required reasoning and can increase cost. The existing
60-second provider timeout is unchanged. If approved tests time out, consider
`PROVIDER_TIMEOUT=120` and restart; that trades a longer possible wait for completion,
not a guaranteed success. Do not change MAX_FRAMES until per-file cost is understood.

The corresponding annotation requests use the same compatibility adjustments.
Older model IDs retain their earlier request settings. Consensus thresholds and
prompts are unchanged. New runs carry method `publication-repair-2026-09-24.1`;
do not relabel or pool historical results as if they used these models.

## Other Providers Are Not Model-Name Upgrades

- C2PA remains on the pinned local SDK and fail-closed reviewed-trust policy.
- Local forensics has no hosted LLM model ID.
- Leave `SYNTHID_ENDPOINT` and `SYNTHID_ACCESS_TOKEN` blank. The existing custom
  adapter is not a drop-in client for Google statistical detection or OpenAI
  Content Provenance. Browser verification is still external.
- `OPENAI_TRANSCRIBE_MODEL=whisper-1` remains the deliberate audio fallback.
  A new speech-model rollout is separate from upgrading the three vision roles;
  do not switch to a vision model ID in that setting.

## Acceptance And Rollback

Record the new exact model IDs, response status, elapsed time, displayed verdicts,
exported JSON and provider-console costs for one image, one document and any
approved audio/transcript workflow. An unconfigured/unauthorised response is an
access issue, not a negative detection result. There is no silent model fallback
in the visual panel. Restore previous `.env` model values and restart to roll back
the model panel; keep old/new reports separate.

## Official Sources

Checked 24 September 2026. These establish API compatibility, not your account access.

- [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [OpenAI migration settings](https://developers.openai.com/api/docs/guides/latest-model)
- [Claude Opus 5.5 migration](https://platform.claude.com/docs/en/models/opus-5-5/migration-guide)
- [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)
- [Gemini thinking levels](https://ai.google.dev/gemini-api/docs/generate-content/thinking)
