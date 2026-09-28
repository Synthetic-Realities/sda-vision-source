import type { ProviderResult } from "../types";
import { capFirst } from "../lib";

// Shared by research and community views so evidence and credential facts agree.
export default function ProviderEvidence({ provider: p }: { provider: ProviderResult }) {
  if (p.id === "c2pa") {
    const validation = p.raw?.validation as Record<string, unknown> | undefined;
    const integrity = typeof validation?.integrity === "string" ? validation.integrity : "unknown";
    const trust = typeof validation?.trust === "string" ? validation.trust : "unknown";
    const declaration = typeof p.raw?.declaration === "string" ? p.raw.declaration : "Not recorded in this report.";
    return <div className="provenance-evidence">
      <p>{p.summary}</p>
      <dl>
        <dt>Credentials</dt><dd>{integrity === "absent" ? "Not found" : p.raw?.active_manifest ? "Present" : "Unknown"}</dd>
        <dt>Integrity</dt><dd>{integrity === "valid" ? "Validated" : capFirst(integrity)}</dd>
        <dt>Signer trust</dt><dd>{trust === "trusted" ? "Established by SDK" : "Not established"}</dd>
        <dt>AI / capture declaration</dt><dd>{declaration}</dd>
      </dl>
      {p.evidence.length > 0 && <details>
        <summary>Full provenance details ({p.evidence.length})</summary>
        <ul>{p.evidence.map((e, i) => <li key={i}>{capFirst(e)}</li>)}</ul>
      </details>}
    </div>;
  }
  return p.evidence.length ? <>
    <ul>{p.evidence.slice(0, 5).map((e, i) => <li key={i}>{capFirst(e)}</li>)}</ul>
    {p.evidence.length > 5 && <details>
      <summary>More evidence ({p.evidence.length - 5})</summary>
      <ul>{p.evidence.slice(5).map((e, i) => <li key={i}>{capFirst(e)}</li>)}</ul>
    </details>}
  </> : <span>{p.summary}</span>;
}
