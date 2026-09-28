import { SHOWCASE, CONFERENCE } from "../showcase";
import SessionDownloads from "./SessionDownloads";
import { useEffect, useRef, useState } from "react";
import type { Report } from "../types";
import { getDiffusion } from "../api";
import { assessmentTitle, textAssessment } from "../community";
import { imageThumb, verdictLabel } from "../lib";
import Results from "./Results";

export interface BatchRow {
  name: string;
  file?: File;
  url?: string;
  report?: Report;
  error?: string;
}

export default function BatchResults({ rows, total, onNotesChange, scrollRequest = 0 }:
  { rows: BatchRow[]; total: number; onNotesChange?: () => void; scrollRequest?: number }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!scrollRequest) return;
    const behavior = "instant" as const;
    heading.current?.focus({ preventScroll: true });
    // On stacked layouts the results follow the queue, so bring them directly
    // into view. Wider layouts show them beside the media near the page top.
    if (window.matchMedia("(max-width: 900px)").matches) heading.current?.scrollIntoView({ block: "start", behavior });
    else window.scrollTo({ top: 0, behavior });
  }, [scrollRequest]);
  const [open, setOpen] = useState<number | null>(null);
  const done = rows.filter((r): r is BatchRow & { report: Report } => Boolean(r.report));

  async function exportBatch(fmt: "csv" | "md" | "pptx" | "pdf") {
    const withImages = fmt === "pptx" || fmt === "pdf";
    const items = await Promise.all(
      done.map(async (r) => ({
        report: r.report,
        image: withImages ? (await imageThumb(r.url)) ?? r.report.meta.thumbnail ?? null : null,
      })),
    );
    const res = await fetch(`/api/export/batch/${fmt}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) return;
    trigger(URL.createObjectURL(await res.blob()), `sda-vision-batch.${fmt}`);
  }

  async function exportJson() {
    // Lossless record: every full report plus the batch relationship graph
    // (same data the diffusion panel shows), so JSON matches the web view.
    const reports = done.map((r) => r.report);
    let graph = null;
    if (reports.length) {
      try {
        graph = await getDiffusion({ source: reports.length === 1 ? "item" : "batch",
          threshold: 10, edge_mode: "attributes", reports });
      } catch {
        graph = null; // graph is a bonus; never block the export on it
      }
    }
    const blob = new Blob(
      [JSON.stringify({ reports, relationship_graph: graph }, null, 2)],
      { type: "application/json" },
    );
    trigger(URL.createObjectURL(blob), "sda-vision-batch.json");
  }

  function trigger(href: string, name: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <section className="panel results-panel">
      <div className="consensus">
        <h2 ref={heading} tabIndex={-1}>Batch results</h2>
        <p className="expl">
          {rows.length} of {total} batch entries processed this session: {done.length} results, {rows.filter(r => r.error).length} errors (results accumulate across batches).
          {!SHOWCASE && !CONFERENCE && <> Reports are saved to <code>dev_runs/</code>.</>} Click a row for its findings, notes and downloads.
        </p>
        {rows.length >= total && total > 0 && (
          <p className="batch-next">
            {SHOWCASE ? "Open another saved batch" : "Run another batch"}: in the queue, completed files are greyed out - tick up to 5 of the
            remaining files, or add examples from the list. {SHOWCASE ? "For one result the graph shows its recorded map; with multiple results it shows the full cached example set, separately from your selected batch. New session notes are not part of that prepared graph." : "The graph shows one item's map or relationships between the batch results."}
          </p>
        )}
        {SHOWCASE && done.length > 0 && <SessionDownloads reports={done.map(row => row.report)} />}
        {!SHOWCASE && done.length > 0 && (
          <div className="extra-actions" style={{ marginTop: "0.6rem" }}>
            <span className="muted small" style={{ alignSelf: "center" }}>Export all ({done.length}):</span>
            <button className="ghost" onClick={() => exportBatch("csv")}>CSV</button>
            <button className="ghost" onClick={() => exportBatch("md")}>Markdown</button>
            <button className="ghost" onClick={() => exportBatch("pptx")}>PPTX</button>
            <button className="ghost" onClick={() => exportBatch("pdf")}>PDF</button>
            <button className="ghost" onClick={exportJson}>JSON</button>
          </div>
        )}
      </div>

      <div className="batch-rows">
        {rows.length === 0 && <p className="muted small">{SHOWCASE ? "Opening saved results…" : "Running checks…"}</p>}
        {rows.map((r, i) => (
          <div key={i} className="batch-item">
            <button aria-expanded={open === i} className="batch-item-head" onClick={() => setOpen(open === i ? null : i)}>
              {r.report?.meta.thumbnail || r.url
                ? <img className="qthumb" src={r.report?.meta.thumbnail || r.url} alt="" />
                : <span className="qthumb qtype">?</span>}
              <span className="qname" title={r.name}>{r.name}</span>
              {r.error ? (
                // Its own grey badge - an error must never wear the red
                // synthetic pill a skimmer scans the column for.
                <span className="verdict not_applicable">error</span>
              ) : r.report ? (
                <>
                  <span className={`verdict ${textAssessment(r.report) ? "transcript-reading" : r.report.consensus.overall_verdict}`}>
                    {textAssessment(r.report) ? assessmentTitle(r.report) : verdictLabel(r.report.consensus.overall_verdict)}
                  </span>
                  <span className="muted small batch-meta">
                    {textAssessment(r.report) ? "Text rating: " : "Rating: "}{r.report.consensus.overall_rating ?? "not recorded"} / 100
                  </span>
                </>
              ) : (
                <span className="muted small">analysing...</span>
              )}
              <span className="batch-caret">{open === i ? "▾" : "▸"}</span>
            </button>
            {open === i && r.report && (
              <div className="batch-detail">
                <Results report={r.report} previewName={r.name} imageUrl={r.url}
                  demo={SHOWCASE} sourceFile={CONFERENCE ? undefined : r.file} onNotesChange={onNotesChange} />
              </div>
            )}
            {open === i && r.error && <p className="muted small batch-detail">{r.error}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
