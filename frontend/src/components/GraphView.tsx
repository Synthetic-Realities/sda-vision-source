import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphData, GraphNode } from "../types";
import { COMMUNITY_PALETTE, verdictLabel } from "../lib";

const W = 1000;
const H = 640;
const M = 40;

const VERDICT_HEX: Record<string, string> = {
  synthetic_likely: "#ef5b5b", partially_synthetic: "#d98324",
  authentic_likely: "#2fbf71", inconclusive: "#8d9bb0", not_applicable: "#8d9bb0",
};
const PROVIDER_HEX: Record<string, string> = {
  claude: "#d98324", openai: "#2fbf71", gemini: "#4f8cff",
};
const PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude", openai: "OpenAI", gemini: "Gemini",
};
const GREY = "#8d9bb0";
// The analysed item at the centre of a verdict map gets its own colour in every
// mode, so the source is never confused with the signals assessing it.
const ITEM_HEX = "#b07ce8";
const OBSERVATION_HEX = "#1b878a";
// Same wording as the provider table's Verdict column, so the legend and the
// table never disagree.
const VERDICT_LEGEND: [string, string][] = [
  ["Synthetic likely", VERDICT_HEX.synthetic_likely],
  ["Partially synthetic", VERDICT_HEX.partially_synthetic],
  ["Authentic likely", VERDICT_HEX.authentic_likely],
  ["Inconclusive", VERDICT_HEX.inconclusive],
];
// Rating bands surface the raw synthetic-rating nuance even when the verdict
// stays cautious (e.g. a high rating that the override logic held at
// "inconclusive"). Cut points mirror the pipeline's vote thresholds (30 / 60).
const RATING_BANDS: { min: number; label: string; colour: string }[] = [
  { min: 60, label: "High (60-100)", colour: "#ef5b5b" },
  { min: 30, label: "Medium (30-59)", colour: "#d98324" },
  { min: 0, label: "Low (0-29)", colour: "#2fbf71" },
];
function ratingColour(rating: number | null): string {
  if (rating == null) return GREY;
  return (RATING_BANDS.find((b) => rating >= b.min) ?? RATING_BANDS[RATING_BANDS.length - 1]).colour;
}
export type ColourBy = "rating" | "verdict" | "community" | "provider";

type XY = { x: number; y: number };

export default function GraphView(
  { data, colourBy: colourByProp, onColourByChange }:
    { data: GraphData; colourBy?: ColourBy; onColourByChange?: (c: ColourBy) => void },
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pos, setPos] = useState<Record<string, XY>>({});
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<GraphNode | null>(null);
  const [pinned, setPinned] = useState<GraphNode | null>(null);
  // Labels default on for small graphs (verdict maps, the example set); large
  // corpus graphs start unlabelled to stay readable.
  const [showLabels, setShowLabels] = useState(data.nodes.length <= 12);
  // Colour mode can be owned by the parent (so PNG downloads match the screen);
  // uncontrolled use falls back to local state.
  const [colourByState, setColourByState] = useState<ColourBy>("verdict");
  const colourBy = colourByProp ?? colourByState;
  function setColourBy(c: ColourBy) {
    setColourByState(c);
    onColourByChange?.(c);
  }
  // The info panel shows the hovered node if any, otherwise the pinned one.
  const shown = hover ?? pinned;

  function nodeColour(n: GraphNode): string {
    if (n.source === "observation") return OBSERVATION_HEX;
    if (n.source === "item") return ITEM_HEX;
    if (colourBy === "rating") return ratingColour(n.rating);
    if (colourBy === "verdict") return VERDICT_HEX[n.verdict || ""] || GREY;
    if (colourBy === "provider") return PROVIDER_HEX[n.provider || ""] || GREY;
    return COMMUNITY_PALETTE[(n.community ?? 0) % COMMUNITY_PALETTE.length];
  }
  // Size by synthetic rating (bigger = more synthetic); the quadratic curve
  // keeps high ratings visibly apart (72 vs 92 must not look the same).
  function nodeRadius(n: GraphNode): number {
    if (n.source === "observation") return 9;
    if (n.rating != null) return 6 + Math.pow(n.rating / 100, 2) * 24;
    return 7 + (n.degree / maxDeg) * 10;
  }
  const drag = useRef<{ node: string | null; pan: boolean; last: XY }>({ node: null, pan: false, last: { x: 0, y: 0 } });
  const moved = useRef(false);

  useEffect(() => {
    const p: Record<string, XY> = {};
    for (const n of data.nodes) p[n.id] = { x: M + n.x * (W - 2 * M), y: M + n.y * (H - 2 * M) };
    setPos(p);
    setT({ k: 1, x: 0, y: 0 });
    setShowLabels(data.nodes.length <= 12);
    // Never carry a hovered/pinned node over from a previous graph - its
    // details panel would show stale data from the last analysis.
    setHover(null);
    setPinned(null);
  }, [data]);

  const maxDeg = useMemo(() => Math.max(1, ...data.nodes.map((n) => n.degree)), [data]);
  const byId = useMemo(() => Object.fromEntries(data.nodes.map((n) => [n.id, n])), [data]);

  // Legend entries for the active colour-by mode (only what the data uses).
  const legend = useMemo<[string, string][]>(() => {
    const itemEntry: [string, string][] =
      data.nodes.some((n) => n.source === "item") ? [["Analysed item", ITEM_HEX]] : [];
    if (data.nodes.some(n => n.source === "observation")) itemEntry.push(["Audio / vendor observation (unscored)", OBSERVATION_HEX]);
    const scored = data.nodes.filter(n => n.source !== "observation" && n.source !== "item");
    if (colourBy === "rating") {
      const present = scored.map((n) => ratingColour(n.rating));
      const out: [string, string][] = [];
      for (const b of RATING_BANDS) if (present.includes(b.colour)) out.push([b.label, b.colour]);
      if (present.includes(GREY)) out.push(["No rating", GREY]);
      return [...itemEntry, ...out];
    }
    if (colourBy === "verdict") {
      const present = new Set(scored.map((n) => n.verdict || "inconclusive"));
      return [...itemEntry, ...VERDICT_LEGEND.filter(([, hex]) =>
        [...present].some((v) => (VERDICT_HEX[v] || GREY) === hex))];
    }
    if (colourBy === "provider") {
      const present = new Set(scored.map((n) => n.provider || "none"));
      const out: [string, string][] = [];
      for (const id of ["claude", "openai", "gemini"]) {
        if (present.has(id)) out.push([PROVIDER_LABEL[id], PROVIDER_HEX[id]]);
      }
      if (present.has("none")) out.push(["No clear lead", GREY]);
      return [...itemEntry, ...out];
    }
    const ids = [...new Set(scored.map((n) => n.community ?? 0))].sort((a, b) => a - b);
    return [...itemEntry,
      ...ids.map((id): [string, string] => [`Cluster ${id}`, COMMUNITY_PALETTE[id % COMMUNITY_PALETTE.length]])];
  }, [colourBy, data]);

  function svgXY(clientX: number, clientY: number): XY {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }
  function toGraph(s: XY): XY {
    return { x: (s.x - t.x) / t.k, y: (s.y - t.y) / t.k };
  }

  // Non-passive wheel listener so we can preventDefault page scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = svgXY(e.clientX, e.clientY);
      const g = toGraph(s);
      const k = Math.min(5, Math.max(0.3, t.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      setT({ k, x: s.x - g.x * k, y: s.y - g.y * k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [t]);

  function onDownNode(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    moved.current = false;
    drag.current = { node: id, pan: false, last: svgXY(e.clientX, e.clientY) };
  }
  function onDownBg(e: React.PointerEvent) {
    drag.current = { node: null, pan: true, last: svgXY(e.clientX, e.clientY) };
  }
  function onMove(e: React.PointerEvent) {
    const now = svgXY(e.clientX, e.clientY);
    const d = drag.current;
    if (d.node) {
      if (Math.hypot(now.x - d.last.x, now.y - d.last.y) > 3) moved.current = true;
      const g = toGraph(now);
      setPos((p) => ({ ...p, [d.node!]: g }));
    } else if (d.pan) {
      setT((tt) => ({ ...tt, x: tt.x + (now.x - d.last.x), y: tt.y + (now.y - d.last.y) }));
      d.last = now;
    }
  }
  function onUp() {
    drag.current = { node: null, pan: false, last: { x: 0, y: 0 } };
  }
  // A click that did not turn into a drag pins the node so its details stay put.
  function onClickNode(e: React.MouseEvent, n: GraphNode) {
    e.stopPropagation();
    if (moved.current) return; // it was a drag, not a click
    setPinned((prev) => (prev?.id === n.id ? null : n));
  }

  return (
    <div className="graph-wrap">
      <svg
        ref={svgRef}
        className="graph-svg"
        viewBox={`0 0 ${W} ${H}`}
        onPointerDown={onDownBg}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onClick={() => setPinned(null)}
      >
        <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
          {data.edges.map((e, i) => {
            const a = pos[e.source];
            const b = pos[e.target];
            if (!a || !b) return null;
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={e.variant_type === "observation" ? OBSERVATION_HEX : `rgba(120,140,180,${0.25 + e.weight * 0.6})`}
                strokeDasharray={e.variant_type === "observation" ? "6 5" : undefined}
                strokeWidth={1 + e.weight * 4} />
            );
          })}
          {data.nodes.map((n) => {
            const p = pos[n.id];
            if (!p) return null;
            const r = nodeRadius(n);
            const col = nodeColour(n);
            const on = hover?.id === n.id;
            const isPinned = pinned?.id === n.id;
            const lit = on || isPinned;
            const labelOnLeft = p.x > W / 2;
            const label = n.label.length > 48 ? n.label.slice(0, 45) + "..." : n.label;
            return (
              <g key={n.id}>
                <circle cx={p.x} cy={p.y} r={r} fill={col}
                  role="button" tabIndex={0} aria-label={n.label}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault(); setPinned(prev => prev?.id === n.id ? null : n);
                  } }}
                  strokeWidth={lit ? 3 : 1.5}
                  // Chrome colours via CSS vars so outlines/labels follow the
                  // theme (vars are not valid in SVG presentation attributes,
                  // hence the style prop). Node fills stay theme-invariant.
                  style={{ cursor: "grab", stroke: on ? "var(--graph-lit)" : isPinned ? "var(--graph-pin)" : "var(--graph-bg)" }}
                  onPointerDown={(e) => onDownNode(e, n.id)}
                  onClick={(e) => onClickNode(e, n)}
                  onPointerEnter={() => setHover(n)}
                  onPointerLeave={() => setHover((h) => (h?.id === n.id ? null : h))} />
                {(lit || showLabels) && (
                  <text x={labelOnLeft ? p.x - r - 4 : p.x + r + 4} y={p.y + 4} fontSize={12}
                    textAnchor={labelOnLeft ? "end" : "start"}
                    style={{ fill: lit ? "var(--graph-lit)" : "var(--graph-label)" }}>{label}</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="graph-info">
        <div className="graph-controls">
          <label className="graph-toggle">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
            Show all labels
          </label>
          <label className="graph-toggle colour-by">
            <span>Colour by</span>
            <select value={colourBy} onChange={(e) => setColourBy(e.target.value as ColourBy)}>
              <option value="verdict">Verdict</option>
              <option value="rating">Rating band</option>
              <option value="community">Cluster (modularity)</option>
              <option value="provider">Provider (leading caller)</option>
            </select>
          </label>
        </div>
        {shown ? (
          <>
            {pinned && !hover && <span className="pin-tag">Pinned - click the background to release</span>}
            {shown.thumb && <img className="graph-thumb" src={shown.thumb} alt="" />}
            <strong>{shown.label}</strong>
            <div className={`verdict ${shown.verdict}`}>{shown.source === "observation"
              ? "Unscored observation" : verdictLabel(shown.verdict || "")}</div>
            {shown.finding && <p className="small">{shown.finding}</p>}
            {shown.detail && <p className="muted small">{shown.detail}</p>}
            {shown.audio_observations && <p className="muted small">{shown.audio_observations}</p>}
            <dl>
              <div><dt>rating</dt><dd>{shown.rating == null ? "Not scored" : `${shown.rating}/100`}</dd></div>
              {shown.status && <div><dt>check status</dt><dd>{shown.status}</dd></div>}
              <div><dt>cluster</dt><dd>{shown.cluster}</dd></div>
              <div><dt>community</dt><dd>{shown.community}</dd></div>
              <div><dt>links</dt><dd>{shown.degree}</dd></div>
              <div><dt>betweenness</dt><dd>{shown.betweenness.toFixed(3)}</dd></div>
              <div><dt>provenance</dt><dd>{shown.provenance || "-"}</dd></div>
              {shown.provider && <div><dt>provider</dt><dd>{PROVIDER_LABEL[shown.provider] || shown.provider}</dd></div>}
              {shown.source && <div><dt>source</dt><dd>{shown.source}</dd></div>}
            </dl>
          </>
        ) : (
          <p className="muted small">Hover a node for details, click to pin it. Drag nodes, drag background to pan, scroll to zoom.</p>
        )}
        <div className="graph-legend">
          <div className="legend-swatches">
            {legend.map(([label, colour]) => (
              <span key={label} className="legend-item">
                <i style={{ background: colour }} />{label}
              </span>
            ))}
          </div>
          <span>Size = synthetic rating</span>
          <span>Edge = similarity (thickness)</span>
          {data.nodes.some(n => n.source === "observation") && <span>Dashed links: additional context, unscored.</span>}
        </div>
      </div>
    </div>
  );
}
