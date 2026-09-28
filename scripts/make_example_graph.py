#!/usr/bin/env python3
"""Regenerate the illustrative diffusion example bundled in examples/diffusion/.
Core graph + renderer live in app/diffusion.py.
"""
from __future__ import annotations

import sys
from pathlib import Path

import networkx as nx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import diffusion  # noqa: E402


def main() -> None:
    g = diffusion.example_graph()
    out = Path(__file__).resolve().parent.parent / "examples" / "diffusion" / "network"
    out.parent.mkdir(parents=True, exist_ok=True)
    nx.write_gexf(g, f"{out}.gexf")
    diffusion.write_csvs(g, Path(f"{out}_nodes.csv"), Path(f"{out}_edges.csv"), anonymise=False)
    diffusion.render_png(g, Path(f"{out}.png"), anonymise=False, labels=True)
    s = diffusion.graph_to_json(g)["stats"]
    print(f"Nodes {s['nodes']}  Edges {s['edges']}  Clusters {s['clusters']}")


if __name__ == "__main__":
    main()
