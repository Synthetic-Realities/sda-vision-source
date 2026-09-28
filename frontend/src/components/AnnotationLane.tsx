import { useEffect, useRef, useState } from "react";
import type { AnnotateResult } from "../api";
import type { AnnotationCheck, AnnotationPointer, Report } from "../types";

// Annotation lane panel (pointer-not-verdict). Opt-in: the researcher triggers
// the pass, pointers render as cards, and each pointer takes one auditable
// human check record. State lives here and is written through onto the report
// object so exports and the JSON download carry it; the deep pass carries the
// annotation_* fields by prefix.

const OUTCOME_LABELS: Record<AnnotationCheck["outcome"], string> = {
  verified: "Source verified by researcher",
  not_verified: "Source not verified by researcher",
  inconclusive: "Inconclusive",
};

function CheckEntry(
  { pointer, existing, onSave, onClear }:
    { pointer: AnnotationPointer;
      existing?: AnnotationCheck;
      onSave: (check: AnnotationCheck) => void;
      onClear: () => void },
) {
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState<string>(existing?.outcome ?? "");
  const [checkedBy, setCheckedBy] = useState(existing?.checked_by ?? "");
  const [referent, setReferent] = useState(
    existing?.referent_consulted ?? `${pointer.referent_source} (${pointer.referent_version})`);
  const [note, setNote] = useState(existing?.note ?? "");

  function seedFrom(rec?: AnnotationCheck) {
    setOutcome(rec?.outcome ?? "");
    setCheckedBy(rec?.checked_by ?? "");
    setReferent(rec?.referent_consulted ?? `${pointer.referent_source} (${pointer.referent_version})`);
    setNote(rec?.note ?? "");
  }

  // Abandoned drafts must never survive: reseed whenever the underlying
  // record changes (saved, removed), and on Cancel, so an edit the
  // researcher explicitly walked away from can never later be recorded as
  // the audit entry.
  useEffect(() => {
    seedFrom(existing);
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, pointer.pointer_id]);

  // Validated at entry: every spec 6.6 field is required before a check can
  // be recorded, so an incomplete check cannot exist.
  const complete = Boolean(outcome && checkedBy.trim() && referent.trim() && note.trim());

  function save() {
    if (!complete) return;
    onSave({
      pointer_id: pointer.pointer_id,
      checked_by: checkedBy.trim(),
      checked_at: new Date().toISOString().slice(0, 19) + "+00:00",
      outcome: outcome as AnnotationCheck["outcome"],
      referent_consulted: referent.trim(),
      note: note.trim(),
    });
    setEditing(false);
  }

  if (existing && !editing) {
    return (
      <div className="al-check">
        <strong>{OUTCOME_LABELS[existing.outcome]}</strong> by {existing.checked_by} at{" "}
        {existing.checked_at} against {existing.referent_consulted}
        <p className="mono">{existing.note}</p>
        <div className="al-check-actions">
          <button className="ghost small-btn" onClick={() => setEditing(true)}>Amend check</button>
          <button className="ghost small-btn" onClick={onClear}>Remove check</button>
        </div>
      </div>
    );
  }

  return (
    <div className="al-check al-check-form">
      <span className="muted small">Record your source check. Complete each field so another
        reviewer can follow your reasoning.</span>
      <div className="al-check-fields">
        <select aria-label="Check outcome" value={outcome}
          onChange={(e) => setOutcome(e.target.value)}>
          <option value="">Outcome: not recorded</option>
          <option value="verified">Source verified by researcher</option>
          <option value="not_verified">Source not verified by researcher</option>
          <option value="inconclusive">Inconclusive</option>
        </select>
        <input type="text" placeholder="Checked by" value={checkedBy}
          onChange={(e) => setCheckedBy(e.target.value)} />
        <input type="text" placeholder="Source consulted (exact source and version)"
          value={referent} onChange={(e) => setReferent(e.target.value)} />
      </div>
      <textarea rows={2} placeholder="Reasoning, self-contained: what you compared and what you found."
        value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="al-check-actions">
        <button className="ghost small-btn" onClick={save} disabled={!complete}>
          Record check
        </button>
        {existing && (
          <button className="ghost small-btn"
            onClick={() => { seedFrom(existing); setEditing(false); }}>Cancel</button>
        )}
      </div>
    </div>
  );
}

export default function AnnotationLane(
  { report, onAnnotate }:
    { report: Report; onAnnotate?: () => Promise<AnnotateResult> },
) {
  const [pointers, setPointers] = useState<AnnotationPointer[]>(report.annotation_pointers ?? []);
  const [checks, setChecks] = useState<AnnotationCheck[]>(report.annotation_checks ?? []);
  const [laneNotes, setLaneNotes] = useState<string[]>(report.annotation_meta?.notes ?? []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  // Ghost-class guard, as in Results: an in-flight pass must never land its
  // pointers on (or mutate) a different report.
  const latestReport = useRef<Report>(report);

  useEffect(() => {
    latestReport.current = report;
    setPointers(report.annotation_pointers ?? []);
    setChecks(report.annotation_checks ?? []);
    setLaneNotes(report.annotation_meta?.notes ?? []);
    setStatus("");
    setBusy(false);
  }, [report]);

  async function run() {
    if (!onAnnotate || busy) return;
    // Replace-not-merge semantics: pointer ids are run-scoped, so recorded
    // checks cannot attach to a new run's pointers. Replacing a checked set
    // is therefore consented, never silent.
    if (pointers.length > 0 && checks.length > 0 &&
        !window.confirm("Generating new suggestions will replace the current suggestions "
          + "and delete their recorded checks. Continue?")) {
      return;
    }
    setBusy(true);
    setStatus("Asking each configured vision model for sources to check...");
    const target = report;
    try {
      const res = await onAnnotate();
      if (latestReport.current !== target) return; // report changed mid-flight
      if (res.annotation_pointers.length === 0 && pointers.length > 0) {
        // A degraded or empty re-run must not wipe a pointer set the
        // researcher may have checked; keep the stored set unchanged.
        setLaneNotes(res.annotation_meta.notes);
        setStatus("No source suggestions were returned"
          + (res.annotation_meta.notes.length ? " (see the check details)" : "")
          + ". The existing suggestions and checks are unchanged.");
        return;
      }
      report.annotation_pointers = res.annotation_pointers;
      report.annotation_meta = res.annotation_meta;
      report.annotation_checks = [];
      setPointers(res.annotation_pointers);
      setChecks([]);
      setLaneNotes(res.annotation_meta.notes);
      setStatus(res.annotation_pointers.length
        ? `${res.annotation_pointers.length} source suggestion(s) ready for your review.`
        : "No source suggestions were returned for this item.");
    } catch (err) {
      if (latestReport.current !== target) return;
      setStatus(err instanceof Error ? err.message : "Annotation lane failed.");
    } finally {
      if (latestReport.current === target) setBusy(false);
    }
  }

  function saveCheck(check: AnnotationCheck) {
    const next = [...checks.filter((c) => c.pointer_id !== check.pointer_id), check];
    report.annotation_checks = next;
    setChecks(next);
  }

  function clearCheck(pointerId: string) {
    const next = checks.filter((c) => c.pointer_id !== pointerId);
    report.annotation_checks = next;
    setChecks(next);
  }

  return (
    <div className="annotation-lane">
      <h3>Suggested sources to check</h3>
      <p className="so-shared">
        Suggested sources to support your review. Check the publisher, date, version and
        relevance to the claim, then record what you found. These notes remain separate
        from the automated assessment.
      </p>
      {onAnnotate ? (
        <div className="al-run">
          <button className="ghost" onClick={run} disabled={busy}>
            {busy ? "Finding sources..." : "Find sources to check"}
          </button>
          <span className="muted small">
            Sends the analysed frames and context to the configured vision providers using
            your API keys. Charges vary with the frames and enabled providers. Suited to
            imagery with identifiable places.
          </span>
        </div>
      ) : pointers.length === 0 && (
        <p className="muted small">
          Available when the analysed file itself is loaded (an upload or an example).
        </p>
      )}
      {status && <p className="toast">{status}</p>}
      {laneNotes.length > 0 && (
        <ul className="al-notes">
          {laneNotes.map((n, i) => <li key={i} className="muted small">{n}</li>)}
        </ul>
      )}
      {pointers.map((p) => (
        <div key={p.pointer_id} className="al-pointer">
          <strong>{p.pointer_id}</strong>
          <span className="muted small"> suggested by {p.emitted_by} · {p.artefact_ref}</span>
          <p>{p.observation}</p>
          <p><em>{p.verification_action}</em></p>
          <p className="muted small">
            Source: {p.referent_source} · captured {p.referent_capture_date} ·{" "}
            {p.referent_authority} · {p.referent_version}
          </p>
          <p className="muted small">
            {p.panel_version} · {p.prompt_version} · generated {p.emitted_at}
          </p>
          <CheckEntry
            pointer={p}
            existing={checks.find((c) => c.pointer_id === p.pointer_id)}
            onSave={saveCheck}
            onClear={() => clearCheck(p.pointer_id)}
          />
        </div>
      ))}
      {pointers.length > 0 && (
        <small className="muted">
          Your source checks are retained in the audit record, separately from the automated score.
        </small>
      )}
    </div>
  );
}
