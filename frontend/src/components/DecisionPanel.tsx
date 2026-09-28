import type { ReactElement } from "react";
import type { Consensus, EvidenceEntry, TraceStep } from "../types";
import { dissentNote } from "../lib";

export default function DecisionPanel({ consensus }: { consensus: Consensus }) {
  return (
    <div className="decision-block">
      <div className="evidence-cols">
        <div className="evidence-col supporting">
          <h3>Evidence supporting this verdict</h3>
          {consensus.supporting.length ? (
            consensus.supporting.map((e, i) => <EvItem key={i} e={e} why={false} />)
          ) : (
            <p className="ev-empty">No supporting findings are listed for this assessment.</p>
          )}
        </div>
        <div className="evidence-col not-decisive">
          <h3>Additional findings</h3>
          <p className="muted small">Shown separately from the combined assessment.</p>
          {consensus.not_decisive.length ? (
            consensus.not_decisive.map((e, i) => <EvItem key={i} e={e} why={true} />)
          ) : (
            <p className="ev-empty">No additional findings are listed.</p>
          )}
        </div>
      </div>

      <details className="trace">
        <summary>How this assessment was reached</summary>
        <ol>
          {consensus.decision_trace.map((s, i) => <li key={i}>{describe(s)}</li>)}
        </ol>
      </details>
    </div>
  );
}

function EvItem({ e, why }: { e: EvidenceEntry; why: boolean }) {
  return (
    <div className="ev-item">
      <div className="ev-head">
        <span className="ev-name">{e.name}</span>
        <span className="ev-rating">{e.rating == null ? e.verdict.replace(/_/g, " ") : `${e.rating}/100`}</span>
      </div>
      {e.note && <div className="ev-note">{e.note}</div>}
      {why && <div className="ev-why">Context for this result: {dissentNote(e.name)}</div>}
    </div>
  );
}

function describe(s: TraceStep): ReactElement {
  if (s.step === "override") {
    return <><code>override</code>: {String(s.detail ?? s.outcome)}</>;
  }
  if (s.step === "model_agreement") {
    const synth = (s.synthetic as string[]) ?? [];
    const auth = (s.authentic as string[]) ?? [];
    const unc = (s.uncertain as string[]) ?? [];
    return (
      <>
        <code>model agreement</code>: synthetic [{synth.join(", ") || "none"}], authentic [
        {auth.join(", ") || "none"}], uncertain [{unc.join(", ") || "none"}]
        {s.forensic_supports_synthetic ? ", forensics supports synthetic" : ""}
      </>
    );
  }
  if (s.step === "frame_agreement") {
    return (
      <>
        <code>frames</code>: {String(s.frames)} total, {String(s.synthetic_frames)} synthetic,{" "}
        {String(s.authentic_frames)} authentic, spread {String(s.rating_spread)}
      </>
    );
  }
  if (s.step === "verdict") {
    return <><code>verdict</code>: {String(s.value)} ({String(s.confidence)}) - {String(s.reason)}</>;
  }
  return <code>{s.step}</code>;
}
