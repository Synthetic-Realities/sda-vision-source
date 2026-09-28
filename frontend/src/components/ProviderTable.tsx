import type { ReactNode } from "react";
import type { ProviderResult } from "../types";
import { verdictLabel } from "../lib";
import ReportCell from "./ReportCell";
import ProviderEvidence from "./ProviderEvidence";

export default function ProviderTable({ providers, emptyAction }: { providers: ProviderResult[]; emptyAction?: ReactNode }) {
  return (
    <>
    <div className="table-wrap responsive-report-wrap" role="region" aria-label="Provider findings" tabIndex={0}>
      <table className="report responsive-report" role="table" aria-label="Provider findings">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">Provider</th>
            <th role="columnheader" scope="col">Type</th>
            <th role="columnheader" scope="col">Status</th>
            <th role="columnheader" scope="col">Verdict</th>
            <th role="columnheader" scope="col">Synthetic rating</th>
            <th role="columnheader" scope="col">Check confidence</th>
            <th role="columnheader" scope="col">Key evidence</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {providers.length === 0 ? (
            <tr role="row" className="placeholder-row"><td colSpan={7}>No analysis yet.</td></tr>
          ) : (
            providers.map((p) => <Row key={p.id} p={p} />)
          )}
        </tbody>
      </table>
    </div>
    {providers.length === 0 && emptyAction && <div className="empty-results-action">{emptyAction}</div>}
    </>
  );
}

function Row({ p }: { p: ProviderResult }) {
  const provenance = p.id === "c2pa";
  return (
    <tr role="row">
      <ReportCell label="Provider">
        <div className="prov-name">{p.name}</div>
        <div className="prov-model">{p.model || ""}</div>
      </ReportCell>
      <ReportCell label="Type" className="muted small">{p.kind}</ReportCell>
      <ReportCell label="Status"><span className={`pill ${p.status}`}>{p.status}</span></ReportCell>
      <ReportCell label="Verdict"><span className={`verdict ${p.kind === "analysis" ? "transcript-reading" : p.verdict}`}>{verdictLabel(p.verdict)}</span>
        {provenance && <small className="provenance-verdict-note">Provenance assessment</small>}
      </ReportCell>
      <ReportCell label="Synthetic rating">
        {p.rating == null ? (
          <span className="muted small">n/a</span>
        ) : (
          <div className="provider-rating"><div className="bar">
            <i style={{ width: `${p.rating}%`, background: "var(--accent)" }} />
            </div><strong>{p.rating}<span className="sr-only"> out of 100</span></strong>
          </div>
        )}
      </ReportCell>
      <ReportCell label="Check confidence" className="muted small">{p.confidence || "-"}</ReportCell>
      <ReportCell label="Key evidence" className="evidence">
        <ProviderEvidence provider={p} />
      </ReportCell>
    </tr>
  );
}
