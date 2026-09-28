# Method Change Record

Current candidate method: `publication-repair-2026-09-19.2`.
This is a software-method revision, not evidence of improved detection accuracy.
Historical reports, original example media and the earlier literature review
remain unchanged. Do not pool old and new results without recording their method.

| Area | Current candidate rule | Reporting consequence |
|---|---|---|
| One usable model | Inconclusive at every rating | Neither authenticity nor synthesis is confirmed by one opinion |
| Model disagreement | One synthetic model remains inconclusive even with forensic support | Forensics cannot break the tie |
| Multiple frames | A strict majority of all analysed frames is needed; synthetic/authentic conflict abstains | A minority or a 50/50 tie cannot determine the document |
| Fully synthetic document | Strict majority must specifically be synthetic, not merely partial | One synthetic frame cannot upgrade a majority of partial frames |
| Model dependence | Separate model outputs; no statistical-independence claim | Agreement is not calibrated confidence or independent replication |
| C2PA | Valid binding, SDK trust, no failures and reviewed local policy all required | No fixed 5/60/95 scores; no camera-authenticity override |
| Score | Median available model ratings, or mean available frame ratings | Descriptive score, never calibrated probability |
| Graph missing rating | Remains missing | Graph does not invent a replacement average |
| Graph identity | Matching input SHA-256 deduplicates, retaining first occurrence; legacy records without hashes retained | Similar pixels or shared filenames do not establish identical inputs |
| Corpus graph | Folder labels, image files only; unsupported/unreadable counts reported | Not model-scored results or a recovered social-media route |
| Isolates | Retained by default; explicit filter | Population and exclusions accompany JSON, GEXF, CSV ZIP and PNG |
| Summary text | Deterministic map description | No unsupported claim that partially synthetic items are more believable |
| PowerPoint | Fixed overview plus paginated variable-length details | Long frame lists and pasted notes cannot invade the overview table |
| Deep pass | Exact input/context/extraction/method identity required | Older or mismatched reports cannot silently merge into a new run |

The existing model panel is unchanged. This work does not add SynthID API access,
statistical image detection, platform data access or a new processing recipient.
The paired evaluation must record exact models, prompts, method version, input
hashes, extraction settings and trust policy for both comparison arms.

## Evidence Still Needed For The Paper

| Claim | Evidence required before making it |
|---|---|
| Detection performance | Labelled, approved evaluation; per-provider and consensus results; abstention-aware measures |
| Better than an earlier app/model | Paired comparison on the same inputs, with uncertainty and failure analysis |
| Screenshot robustness | Controlled source/transformation pairs; separate watermark, metadata and statistical detection outcomes |
| Provenance conformance | Reviewed trust policy and real-chain validation; software tests alone do not certify a validator |
| Approved processing | Match this implementation to the final approved ethics/DPIA record |
| Reproducibility | Release commit, locked environment, evaluation protocol and preserved as-run reports |

Two uncertain model readings are still labelled `partially_synthetic` by the
legacy heuristic. That is a triage label, not proof of an edit. The distinct
provider-verdict and consensus-vote thresholds also remain; any unification must
be versioned and evaluated rather than silently retrofitted to published results.
