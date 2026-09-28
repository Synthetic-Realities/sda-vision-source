import { useState } from "react";
import type { Report } from "../types";
import { downloadSession, type SessionFormat } from "../sessionExport";

export default function SessionDownloads({ reports }: { reports: Report[] }) {
  const [working, setWorking] = useState(false), [error, setError] = useState("");
  async function save(format: SessionFormat) {
    setWorking(true); setError("");
    try { await downloadSession(reports, format); }
    catch (e) { setError(e instanceof Error ? e.message : "The session download could not be created."); }
    finally { setWorking(false); }
  }
  return <div className="session-downloads extra-block">
    <h3>Download session with your notes</h3>
    <p className="muted small">Includes the recorded findings and separately labelled replies entered in this browser. JSON retains the complete original record.</p>
    <div className="extra-actions">{(["json", "md", "csv", "pdf", "pptx"] as const).map(format =>
      <button className="ghost" key={format} disabled={working || !reports.length} onClick={() => save(format)}>{format === "md" ? "Session Markdown" : `Session ${format.toUpperCase()}`}</button>)}</div>
    {working && <p role="status">Preparing session download…</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
