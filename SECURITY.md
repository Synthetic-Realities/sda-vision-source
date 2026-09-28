# Security

The research app is designed for a local loopback server on your own
access-controlled machine. Shared or internet-facing hosting needs a separate
security review of access, processing and retention. Keep provider credentials
in the local environment or `.env`. The Public preview toggle changes layout;
authentication and development retention remain governed by their own settings.
The presenter-operated Conference profile has separate access controls described
in the [runbook](docs/CONFERENCE_RUNBOOK_2026-09-26.md).

Report vulnerabilities privately to smartin@mmu.ac.uk. Include the affected
commit, delivery profile, impact and a non-sensitive reproduction. Keep private
data, keys and exploit details within that private reporting route.

This initial research preview has no long-term support commitment. Dependency
audits describe the packages and checks available at the time; they do not
certify the security of a deployment. See [PRIVACY.md](PRIVACY.md) for data flows,
storage and cleanup behaviour.
