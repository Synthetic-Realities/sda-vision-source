import type { Report } from "../types";
import { creationHistory, fileRecordSummary } from "../community";

export default function CredentialSummary({ report, community = false }: { report: Report; community?: boolean }) {
  const provider = report.providers.find(p => p.id === "c2pa");
  if (!provider) return null;
  if (community) {
    const record = fileRecordSummary(report);
    return <details className="credential-summary community-file-record">
      <summary>About this file</summary>
      <strong>{record.finding}</strong>{record.lines.map((line, i) => <p key={i}>{line}</p>)}
    </details>;
  }
  const history = creationHistory(report, report.meta.kind);
  const policy = provider.raw?.trust_policy as Record<string, unknown> | undefined;
  const validation = provider.raw?.validation as Record<string, unknown> | undefined;
  const declarations = history.answers?.find(a => a.label === "Recorded creation method");
  return <section className="credential-summary" aria-label="Content Credentials summary">
    <h3>What the file records</h3><strong>{history.finding}</strong><p>{history.detail}</p>
    {provider.status === "ok" && validation?.integrity !== "absent" && <p>{declarations?.answer}</p>}
    {provider.status === "ok" && validation?.integrity === "valid" && policy?.approved === false &&
      <p>The saved check used no approved signer-trust policy. Its AI/capture declaration remains visible; SDA did not treat it as a decisive provenance finding.</p>}
    {provider.status === "ok" && Array.isArray(provider.raw?.history) && provider.raw.history.filter(h =>
      h && typeof h === "object" && h.scope === "active" && h.manifest === provider.raw.active_manifest).map((h, i) =>
      <p key={i}>The credential names {String(h.declared_signer || "an unspecified signer")}{h.generator ? ` and lists ${String(h.generator)} as its generator` : ""}.</p>)}
  </section>;
}
