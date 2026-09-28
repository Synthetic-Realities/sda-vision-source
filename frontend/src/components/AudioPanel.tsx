import { useEffect, useRef, useState } from "react";
import ReportCell from "./ReportCell";
import type { Report } from "../types";
import { assessSoundtrack, checkSuno } from "../api";

const sunoLabels = {
  verified_suno: "Suno reports verified Suno provenance",
  no_suno_provenance: "Suno reports no Suno provenance found",
  inconclusive: "Suno reports an inconclusive result",
};

export default function AudioPanel({ report, file, onChange }:
  { report: Report; file?: File; onChange?: () => void }) {
  const [googleConsent, setGoogleConsent] = useState(false);
  const [sunoConsent, setSunoConsent] = useState(false);
  const [track, setTrack] = useState(report.audio_inspection?.tracks[0]?.index ?? 0);
  const [start, setStart] = useState("0");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [, refresh] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const inspection = report.audio_inspection;
  const assessment = report.audio_assessment;
  const suno = report.suno_check;
  const hash = report.meta.input_sha256;
  const provenance = report.providers.find(p => p.id === "c2pa");
  const localComplete = inspection && ["present", "absent"].includes(inspection.status);
  const partial = inspection?.tracks.some(t => t.decode_status !== "decoded");
  const duration = inspection?.tracks.find(t => t.index === track)?.duration_seconds;
  const validStart = start.trim() !== "" && Number.isFinite(Number(start)) && Number(start) >= 0
    && (duration == null || Number(start) < duration);

  async function run(which: "audio" | "suno") {
    if (!file || !hash || busy || (which === "audio" ? !googleConsent || !validStart : !sunoConsent)) return;
    setBusy(which);
    setError("");
    setGoogleConsent(false);
    setSunoConsent(false);
    try {
      if (which === "audio") {
        const result = await assessSoundtrack(file, hash, track, Number(start));
        if (!mounted.current || result.input_sha256 !== hash) return;
        report.audio_assessment = result;
      } else {
        const result = await checkSuno(file, hash);
        if (!mounted.current || result.input_sha256 !== hash) return;
        report.suno_check = result;
      }
      refresh(n => n + 1);
      onChange?.();
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Check failed.");
    } finally {
      if (mounted.current) setBusy("");
    }
  }

  return <section className="soundtrack-section" aria-label="Soundtrack and vendor checks">
    <h3>Soundtrack</h3>
    <p className="muted small">Soundtrack checks cover track details, excerpt descriptions and credential findings. AI-origin detection from the sound itself is outside this workflow.</p>
    <div className="table-wrap audio-table-wrap responsive-report-wrap" role="region" aria-label="Audio evidence table" tabIndex={0}>
      <table className="report audio-table responsive-report" role="table" aria-label="Audio findings">
        <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Check</th><th scope="col" role="columnheader">Status</th><th scope="col" role="columnheader">Finding</th><th scope="col" role="columnheader">Evidence and scope</th></tr></thead>
        <tbody role="rowgroup">
          <tr role="row">
            <ReportCell label="Check"><div className="prov-name">Local soundtrack</div><div className="prov-model">Offline inspection</div></ReportCell>
            <ReportCell label="Status"><span className={`pill ${partial ? "pending" : localComplete ? "ok" : inspection?.status === "error" ? "error" : "unconfigured"}`}>
              {partial ? "Partial" : localComplete ? "Complete" : inspection?.status === "error" ? "Error" : "Unavailable"}</span></ReportCell>
            <ReportCell label="Finding">{inspection?.status === "present" ? `${inspection.stream_count} audio track(s)`
              : inspection?.status === "absent" ? "No audio track" : "Audio presence unknown"}</ReportCell>
            <ReportCell label="Evidence and scope" className="evidence">{inspection ? "Track details and audio levels in the sampled windows."
              : "Not recorded in this older report."}</ReportCell>
          </tr>
          <tr role="row">
            <ReportCell label="Check"><div className="prov-name">Google Gemini</div><div className="prov-model">{assessment?.model ?? "Optional audio content"}</div></ReportCell>
            <ReportCell label="Status"><span className={`pill ${assessment?.status ?? "unconfigured"}`}>{assessment?.status === "ok" ? "Complete"
              : assessment?.status === "error" ? "Error" : assessment ? "Unavailable" : "Not run"}</span></ReportCell>
            <ReportCell label="Finding">{assessment?.status === "ok" ? assessment.content_type : "Not assessed"}</ReportCell>
            <ReportCell label="Evidence and scope" className="evidence">{assessment?.status === "ok"
              ? <><span>Track {assessment.track_index}, {assessment.start_seconds}s + {assessment.duration_seconds}s. Checked {assessment.checked_at.slice(0, 10)}.</span>
                <ul>{assessment.observations.slice(0, 2).map((s, i) => <li key={i}>{s}</li>)}</ul></>
              : "Optional description of the selected excerpt."}</ReportCell>
          </tr>
          <tr role="row">
            <ReportCell label="Check"><div className="prov-name">Suno Credentials</div><div className="prov-model">Optional vendor service</div></ReportCell>
            <ReportCell label="Status"><span className={`pill ${suno?.status ?? "unconfigured"}`}>{suno?.status === "ok" ? "Complete"
              : suno ? "Error" : "Not run"}</span></ReportCell>
            <ReportCell label="Finding">{suno?.status === "ok" && suno.verdict ? sunoLabels[suno.verdict] : suno ? "No usable result" : "Not checked"}</ReportCell>
            <ReportCell label="Evidence and scope" className="evidence">Suno's credential finding for the submitted original file.</ReportCell>
          </tr>
          <tr role="row">
            <ReportCell label="Check"><div className="prov-name">Original-file C2PA</div><div className="prov-model">Local credentials</div></ReportCell>
            <ReportCell label="Status"><span className={`pill ${provenance?.status ?? "unconfigured"}`}>{provenance?.status === "ok" ? "Read"
              : provenance?.status ?? "Not run"}</span></ReportCell>
            <ReportCell label="Finding">Credential coverage of this audio track: unresolved</ReportCell>
            <ReportCell label="Evidence and scope" className="evidence">{provenance?.summary ?? "No original-file credential result recorded."}</ReportCell>
          </tr>
        </tbody>
      </table>
    </div>
    {inspection && <details className="audio-details">
      <summary>Track and sampling details</summary>
      {inspection.tracks.map(t => <div className="audio-track" key={t.index}>
        <strong>Track {t.index}</strong>: {t.codec}, {t.channels} channel(s), {t.sample_rate} Hz
        {t.duration_seconds != null && <>, {t.duration_seconds.toFixed(1)}s</>}
        <p className="small">Decoding: {t.decode_status}. Signal above -60 dBFS in {t.samples.filter(s => s.signal_above_minus_60_dbfs).length}/{t.samples.length} sampled windows after mono downmix.</p>
        <p className="muted small">{t.samples.map(s => `${s.start_seconds}s + ${s.duration_seconds}s`).join("; ")}</p>
      </div>)}
      <p className="muted small">{inspection.provenance_scope}</p>
      {inspection.notes.map((note, i) => <p className="muted small" key={i}>{note}</p>)}
    </details>}

    {file && hash && <details className="audio-actions">
      <summary>Optional checks</summary>
    {file && hash && inspection?.tracks.length ? <div className="audio-controls">
      <h4>Excerpt description</h4>
      <div className="audio-selection">
        <label>Track <select aria-label="Audio track" value={track} disabled={Boolean(busy)} onChange={e => {
          setTrack(Number(e.target.value)); setGoogleConsent(false);
        }}>{inspection.tracks.map(t => <option key={t.index} value={t.index}>Track {t.index}</option>)}</select></label>
        <label>Start (seconds) <input type="number" aria-label="Audio excerpt start" min="0" step="1" value={start}
          disabled={Boolean(busy)} onChange={e => { setStart(e.target.value); setGoogleConsent(false); }} /></label>
      </div>
      <label className="audio-consent"><input type="checkbox" checked={googleConsent} disabled={Boolean(busy)}
        onChange={e => setGoogleConsent(e.target.checked)} />
        I agree to send up to 20 seconds of the selected track to Google Gemini for a content description, using my configured API account. Provider terms and charges apply.</label>
      <button className="ghost" disabled={!googleConsent || Boolean(busy) || !validStart} onClick={() => run("audio")}>
        {busy === "audio" ? "Assessing excerpt..." : "Assess audio excerpt"}</button>
    </div> : null}

    <h4>Suno credentials check</h4>
      <label className="audio-consent"><input type="checkbox" checked={sunoConsent} disabled={Boolean(busy) || file.size > 100_000_000}
        onChange={e => setSunoConsent(e.target.checked)} />
        I agree to send the complete original file, including any video, audio and embedded metadata, to Suno for a credential check. Suno's terms apply.</label>
      {file.size > 100_000_000 && <p className="muted small">Above Suno's documented 100 MB limit; upload disabled.</p>}
      <button className="ghost" disabled={!sunoConsent || Boolean(busy) || file.size > 100_000_000} onClick={() => run("suno")}>
        {busy === "suno" ? "Checking with Suno..." : "Check original with Suno"}</button>
    </details>}

    {assessment && <details className="audio-observation">
      <summary>Full excerpt description</summary>
      <a href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(assessment, null, 2))}`} download="podcast-sound-check.json">Download this sound-check record (JSON)</a>
      <p>{assessment.provider} ({assessment.model}): {assessment.status}; {assessment.content_type}.</p>
      <p className="small">Track {assessment.track_index}, {assessment.start_seconds}s + {assessment.duration_seconds}s; {assessment.checked_at}</p>
      <ul>{assessment.observations.map((s, i) => <li key={i}>{s}</li>)}</ul>
      {assessment.transcript_excerpt && <p>{assessment.transcript_excerpt}</p>}
      {assessment.limitations.map((s, i) => <p className="muted small" key={i}>{s}</p>)}
    </details>}

    {suno && <details className="audio-observation">
      <summary>Suno check details</summary>
      <p className="small">{suno.checked_at}{suno.http_status != null && `; HTTP ${suno.http_status}`}</p>
      <p className="muted small">{suno.note}</p>
    </details>}
    <p className="muted small">Audio findings are shown alongside the content assessment and remain separate from its score.</p>
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
