import type { ReactNode } from "react";
import type { Report } from "../types";
import { checkStatus, soundtrackFinding } from "../community";
import ProviderEvidence from "./ProviderEvidence";

export default function CommunitySoundChecks({ report }: { report: Report }) {
  const inspection = report.audio_inspection;
  const assessment = report.audio_assessment;
  const suno = report.suno_check;
  const provenance = report.providers.find(p => p.id === "c2pa");
  const partial = inspection?.status === "present" && inspection.tracks.some(t => t.decode_status !== "decoded");
  const rows: { name: string; status: string; finding: string; evidence: ReactNode }[] = [
    { name: "Local soundtrack", status: !inspection ? "Not checked" : partial ? "Partial" : ({present:"Complete",absent:"Complete",error:"Check failed",unavailable:"Unavailable"}[inspection.status] ?? inspection.status),
      finding: soundtrackFinding(report), evidence: inspection ? <>
        <p>Track details and measured audio levels in sampled windows.</p>
        {inspection.tracks.map(track => <p key={track.index}>Track {track.index}: {track.duration_seconds == null ? "duration not recorded" : `${track.duration_seconds.toFixed(1)} seconds`}; decoding: {track.decode_status}. Signal above -60 dBFS in {track.samples.filter(sample => sample.signal_above_minus_60_dbfs).length} of {track.samples.length} sampled windows.</p>)}
        {inspection.notes.map((note,i) => <p key={i}>{note}</p>)}
      </> : <p>This report has no recorded soundtrack inspection.</p> },
    { name: "Google Gemini audio description", status: !assessment ? "Not checked" : assessment.status === "ok" ? "Complete" : assessment.status === "error" ? "Check failed" : "Unavailable",
      finding: assessment?.status === "ok" ? assessment.content_type : "No completed excerpt description",
      evidence: assessment ? <><p>{assessment.provider} ({assessment.model}); track {assessment.track_index}, starting at {assessment.start_seconds}s for {assessment.duration_seconds}s.</p>
        <ul>{assessment.observations.map((note,i) => <li key={i}>{note}</li>)}</ul>
        {assessment.transcript_excerpt && <p>{assessment.transcript_excerpt}</p>}
        {assessment.limitations.map((note,i) => <p key={i}>{note}</p>)}
      </> : <p>An optional check describes a selected excerpt. It was not run for this record.</p> },
    { name: "Suno credentials", status: !suno ? "Not checked" : suno.status === "ok" ? "Complete" : "Check failed",
      finding: suno?.status === "ok" && suno.verdict ? ({verified_suno:"Suno reports a match",no_suno_provenance:"No Suno provenance reported",inconclusive:"Suno result inconclusive"}[suno.verdict]) : "No completed credential finding",
      evidence: <p>{suno?.note ?? "The optional Suno credential check was not run for this record."}</p> },
    { name: "Original-file C2PA", status: provenance ? checkStatus(provenance) : "Not checked",
      finding: "Credential coverage of this audio track: unresolved",
      evidence: provenance?.status === "ok" ? <ProviderEvidence provider={provenance} /> : <p>{provenance?.summary || (provenance ? checkStatus(provenance) : "No original-file credential result is recorded.")}</p> },
  ];
  return <div className="community-sound-checks">
    <p className="community-small">Soundtrack observations describe the recording and remain separate from the combined assessment.{report.meta.kind !== "audio" && " AI-origin detection from the sound itself is outside this workflow."}</p>
    <ul className="community-mini-models" aria-label="Recorded sound checks">
      {rows.map(row => <li key={row.name}>
        <div className="community-mini-name"><strong>{row.name}</strong><span>{row.status}</span></div>
        <div className="community-mini-reading"><p>{row.finding}</p>
          <details className="community-find-why"><summary>Find out why<span className="sr-only">: {row.name}</span></summary>
            <div className="community-key-evidence"><h3>Key evidence</h3>{row.evidence}</div>
          </details>
        </div>
      </li>)}
    </ul>
  </div>;
}
