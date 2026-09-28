import { useEffect, useRef, useState } from "react";
import {
  downloadDiffusionCsv, downloadDiffusionGexf, downloadDiffusionPng, getDiffusion,
  getDiffusionSummary, type DiffusionPayload, type DiffusionSummary,
} from "../api";
import type { GraphData, Report } from "../types";
import { imageThumb } from "../lib";
import { SHOWCASE, CONFERENCE } from "../showcase";
import GraphView, { type ColourBy } from "./GraphView";

export interface BatchItem {
  report: Report;
  url?: string;
}

type Tier = "headline" | "caption" | "paragraph";
const TIER_LABEL: Record<Tier, string> = {
  headline: "Headline", caption: "Caption", paragraph: "Short paragraph",
};

export default function DiffusionPanel(
  { batchItems, demo = false, currentReport = null, currentUrl, notesRevision = 0 }:
    { batchItems: BatchItem[]; demo?: boolean; currentReport?: Report | null;
      currentUrl?: string; notesRevision?: number },
) {
  const hasBatch = !demo && batchItems.length > 0;
  const batchVersion = JSON.stringify(batchItems.map(({ report }) => [
    report.meta.report_id, report.meta.filename, report.meta.generated_at,
  ]));
  const [source, setSource] = useState(demo ? "example" : hasBatch ? "batch" : "example");
  const [edgeMode, setEdgeMode] = useState("attributes");
  const [threshold, setThreshold] = useState(10);
  const [includeIsolated, setIncludeIsolated] = useState(true);
  // Owned here (not in GraphView) so the PNG download uses the same colour
  // mode the researcher is looking at on screen.
  const [colourBy, setColourBy] = useState<ColourBy>("verdict");
  const [data, setData] = useState<GraphData | null>(null);
  // Downloads and the summary must describe the graph ON SCREEN, so they use
  // the payload snapshotted when it was built - never the live control values
  // (changing Source/Edges without rebuilding must not change what downloads).
  const built = useRef<{ source: string; payload: DiffusionPayload } | null>(null);
  const generation = useRef(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [story, setStory] = useState<DiffusionSummary | null>(null);
  const [storyErr, setStoryErr] = useState("");
  const [tier, setTier] = useState<Tier>("caption");
  const [storyLoading, setStoryLoading] = useState(false);
  const storyRequested = useRef(false);
  const seenNotesRevision = useRef(notesRevision);

  // For the "Current batch" source, send this session's reports to the server,
  // attaching a small thumbnail per image so the graph nodes stay identifiable.
  async function payloadFor(s: string): Promise<DiffusionPayload> {
    const p: DiffusionPayload = { source: s, threshold, edge_mode: edgeMode,
      min_component: includeIsolated ? 1 : 2 };
    if (s === "item" && currentReport) {
      const b64 = currentUrl ? await imageThumb(currentUrl, 140).catch(() => null) : null;
      p.reports = [{
        ...currentReport,
        meta: {
          ...currentReport.meta,
          thumbnail: b64 ? `data:image/jpeg;base64,${b64}` : currentReport.meta.thumbnail,
        },
      } as Report];
      p.itemName = currentReport.meta.filename;
    }
    if (s === "batch") {
      p.reports = await Promise.all(batchItems.map(async (it) => {
        // imageThumb returns bare base64; the graph <img> needs a full data URL.
        // Documents/audio fall back to the report's own visual.
        const b64 = it.url ? await imageThumb(it.url, 140).catch(() => null) : null;
        return {
          ...it.report,
          meta: {
            ...it.report.meta,
            thumbnail: b64 ? `data:image/jpeg;base64,${b64}` : it.report.meta.thumbnail,
          },
        };
      }));
    }
    return p;
  }

  async function build(s = source, refreshStory = false) {
    const request = ++generation.current;
    setLoading(true);
    setStoryLoading(false);
    setData(null);
    built.current = null;
    setErr("");
    setStory(null);
    setStoryErr("");
    try {
      const payload = await payloadFor(s);
      if (request !== generation.current) return;
      const graph = await getDiffusion(payload);
      if (request !== generation.current) return;
      setData(graph);
      built.current = { source: s, payload };
      if (refreshStory) {
        setStoryLoading(true);
        try {
          const summary = await getDiffusionSummary(payload);
          if (request === generation.current) setStory(summary);
        } catch (e) {
          if (request === generation.current) setStoryErr(e instanceof Error ? e.message : "Could not write the summary.");
        } finally {
          if (request === generation.current) setStoryLoading(false);
        }
      }
    } catch (e) {
      if (request !== generation.current) return;
      setErr(e instanceof Error ? e.message : "Could not build graph.");
      setData(null);
      built.current = null;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }

  async function tellStory() {
    if (!built.current) return;
    storyRequested.current = true;
    const request = generation.current;
    setStoryLoading(true);
    setStoryErr("");
    try {
      const summary = await getDiffusionSummary(built.current.payload);
      if (request === generation.current) setStory(summary);
    } catch (e) {
      if (request !== generation.current) return;
      setStory(null);
      setStoryErr(e instanceof Error ? e.message : "Could not write the summary.");
    } finally {
      if (request === generation.current) setStoryLoading(false);
    }
  }

  async function downloadGexf() {
    if (!built.current) return;
    try {
      await downloadDiffusionGexf(built.current.payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not export GEXF.");
    }
  }

  async function downloadCsv() {
    if (!built.current) return;
    try {
      await downloadDiffusionCsv(built.current.payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not export CSV.");
    }
  }

  async function downloadPng() {
    if (!built.current) return;
    try {
      await downloadDiffusionPng({ ...built.current.payload, colour_by: colourBy });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not export PNG.");
    }
  }

  function copyStory() {
    if (story) navigator.clipboard?.writeText(story[tier]);
  }

  // A one-file batch is an item analysis, not a relationship between images.
  // One effect owns input changes so a second effect cannot cancel its rebuild.
  useEffect(() => {
    const next = hasBatch && batchItems.length > 1 ? "batch" : currentReport ? "item" : "example";
    storyRequested.current = false;
    setSource(next);
    build(next);
    return () => { generation.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentReport, batchVersion, demo]);

  // Notes live on the held report. Invalidate immediately, then rebuild after
  // typing settles; an already-requested caption follows the same new snapshot.
  useEffect(() => {
    const changed = seenNotesRevision.current !== notesRevision;
    seenNotesRevision.current = notesRevision;
    if (!changed || (source !== "item" && source !== "batch")) return;
    generation.current += 1;
    setLoading(false);
    setStoryLoading(false);
    setData(null);
    built.current = null;
    setStory(null);
    setErr("");
    setStoryErr("");
    const timer = window.setTimeout(() => build(source, storyRequested.current), 250);
    return () => { window.clearTimeout(timer); generation.current += 1; };
    // Input identity also cancels any pending note rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesRevision, currentReport, batchVersion, demo]);

  return (
    <section className="panel diffusion-panel">
      <div className="diffusion-head">
        <h2>Diffusion graph {demo ? <span className="dev-badge demo-badge">DEMO</span> : <span className="dev-badge">DEV</span>}</h2>
        <p className="muted small">
          {source === "item" ? (
            <>A map of relationships within this analysis: the media sits at the centre, joined to every
            signal that assessed it (vision models, C2PA, forensics, and any pasted second
            opinions). Audio and vendor observations are unscored context, joined by dashed links.
            Links between scored signals mark <strong>agreeing verdicts</strong>; size =
            synthetic rating; recolour by verdict or provider.</>
          ) : (
            <>How analysed images relate. <strong>Variants</strong> links near-duplicate images
            (perceptual hash); <strong>Similarity</strong> links images by shared verdict and synthetic
            rating - useful when items are not pixel copies. Node size = synthetic rating.
            {demo && !SHOWCASE && " This is an illustrative example - explore the nodes, recolour, and download the GEXF to see how the real graph works."}
            {demo && SHOWCASE && " This is the full cached example set, separate from any selected batch. It includes recorded notes only; newly pasted session replies are in your session downloads."}</>
          )}
          {" "}Distribution history: not assessed.
        </p>
      </div>

      <div className="diffusion-controls">
        {demo ? (
          <label>
            <span>Source</span>
            <select value={currentReport ? source : "example"}
              onChange={(e) => setSource(e.target.value)}
              disabled={!currentReport}>
              {currentReport && <option value="item">Current item (verdict map)</option>}
              <option value="example">{SHOWCASE ? "Cached example set" : "Illustrative sample"}</option>
            </select>
          </label>
        ) : (
          <label>
            <span>Source</span>
            <select value={source}
              onChange={(e) => setSource(e.target.value)}>
              {currentReport && <option value="item">Current item (verdict map)</option>}
              <option value="batch">Current batch</option>
              {!CONFERENCE && <option value="corpus">Corpus sample</option>}
              <option value="example">Illustrative sample</option>
            </select>
          </label>
        )}
        {!demo && source !== "item" && (
        <label>
          <span>Edges</span>
          <select value={edgeMode} onChange={(e) => setEdgeMode(e.target.value)}>
            <option value="attributes">Similarity (verdict + rating)</option>
            <option value="variants">Variants (perceptual hash)</option>
          </select>
        </label>
        )}
        {!demo && source !== "item" && edgeMode === "variants" && (
          <label>
            <span>pHash threshold: {threshold}</span>
            <input type="range" min={4} max={20} value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))} />
          </label>
        )}
        <button className="primary" onClick={() => build()} disabled={loading || (source === "item" && !currentReport)}>
          {loading ? "Building..." : "Build graph"}
        </button>
        {!demo && source !== "item" && (
          <label><input type="checkbox" checked={includeIsolated} disabled={loading}
            onChange={e => setIncludeIsolated(e.target.checked)} /> Include isolated items</label>
        )}
        {data && data.nodes.length > 0 && (
          <>
            <button className="ghost" onClick={downloadPng} disabled={loading}>Download PNG</button>
            <button className="ghost" onClick={downloadGexf} disabled={loading}>Download GEXF</button>
            <button className="ghost" onClick={downloadCsv} disabled={loading}>Download CSV</button>
            <button className="ghost" onClick={tellStory} disabled={storyLoading || loading}>
              {storyLoading ? "Writing..." : story ? "Refresh summary" : "Plain-English summary"}
            </button>
          </>
        )}
      </div>
      {built.current && !loading && built.current.source !== source && (
        <p className="muted small">
          Showing the previously built graph - press Build graph to switch to the selected source.
          Downloads and the summary describe the graph on screen.
        </p>
      )}

      {source === "item" && !currentReport && (
        <p className="muted small">Run an analysis first, then build its verdict map.</p>
      )}
      {source === "batch" && !hasBatch && (
        <p className="muted small">
          No current batch yet. Run a batch in the queue above, then build the graph.
        </p>
      )}
      {err && <p className="muted small">{err}</p>}
      {storyErr && <p className="muted small">{storyErr}</p>}
      {story && (
        <div className="graph-story">
          <div className="graph-story-head">
            <h3>What this shows</h3>
            <div className="story-tiers" role="tablist">
              {(Object.keys(TIER_LABEL) as Tier[]).map((k) => (
                <button key={k} className={`tier ${tier === k ? "active" : ""}`}
                  onClick={() => setTier(k)}>{TIER_LABEL[k]}</button>
              ))}
              <button className="ghost small-btn" onClick={copyStory}>Copy</button>
            </div>
          </div>
          <p>{story[tier]}</p>
        </div>
      )}
      {data && (
        <>
          {data.population && <p className="muted small">
            Displayed {data.population.displayed_items} of {data.population.eligible_items} eligible
            {" "}({data.population.source_items} source items). Excluded:
            {" "}{data.population.excluded_unsupported} non-image,
            {" "}{data.population.excluded_unreadable} unreadable,
            {" "}{data.population.excluded_duplicates} duplicate,
            {" "}{data.population.excluded_by_filter} filtered.
            {" "}Isolated shown: {data.population.isolated_displayed}.
          </p>}
          <p className="muted small">
            {data.stats.nodes} nodes, {data.stats.edges} edges, {data.stats.clusters} cluster(s),
            largest {data.stats.largest_cluster}.
          </p>
          {data.nodes.length ? (
            <GraphView data={data} colourBy={colourBy} onColourByChange={setColourBy} />
          ) : (
            <p className="muted small">
              No items for this source yet. Run a batch, or pick another source.
            </p>
          )}
        </>
      )}
    </section>
  );
}
