#!/usr/bin/env python3
"""CLI for the symbolic-diffusion graph. Core logic lives in app/diffusion.py
(shared with the in-app /api/diffusion endpoint).

  python scripts/build_diffusion_graph.py --runs --out reports/diffusion
  python scripts/build_diffusion_graph.py --from-corpus all --anonymise --min-component 2 \
      --out examples/diffusion/network
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import diffusion  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--runs", action="store_true")
    src.add_argument("--from-corpus", metavar="LABEL")
    ap.add_argument("--threshold", type=int, default=10)
    ap.add_argument("--min-component", type=int, default=1)
    ap.add_argument("--anonymise", action="store_true")
    ap.add_argument("--labels", action="store_true")
    ap.add_argument("--out", default="reports/diffusion")
    args = ap.parse_args()

    items = diffusion.from_runs() if args.runs else diffusion.from_corpus(args.from_corpus)
    if not items:
        raise SystemExit("No items found.")
    g = diffusion.build(items, args.threshold, args.min_component)

    if args.anonymise:
        for n in g.nodes():
            g.nodes[n]["label"] = n
            g.nodes[n]["source"] = ""

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    Path(f"{out}.gexf").write_bytes(diffusion.gexf_bytes(g))
    diffusion.write_csvs(g, Path(f"{out}_nodes.csv"), Path(f"{out}_edges.csv"), args.anonymise)
    diffusion.render_png(g, Path(f"{out}.png"), args.anonymise, labels=args.labels)

    s = diffusion.graph_to_json(g)["stats"]
    print(f"Nodes {s['nodes']}  Edges {s['edges']}  Clusters {s['clusters']}  Largest {s['largest_cluster']}")
    print(f"Wrote {out}.gexf, {out}_nodes.csv, {out}_edges.csv, {out}.png")


if __name__ == "__main__":
    main()
