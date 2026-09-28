# Scope of this open-source release

> **Draft for sign-off.** This document states what the open MIT release covers and
> what is reserved. The boundary is a strategic/legal matter for the author and
> Manchester Metropolitan University's tech-transfer office to confirm — please
> review and adjust before relying on it.

## What the MIT licence covers (this repository)

The **SDA Vision detection instrument** as published here: the FastAPI backend,
the React/TypeScript frontend, the analysis pipeline, the provider integrations
(as code that calls third-party APIs with the user's own keys), the verdict
aggregation logic, the diffusion-graph and export tooling, and original project
documentation. Third-party dependencies and example media have separate terms;
their inclusion does not place them under the project's MIT notice.

You are free to use, modify, and redistribute this code under the terms of the
[MIT licence](LICENSE).

## What is explicitly **not** part of this release

The following are **reserved** and are not granted under this licence:

- **The "Social Analysis of Meaning" (SAM) commercial platform** and any of its
  proprietary code, designs, or interfaces. SDA Vision is an independent
  open-source instrument; the commercial SAM platform is a separate work.
- **Any hosted/SaaS service** built on or around SDA Vision.
- **The labelled research corpus** and any other research data. The corpus
  contains copyrighted, private, or licensed media and is never bundled; the
  default corpus path is unset in the public build (`CORPUS_DIR`).
- **Trained model weights or fine-tuned models**, if any are produced in future.
- **The "SDA Vision" / "SAM" names and branding**, beyond nominative use to refer
  to this project.

## Third-party services and keys

SDA Vision is **bring-your-own-key**: it calls Anthropic, OpenAI and Google APIs
using credentials the operator supplies. Those services are governed by their own
terms; nothing here grants rights to them. No API keys are included in this
repository.

## Relationship to the wider work

SDA Vision is the *technical detection layer* of the Synthetic Discourse Analysis
(SDA) methodology. This work was supported by Smart Data Research UK, a UKRI investment; Grant number UKRI4010.
It is designed to be inspectable and reusable on its own; any
integration into the commercial SAM platform is a separate, reserved work and is
not implied by this release.

## Contributions

By contributing you agree your contributions are licensed under the same MIT
terms (inbound = outbound).
