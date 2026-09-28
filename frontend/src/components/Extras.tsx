import { citationRows } from "../citation";
import SessionDownloads from "./SessionDownloads";
import type { Report } from "../types";
import { imageThumb, verdictLabel, visibleTextLabel } from "../lib";
import { SHOWCASE, showcaseExportUrl } from "../showcase";

// Tri-state fresh-session attestation label. Absent renders as "not attested",
// never as "stale" and never as "fresh" (mirrors the backend _fresh_label).
function freshLabel(v?: boolean): string {
  if (v === true) return "fresh session (attested)";
  if (v === false) return "not a fresh session (researcher stated)";
  return "not attested";
}

export default function Extras(
  { report, imageUrl, gemini, chatgpt, geminiFresh, chatgptFresh, compact = false }:
    { report: Report; imageUrl?: string; gemini?: string; chatgpt?: string;
      geminiFresh?: boolean; chatgptFresh?: boolean; compact?: boolean },
) {
  const { consensus, meta } = report;
  type Note = { label: string; text: string; read?: string; score?: number; fresh?: boolean };
  const notes: Note[] = [
    {
      label: "Gemini SynthID",
      text: ((SHOWCASE ? report.second_opinion_gemini : gemini ?? report.second_opinion_gemini) ?? "").trim(),
      read: report.second_opinion_gemini_read,
      score: report.second_opinion_gemini_score,
      fresh: SHOWCASE ? report.second_opinion_gemini_fresh_session : geminiFresh ?? report.second_opinion_gemini_fresh_session,
    },
    {
      label: "OpenAI second opinion",
      text: ((SHOWCASE ? report.second_opinion_chatgpt : chatgpt ?? report.second_opinion_chatgpt) ?? "").trim(),
      read: report.second_opinion_chatgpt_read,
      score: report.second_opinion_chatgpt_score,
      fresh: SHOWCASE ? report.second_opinion_chatgpt_fresh_session : chatgptFresh ?? report.second_opinion_chatgpt_fresh_session,
    },
  ].filter((n) => n.text);

  const citation = <div className="citation">
    {citationRows(meta).map(([label, text]) => <p className="cite-text" key={label}><strong>{label}: </strong>{text}</p>)}
    <p className="cite-text">{meta.kind === "video" ? "Sampled visual verdict" : meta.kind === "audio" ? "Transcript-content verdict" : "Recorded verdict"}: {verdictLabel(consensus.overall_verdict)} (confidence {consensus.confidence}). {consensus.disclaimer || "Research assessment. Review alongside source information and context."}</p>
  </div>;

  function trigger(href: string, name: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
    URL.revokeObjectURL(href);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    trigger(URL.createObjectURL(blob), `sda-vision-${(meta.filename || "report").replace(/\W+/g, "_")}.json`);
  }

  async function exportAs(fmt: "md" | "csv" | "pptx" | "pdf") {
    const safeName = `sda-vision-${(meta.filename || "report").replace(/\W+/g, "_")}.${fmt}`;
    if (SHOWCASE) {
      // Static build: serve the file pre-baked by the same server-side
      // builders the full tool uses, so the download is identical.
      try {
        trigger(await showcaseExportUrl(meta.filename, fmt), safeName);
      } catch { /* record not in the showcase set */ }
      return;
    }
    // Canvas thumbnails only work for image files; documents and audio fall
    // back to the report's own visual (first frame / cover art / waveform).
    const image = fmt === "pptx" || fmt === "pdf"
      ? (await imageThumb(imageUrl)) ?? report.meta.thumbnail ?? null
      : null;
    const res = await fetch(`/api/export/${fmt}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ report, image }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const dispo = res.headers.get("Content-Disposition") || "";
    const match = /filename="([^"]+)"/.exec(dispo);
    trigger(URL.createObjectURL(blob), match ? match[1] : `sda-vision-report.${fmt}`);
  }

  return (
    <div className="extras">
      {SHOWCASE && <SessionDownloads reports={[report]} />}
      {!compact && <div className="extra-block">
        <h3>{visibleTextLabel(meta.kind)}</h3>
        <p className="mono">{consensus.visible_text || "(none detected)"}</p>
      </div>}

      {!compact && notes.length > 0 && (
        <div className="extra-block">
          <h3>Second-opinion notes</h3>
          {notes.map((n) => (
            <div key={n.label} className="so-note">
              <strong>{n.label}</strong>
              {(n.read || n.score != null) && (
                <div className="so-read">
                  Read: {n.read || "(no clear view)"}
                  {n.score != null && <> &middot; synthetic score ~{n.score}/100</>}
                </div>
              )}
              <div className="so-read">Session: {freshLabel(n.fresh)}</div>
              <p className="mono">{n.text}</p>
            </div>
          ))}
          <small className="muted">Session details record the researcher's account of how the note was
            obtained. They are retained for audit and excluded from automated corroboration.</small>
        </div>
      )}

      {!compact && consensus.vaccine_codes.length > 0 && (
        <div className="extra-block">
          <h3>Vaccine research codes</h3>
          <div className="tags">
            {consensus.vaccine_codes.map((c) => <span key={c} className="tag">{c}</span>)}
          </div>
        </div>
      )}

      {compact ? <details className="extra-block">
        <summary>Cite this analysis</summary>
        {citation}
      </details> : <div className="extra-block">
        <h3>Cite this analysis</h3>
        {citation}
      </div>}

      <div className="extra-block">
        <h3>{SHOWCASE ? "Download original recorded report" : "Export"}</h3>
        <div className="extra-actions">
          <button className="ghost" onClick={downloadJson}>JSON</button>
          <button className="ghost" onClick={() => exportAs("md")}>Markdown</button>
          <button className="ghost" onClick={() => exportAs("csv")}>CSV</button>
          <button className="ghost" onClick={() => exportAs("pptx")}>PPTX</button>
          <button className="ghost" onClick={() => exportAs("pdf")}>PDF</button>
        </div>
        {SHOWCASE && <p className="muted small">These prepared downloads contain the original recorded report. Use the session downloads above to include your newly pasted replies.</p>}
      </div>
    </div>
  );
}
