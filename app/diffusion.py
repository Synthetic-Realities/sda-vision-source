"""Symbolic-diffusion graph core, shared by the CLI and the in-app API.

Builds a graph whose nodes are analysed items and whose edges link near-duplicate
/ variant images by perceptual-hash similarity. Sources: accumulated dev_runs/,
a corpus subset, or a hand-authored illustrative example.
"""
from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import imagehash
import networkx as nx
from PIL import Image, ImageDraw, ImageFont

from .config import CORPUS_DIR, ROOT
from .corpus import is_visible_corpus_file

# Pillow's decompression-bomb guard stays on for uploads and corpus scans alike.
DEV_RUNS = ROOT / "dev_runs"
EXAMPLES_DIR = ROOT / "examples"
_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}
_OTHER_MEDIA_EXT = {".pdf", ".pptx", ".mp4", ".mov", ".webm", ".m4v",
                    ".txt", ".srt", ".vtt", ".md", ".m4a", ".mp3", ".wav"}

PALETTE = [
    "#4f8cff", "#ef5b5b", "#2fbf71", "#d98324",
    "#8a5bff", "#2dc8c8", "#f0a830", "#c85aa0",
]
# Vision models that can attribute an item to a "leading caller" for colour-by-Provider.
_VISION_PROVIDERS = {"claude", "openai", "gemini"}
_FOLDER_CLASS = {
    "01": ("authentic_likely", "camera"), "02": ("authentic_likely", "none"),
    "03": ("synthetic_likely", "none"), "04": ("synthetic_likely", "none"),
    "05": ("partially_synthetic", "none"), "06": ("synthetic_likely", "watermark"),
    "07": ("synthetic_likely", "ai"), "08": ("synthetic_likely", "ai"),
    "09": ("synthetic_likely", "ai"), "12": ("synthetic_likely", "none"),
    "13": ("synthetic_likely", "none"), "14": ("inconclusive", "none"),
}


def _thumb_data_url(img: "Image.Image", size: int = 140) -> str:
    import base64
    im = img.copy()
    im.thumbnail((size, size))
    buf = io.BytesIO()
    im.convert("RGB").save(buf, format="JPEG", quality=70)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


class Item:
    def __init__(self, node_id, label, verdict, rating, confidence, provenance, source, phashes,
                 thumb=None, provider="", second_opinions="", audio_observations=""):
        self.id = node_id
        self.label = label
        self.verdict = verdict
        self.rating = rating
        self.confidence = confidence
        self.provenance = provenance
        self.source = source
        self.thumb = thumb
        self.provider = provider
        self.second_opinions = second_opinions
        self.audio_observations = audio_observations
        self.phashes = []
        for h in phashes or []:
            try:
                if h:
                    self.phashes.append(imagehash.hex_to_hash(h))
            except (ValueError, TypeError):
                continue  # ignore a malformed hash rather than failing the whole graph


# ── Sources ───────────────────────────────────────────────────────────────────
def _lead_provider(providers: list[dict]) -> str:
    """The vision model that called the item most synthetic (highest rating).
    Used only to colour the graph by which caller led, never for the verdict."""
    rated = [(p.get("rating"), p.get("id")) for p in providers
             if p.get("id") in _VISION_PROVIDERS and isinstance(p.get("rating"), (int, float))]
    return max(rated)[1] if rated else ""


def _node_rating(rep: dict, cons: dict) -> float | None:
    """Preserve the report's score, including deliberately unscored provenance."""
    r = cons.get("overall_rating")
    return r if isinstance(r, (int, float)) else None


# Pasted second-opinion notes (with any Haiku read/score), flattened to one
# string so the diffusion graph and its GEXF export carry a tagged column.
_OPINION_SOURCES = [("gemini", "Gemini SynthID"), ("chatgpt", "OpenAI second opinion")]


def _opinions_str(rep: dict) -> str:
    parts = []
    for key, label in _OPINION_SOURCES:
        text = (rep.get(f"second_opinion_{key}") or "").strip()
        if not text:
            continue
        score = rep.get(f"second_opinion_{key}_score")
        read = (rep.get(f"second_opinion_{key}_read") or "").strip()
        tag = label
        meta = []
        if read:
            meta.append(f"read: {read}")
        if isinstance(score, (int, float)):
            meta.append(f"score ~{int(score)}/100")
        if meta:
            tag += " (" + "; ".join(meta) + ")"
        parts.append(f"{tag}: {text}".replace("\n", " "))
    return " || ".join(parts)


def _audio_observations(rep: dict) -> list[dict]:
    """Unscored, hash-bound context. These never enter the agreement graph."""
    digest = rep.get("meta", {}).get("input_sha256")
    rows = []
    definitions = (("audio_inspection", "Local soundtrack", "audio_local", "local_audio"),
                   ("audio_assessment", "Gemini audio content", "audio_content", "gemini_audio"),
                   ("suno_check", "Suno Credentials", "vendor_provenance", "suno"))
    for key, label, kind, provider in definitions:
        value = rep.get(key)
        if not digest or not isinstance(value, dict) or value.get("input_sha256") != digest:
            continue
        status = value.get("status", "unknown")
        if key == "audio_inspection":
            finding = f"{value.get('stream_count')} track(s) found" if status == "present" else (
                "No audio tracks found" if status == "absent" else "Audio presence unknown")
            scope = "Track details and audio levels in the sampled windows."
        elif key == "audio_assessment":
            finding = value.get("content_type", "unclear") if status == "ok" else "No usable content assessment"
            scope = (f"{value.get('model', '')}; track {value.get('track_index')}, "
                     f"{value.get('start_seconds')}s + {value.get('duration_seconds')}s; excerpt content description.")
        else:
            finding = f"Vendor reports {value.get('verdict')}" if status == "ok" else "No usable vendor result"
            scope = "Original-file credential finding reported by Suno; local signer trust is assessed separately."
        rows.append({"id": key, "label": label, "signal_kind": kind, "provider": provider,
                     "status": status, "finding": finding,
                     "detail": scope + " AI-origin detection from sound is outside this workflow.",
                     "input_sha256": digest})
    return rows


def _audio_str(rep: dict) -> str:
    return " || ".join(f"{r['label']}: {r['status']}; {r['finding']}; {r['detail']}"
                       for r in _audio_observations(rep))


def _item_from_report(rep: dict, node_id: str, fallback_label: str = "") -> Item:
    meta, cons = rep.get("meta", {}), rep.get("consensus", {})
    providers = rep.get("providers", [])
    c2pa = next((p for p in providers if p.get("id") == "c2pa"), {})
    prov = {"synthetic_likely": "ai", "authentic_likely": "camera"}.get(c2pa.get("verdict"), "none")
    return Item(node_id, meta.get("filename", fallback_label or node_id),
                cons.get("overall_verdict", "inconclusive"), _node_rating(rep, cons),
                cons.get("confidence"), prov, meta.get("kind", ""), rep.get("phashes", []),
                thumb=meta.get("thumbnail"), provider=_lead_provider(providers),
                second_opinions=_opinions_str(rep), audio_observations=_audio_str(rep))


def from_runs() -> list[Item]:
    items = []
    for i, path in enumerate(sorted(DEV_RUNS.glob("*.json"))):
        try:
            rep = json.loads(path.read_text())
        except Exception:
            continue
        items.append(_item_from_report(rep, f"n{i:04d}", path.stem))
    return items


def from_reports(reports: list[dict]) -> list[Item]:
    """Build nodes from reports handed in by the frontend (the current session's
    batch). Only matching cryptographic input hashes are deduplicated. Legacy
    reports without hashes are retained; similar pixels/names are not identity."""
    items, seen = [], set()
    for i, rep in enumerate(reports or []):
        if not isinstance(rep, dict):
            continue
        key = rep.get("meta", {}).get("input_sha256")
        if key:
            if key in seen:
                continue
            seen.add(key)
        items.append(_item_from_report(rep, f"n{i:04d}"))
    return items


def from_corpus(label: str) -> list[Item]:
    return _corpus_items(label)[0]


def _corpus_items(label: str) -> tuple[list[Item], dict]:
    items, i = [], 0
    counts = {"source_items": 0, "eligible_items": 0, "excluded_unsupported": 0,
              "excluded_unreadable": 0, "excluded_duplicates": 0}
    if not CORPUS_DIR.exists():
        return items, counts
    for path in sorted(CORPUS_DIR.rglob("*")):
        if not (is_visible_corpus_file(path, CORPUS_DIR)
                and path.suffix.lower() in _IMAGE_EXT | _OTHER_MEDIA_EXT):
            continue
        folder = path.relative_to(CORPUS_DIR).parts[0]
        if label != "all" and not folder.startswith(label):
            continue
        counts["source_items"] += 1
        if path.suffix.lower() not in _IMAGE_EXT:
            counts["excluded_unsupported"] += 1
            continue
        counts["eligible_items"] += 1
        verdict, prov = _FOLDER_CLASS.get(folder[:2], ("inconclusive", "none"))
        try:
            # Keep the global image-size guard enabled even during corpus scans.
            with Image.open(io.BytesIO(path.read_bytes())) as img:
                ph = str(imagehash.phash(img))
                thumb = _thumb_data_url(img)
        except Exception:
            counts["excluded_unreadable"] += 1
            continue
        items.append(Item(f"n{i:04d}", path.name, verdict, None, None, prov, folder, [ph], thumb=thumb))
        i += 1
    return items, counts


# ── Build ─────────────────────────────────────────────────────────────────────
def _min_distance(a: Item, b: Item) -> int:
    return min((ha - hb) for ha in a.phashes for hb in b.phashes) if a.phashes and b.phashes else 99


def _attr_weight(a: Item, b: Item) -> float:
    """Similarity by synthetic rating (the analytic signal), nudged up when the
    verdicts also agree. Falls back to verdict match when ratings are missing."""
    if a.rating is not None and b.rating is not None:
        base = 1 - abs(a.rating - b.rating) / 100
        if a.verdict and a.verdict == b.verdict:
            base = min(1.0, base + 0.1)
        return round(base, 3)
    if a.verdict and a.verdict == b.verdict and a.verdict != "not_applicable":
        return 0.6
    return 0.0


def _add_knn_edges(g: nx.Graph, items: list[Item], k: int = 4, floor: float = 0.45) -> None:
    """k-nearest-neighbour edges by attribute similarity: each node links to its
    few most-similar peers. Keeps the graph sparse and navigable (real bridges,
    meaningful betweenness) instead of dense same-verdict cliques."""
    for a in items:
        ranked = sorted(((_attr_weight(a, b), b) for b in items if b.id != a.id),
                        key=lambda x: x[0], reverse=True)
        for weight, b in ranked[:k]:
            if weight >= floor and not g.has_edge(a.id, b.id):
                g.add_edge(a.id, b.id, weight=weight, kind="similar", hamming=-1)


def build(items: list[Item], threshold: int = 10, min_component: int = 1,
          edge_mode: str = "variants", population: dict | None = None) -> nx.Graph:
    g = nx.Graph()
    for it in items:
        g.add_node(it.id, label=it.label, verdict=it.verdict,
                   rating=(it.rating if it.rating is not None else -1),
                   confidence=it.confidence or "", provenance=it.provenance, source=it.source,
                   provider=it.provider or "", second_opinions=it.second_opinions or "",
                   audio_observations=it.audio_observations,
                   thumb=it.thumb or "")
    if edge_mode == "attributes":
        _add_knn_edges(g, items)
    else:
        for i, a in enumerate(items):
            for b in items[i + 1:]:
                d = _min_distance(a, b)
                if d <= threshold:
                    g.add_edge(a.id, b.id, weight=round(1 - d / 64, 3), hamming=d, kind="variant")
    isolated_before = nx.number_of_isolates(g)
    if min_component > 1:
        keep = {n for comp in nx.connected_components(g) if len(comp) >= min_component for n in comp}
        g = g.subgraph(keep).copy()
    g.graph["population"] = {
        "source_items": len(items), "eligible_items": len(items),
        "excluded_unsupported": 0, "excluded_unreadable": 0, "excluded_duplicates": 0,
        **(population or {}),
        "loaded_items": len(items), "displayed_items": g.number_of_nodes(),
        "excluded_by_filter": len(items) - g.number_of_nodes(),
        "isolated_before_filter": isolated_before, "isolated_displayed": nx.number_of_isolates(g),
        "min_component": min_component, "edge_mode": edge_mode, "threshold": threshold,
    }
    _annotate(g)
    return g


def _annotate(g: nx.Graph) -> None:
    for cid, comp in enumerate(nx.connected_components(g)):
        for n in comp:
            g.nodes[n]["cluster"] = cid
    try:
        comms = nx.community.greedy_modularity_communities(g) if g.number_of_edges() else []
    except Exception:
        comms = []
    for mid, comm in enumerate(comms):
        for n in comm:
            g.nodes[n]["community"] = mid
    for n in g.nodes():
        g.nodes[n].setdefault("community", g.nodes[n].get("cluster", 0))
    # Betweenness centrality: which items bridge otherwise separate clusters
    # (a node that links, say, a synthetic family to an authentic one).
    try:
        bc = nx.betweenness_centrality(g) if g.number_of_edges() else {}
    except Exception:
        bc = {}
    for n in g.nodes():
        g.nodes[n]["betweenness"] = round(bc.get(n, 0.0), 4)


# ── Illustrative example (hand-authored; no real data) ────────────────────────
EXAMPLE_NODES = {
    "p_seed": ("Vaccine-injury poster (seed)", "synthetic_likely", "ai", "X"),
    "p_repost": ("Near-duplicate repost", "synthetic_likely", "none", "Facebook"),
    "p_crop": ("Cropped + new caption", "partially_synthetic", "none", "Instagram"),
    "p_shot": ("Screenshot of post", "synthetic_likely", "none", "TikTok"),
    "p_meme": ("Meme restyle", "synthetic_likely", "none", "X"),
    "j_seed": ("Fabricated journal figure (seed)", "synthetic_likely", "ai", "X"),
    "j_render": ("Re-rendered chart", "synthetic_likely", "none", "X"),
    "j_annot": ("Annotated repost", "partially_synthetic", "none", "Facebook"),
    "d_seed": ("AI testimonial portrait (seed)", "synthetic_likely", "ai", "Instagram"),
    "d_caption": ("Same image, new caption", "synthetic_likely", "none", "Instagram"),
    "d_pfp": ("Profile-pic crop", "partially_synthetic", "none", "X"),
    "bridge": ("Composite: poster + chart", "partially_synthetic", "none", "Telegram"),
    "auth1": ("Illustrative authentic item A", "authentic_likely", "none", "illustration"),
    "auth2": ("Illustrative authentic item B", "authentic_likely", "none", "illustration"),
}
EXAMPLE_EDGES = [
    ("p_seed", "p_repost", 0.96, "near-duplicate"), ("p_seed", "p_shot", 0.82, "screenshot"),
    ("p_seed", "p_crop", 0.78, "crop"), ("p_repost", "p_shot", 0.88, "screenshot"),
    ("p_crop", "p_meme", 0.60, "restyle"), ("j_seed", "j_render", 0.90, "re-render"),
    ("j_render", "j_annot", 0.72, "annotation"), ("d_seed", "d_caption", 0.93, "caption"),
    ("d_seed", "d_pfp", 0.75, "crop"), ("bridge", "p_crop", 0.55, "composite"),
    ("bridge", "j_seed", 0.55, "composite"),
]


# Illustrative synthetic ratings by verdict, so the example demonstrates the
# rating-band colouring and node sizing as well as verdict colouring.
_EX_RATING = {"synthetic_likely": 88, "partially_synthetic": 48,
              "authentic_likely": 14, "inconclusive": 55}

# Real bundled thumbnails for the example, mapped by verdict, so the demo graph
# shows our synthetic media (and the authentic example) like a real run would.
_EX_THUMB_FILE = {
    "synthetic_likely": "synthetic_vaccine_illustration.png",
    "partially_synthetic": "synthetic_journal_figure.png",
    "authentic_likely": "authentic_nasa_earth_apollo17.jpg",
}
_ex_thumb_cache: dict[str, str] = {}


def _example_thumb(verdict: str) -> str:
    fn = _EX_THUMB_FILE.get(verdict)
    if not fn:
        return ""
    if fn not in _ex_thumb_cache:
        try:
            with Image.open(EXAMPLES_DIR / fn) as img:
                _ex_thumb_cache[fn] = _thumb_data_url(img)
        except Exception:
            _ex_thumb_cache[fn] = ""
    return _ex_thumb_cache[fn]


def example_graph() -> nx.Graph:
    g = nx.Graph()
    for nid, (label, verdict, prov, plat) in EXAMPLE_NODES.items():
        g.add_node(nid, label=label, verdict=verdict, rating=_EX_RATING.get(verdict, -1),
                   confidence="", provenance=prov, source=plat,
                   thumb=_example_thumb(verdict), provider="", second_opinions="")
    for a, b, w, vt in EXAMPLE_EDGES:
        g.add_edge(a, b, weight=w, variant_type=vt, hamming=int(round((1 - w) * 64)))
    _annotate(g)
    return g


# ── Serialisation ─────────────────────────────────────────────────────────────
def graph_to_json(g: nx.Graph) -> dict:
    pos = nx.spring_layout(g, seed=42, k=0.7) if g.number_of_nodes() else {}
    xs = [p[0] for p in pos.values()] or [0]
    ys = [p[1] for p in pos.values()] or [0]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    deg = dict(g.degree())
    nodes = [{
        "id": n, "label": d.get("label", n), "verdict": d.get("verdict"),
        "rating": (None if d.get("rating") in (-1, None) else d.get("rating")),
        "provenance": d.get("provenance"), "source": d.get("source"),
        "provider": d.get("provider") or None,
        "signal_kind": d.get("signal_kind") or None,
        "second_opinions": d.get("second_opinions") or "",
        "audio_observations": d.get("audio_observations") or "",
        "status": d.get("status") or "", "finding": d.get("finding") or "",
        "detail": d.get("detail") or "", "input_sha256": d.get("input_sha256") or "",
        "cluster": d.get("cluster"), "community": d.get("community", 0), "degree": deg.get(n, 0),
        "betweenness": d.get("betweenness", 0.0),
        "thumb": d.get("thumb") or None,
        "x": float(round((pos[n][0] - minx) / (maxx - minx or 1), 4)),
        "y": float(round((pos[n][1] - miny) / (maxy - miny or 1), 4)),
    } for n, d in g.nodes(data=True)]
    edges = [{"source": u, "target": v, "weight": d.get("weight", 0.5),
              "variant_type": d.get("variant_type", d.get("kind", ""))} for u, v, d in g.edges(data=True)]
    comps = [c for c in nx.connected_components(g) if len(c) >= 2]
    return {"nodes": nodes, "edges": edges, "population": g.graph.get("population"), "stats": {
        "nodes": g.number_of_nodes(), "edges": g.number_of_edges(),
        "clusters": len(comps), "largest_cluster": max((len(c) for c in comps), default=0)}}


def csv_zip_bytes(g: nx.Graph) -> bytes:
    """A zip of nodes.csv + edges.csv for spreadsheet / non-Gephi users."""
    import zipfile
    nbuf = io.StringIO()
    nw = csv.writer(nbuf)
    nw.writerow(["id", "label", "verdict", "rating", "confidence", "provenance", "source",
                 "provider", "cluster", "community", "degree", "betweenness", "second_opinions",
                 "signal_kind", "status", "finding", "detail", "input_sha256", "audio_observations"])
    for n, d in g.nodes(data=True):
        nw.writerow([n, d.get("label", ""), d.get("verdict"), d.get("rating"), d.get("confidence"),
                     d.get("provenance"), d.get("source"), d.get("provider", ""), d.get("cluster"),
                     d.get("community"), g.degree(n), d.get("betweenness", 0.0),
                     d.get("second_opinions", ""), d.get("signal_kind", ""), d.get("status", ""),
                     d.get("finding", ""), d.get("detail", ""), d.get("input_sha256", ""),
                     d.get("audio_observations", "")])
    ebuf = io.StringIO()
    ew = csv.writer(ebuf)
    ew.writerow(["source", "target", "weight", "hamming", "variant_type"])
    for u, v, d in g.edges(data=True):
        ew.writerow([u, v, d.get("weight"), d.get("hamming"), d.get("variant_type", d.get("kind", ""))])
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("nodes.csv", nbuf.getvalue())
        z.writestr("edges.csv", ebuf.getvalue())
        if "population" in g.graph:
            z.writestr("population.json", json.dumps(g.graph["population"], indent=2))
    return out.getvalue()


def gexf_bytes(g: nx.Graph) -> bytes:
    """GEXF for Gephi, with the (large) base64 thumbnails stripped out."""
    h = g.copy()
    if "population" in g.graph:
        h.graph["name"] = "SDA Vision population: " + json.dumps(g.graph["population"], sort_keys=True)
    for n in h.nodes():
        h.nodes[n].pop("thumb", None)
    buf = io.BytesIO()
    nx.write_gexf(h, buf)
    return buf.getvalue()


def graph_for_source(source: str, threshold: int = 10, min_component: int = 1,
                     edge_mode: str = "variants") -> nx.Graph:
    if source == "example":
        return example_graph()
    if source == "corpus":
        items, population = _corpus_items("all")
        return build(items, threshold, min_component, edge_mode, population)
    return build(from_runs(), threshold, min_component, edge_mode)


def verdict_map(report: dict) -> nx.Graph:
    """Per-item 'verdict network': the analysed media at the centre, one mark per
    signal that assessed it (vision models, C2PA, forensics, plus any pasted
    second opinions), and links between signals that share a verdict. This is a
    view over the report JSON only - no new analysis, no network calls."""
    from .schema import verdict_from_rating

    g = nx.Graph()
    cons = report.get("consensus", {}) or {}
    meta = report.get("meta", {}) or {}
    centre = "item"
    g.add_node(centre,
               label=meta.get("filename", "item"),
               verdict=cons.get("overall_verdict", "inconclusive"),
               rating=(cons.get("overall_rating") if cons.get("overall_rating") is not None else -1),
               confidence=cons.get("confidence", ""), provenance="", source="item",
               provider="", second_opinions="", thumb=(meta.get("thumbnail") or ""))

    signals: list[str] = []
    for prov in report.get("providers", []) or []:
        if prov.get("status") != "ok" or prov.get("verdict") == "not_applicable":
            continue
        nid = f"sig_{prov.get('id', len(signals))}"
        g.add_node(nid,
                   label=prov.get("name", prov.get("id", "signal")),
                   verdict=prov.get("verdict", "inconclusive"),
                   rating=(prov.get("rating") if prov.get("rating") is not None else -1),
                   confidence=prov.get("confidence") or "", provenance="",
                   source="signal", provider=prov.get("id", ""),
                   signal_kind=prov.get("kind", ""),
                   second_opinions="", thumb="")
        signals.append(nid)

    for key, tag in _OPINION_SOURCES:
        if not (report.get(f"second_opinion_{key}") or "").strip():
            continue
        score = report.get(f"second_opinion_{key}_score")
        nid = f"so_{key}"
        g.add_node(nid, label=tag,
                   verdict=(verdict_from_rating(score).value if score is not None else "inconclusive"),
                   rating=(score if score is not None else -1),
                   confidence="", provenance="", source="second_opinion",
                   provider=key, second_opinions=_opinions_str({
                       f"second_opinion_{key}": report[f"second_opinion_{key}"],
                       f"second_opinion_{key}_read": report.get(f"second_opinion_{key}_read"),
                       f"second_opinion_{key}_score": score,
                   }), thumb="")
        signals.append(nid)

    # Spokes: every signal is attached to the item it assessed.
    for nid in signals:
        g.add_edge(centre, nid, weight=0.35, kind="signal", hamming=-1)
    # Agreement links: signals sharing a verdict, weighted by rating closeness.
    for i, a in enumerate(signals):
        for b in signals[i + 1:]:
            if g.nodes[a]["verdict"] != g.nodes[b]["verdict"]:
                continue
            ra, rb = g.nodes[a]["rating"], g.nodes[b]["rating"]
            w = 0.6 if -1 in (ra, rb) else round(max(0.45, 1 - abs(ra - rb) / 100), 3)
            g.add_edge(a, b, weight=w, kind="agree", hamming=-1)
    for observation in _audio_observations(report):
        value = dict(observation)
        nid = "obs_" + value.pop("id")
        g.add_node(nid, **value, verdict="not_applicable", rating=-1, confidence="",
                   provenance="", source="observation", second_opinions="", thumb="")
        g.add_edge(centre, nid, weight=0.25, kind="observation", hamming=-1)
    _annotate(g)
    return g


def graph_for_payload(source: str, reports: list[dict] | None, threshold: int = 10,
                      min_component: int = 1, edge_mode: str = "attributes") -> nx.Graph:
    """Sources for the in-app graph: 'batch' (reports from the current session,
    supplied by the frontend), 'corpus' (a labelled-corpus sample) or 'example'
    (the hand-authored illustration)."""
    if source == "example":
        return example_graph()
    if source == "item":
        return verdict_map((reports or [{}])[0])
    if source == "corpus":
        items, population = _corpus_items("all")
        return build(items, threshold, min_component, edge_mode, population)
    records = reports or []
    items = from_reports(records)
    return build(items, threshold, min_component, edge_mode, {
        "source_items": len(records), "eligible_items": len(records),
        "excluded_duplicates": len(records) - len(items),
    })


# ── File outputs (CLI) ────────────────────────────────────────────────────────
# The four colour modes must match GraphView.tsx exactly, so a downloaded PNG
# is the picture the researcher was looking at, not a differently-coloured twin.
PNG_COLOUR_MODES = ("verdict", "rating", "community", "provider")
_VERDICT_HEX = {"synthetic_likely": "ef5b5b", "partially_synthetic": "d98324",
                "authentic_likely": "2fbf71", "inconclusive": "8d9bb0",
                "not_applicable": "8d9bb0"}
_PROVIDER_HEX = {"claude": "d98324", "openai": "2fbf71", "gemini": "4f8cff"}
_GREY = "8d9bb0"


def _png_node_colour(data: dict, colour_by: str) -> str:
    if data.get("source") == "observation":
        return "1b878a"
    if data.get("source") == "item":
        return "b07ce8"  # the analysed item stays violet in every mode
    if colour_by == "provider":
        return _PROVIDER_HEX.get(str(data.get("provider") or ""), _GREY)
    if colour_by == "rating":
        rating = data.get("rating")
        if rating is None or rating == -1:
            return _GREY
        return "ef5b5b" if rating >= 60 else ("d98324" if rating >= 30 else "2fbf71")
    if colour_by == "community":
        return PALETTE[int(data.get("community") or 0) % len(PALETTE)].lstrip("#")
    return _VERDICT_HEX.get(str(data.get("verdict", "")), _GREY)


# PNG chrome per theme. The node DATA palette above is theme-invariant (it is
# what the paper and the on-screen view share); only the chrome - background,
# node outline, labels, edge tones - follows the requested theme so a download
# matches the light or dark interface it was taken from.
PNG_THEMES = ("dark", "light")
_PNG_CHROME = {
    "dark": {"bg": (12, 16, 24), "label": (205, 214, 228)},
    "light": {"bg": (255, 255, 255), "label": (71, 85, 107)},
}


def render_png(g: nx.Graph, out: Path, anonymise: bool, labels: bool = False,
               colour_by: str = "verdict", theme: str = "dark") -> None:
    W, H, margin = 1400, 1000, 90
    chrome = _PNG_CHROME["light" if theme == "light" else "dark"]
    pos = nx.spring_layout(g, seed=42, k=0.7)
    xs = [p[0] for p in pos.values()] or [0]
    ys = [p[1] for p in pos.values()] or [0]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)

    def place(p):
        return (margin + (p[0] - minx) / (maxx - minx or 1) * (W - 2 * margin),
                margin + (p[1] - miny) / (maxy - miny or 1) * (H - 2 * margin - 50))

    img = Image.new("RGB", (W, H), chrome["bg"])
    d = ImageDraw.Draw(img)
    for u, v, dta in g.edges(data=True):
        w = float(dta.get("weight", 0.5))
        # Weak edges stay subtle and strong edges prominent on either
        # background: tones brighten with weight on dark, darken on light.
        s = 60 + int(150 * w) if theme != "light" else 210 - int(150 * w)
        if dta.get("kind") == "observation":
            a, b = place(pos[u]), place(pos[v])
            length = max(1, int(((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5))
            for offset in range(0, length, 14):
                t0, t1 = offset / length, min(offset + 7, length) / length
                d.line([(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for t in (t0, t1)],
                       fill=(27, 135, 138), width=2)
        else:
            d.line([place(pos[u]), place(pos[v])], fill=(s - 30, s - 10, s), width=1 + int(round(w * 5)))
    max_deg = max((deg for _, deg in g.degree()), default=1) or 1
    # Same scheme as the in-app view: node colour follows the selected
    # colour-by mode (violet = the analysed item in every mode), size by
    # synthetic rating with a quadratic curve so high ratings stay visibly apart.
    for n, data in g.nodes(data=True):
        x, y = place(pos[n])
        rating = data.get("rating")
        if data.get("source") == "observation":
            r = 11
        elif rating is not None and rating != -1:
            r = 8 + int((float(rating) / 100) ** 2 * 26)
        else:
            r = 9 + int(14 * (g.degree(n) / max_deg))
        col = _png_node_colour(data, colour_by)
        rgb = tuple(int(col[i:i + 2], 16) for i in (0, 2, 4))
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgb, outline=chrome["bg"], width=2)
        if labels and not anonymise:
            label = str(data.get("label", ""))[:34]
            width = d.textbbox((0, 0), label)[2]
            label_x = x + r + 4
            if label_x + width > W - 16:
                label_x = max(8, x - r - 4 - width)
            d.text((label_x, y - 5), label, fill=chrome["label"])
    from PIL.PngImagePlugin import PngInfo
    metadata = PngInfo()
    d.text((24, H - 28), "Distribution history: not assessed. Ratings are not calibrated probabilities.",
           fill=chrome["label"], font=ImageFont.load_default(size=16))
    if any(data.get("source") == "observation" for _, data in g.nodes(data=True)):
        d.text((24, H - 70), "Teal: unscored audio/vendor observations. Dashed links: additional context.",
               fill=chrome["label"], font=ImageFont.load_default(size=16))
        d.text((24, H - 49), "AI-origin detection from sound is outside this workflow.",
               fill=chrome["label"], font=ImageFont.load_default(size=16))
    population = g.graph.get("population")
    if population:
        metadata.add_text("sda_population", json.dumps(population, sort_keys=True))
        d.text((24, 20), population_text(population), fill=chrome["label"],
               font=ImageFont.load_default(size=16))
    img.save(out, quality=90, pnginfo=metadata)


def write_csvs(g: nx.Graph, nodes_path: Path, edges_path: Path, anonymise: bool) -> None:
    if "population" in g.graph:
        nodes_path.with_name(nodes_path.stem + "_population.json").write_text(
            json.dumps(g.graph["population"], indent=2))
    with nodes_path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "label", "verdict", "rating", "confidence", "provenance", "source",
                    "cluster", "community", "degree", "betweenness"])
        for n, d in g.nodes(data=True):
            w.writerow([n, (n if anonymise else d.get("label", "")), d.get("verdict"), d.get("rating"),
                        d.get("confidence"), d.get("provenance"), ("" if anonymise else d.get("source")),
                        d.get("cluster"), d.get("community"), g.degree(n), d.get("betweenness", 0.0)])
    with edges_path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["source", "target", "weight", "hamming", "variant_type"])
        for u, v, d in g.edges(data=True):
            w.writerow([u, v, d.get("weight"), d.get("hamming"), d.get("variant_type", "")])


def population_text(p: dict) -> str:
    return (f"Displayed {p['displayed_items']} of {p['eligible_items']} eligible "
            f"({p['source_items']} source items). Excluded: {p['excluded_unsupported']} non-image, "
            f"{p['excluded_unreadable']} unreadable, {p['excluded_duplicates']} duplicate, "
            f"{p['excluded_by_filter']} filtered. Isolated shown: {p['isolated_displayed']}.")
