"""Deterministic, plain-English summary of a diffusion graph.

No LLM and no freehand prose: fixed sentence slots are filled from the graph
statistics so the output is consistent and reproducible. Written for a general
audience - active voice, UK English, no jargon, no metaphor, no anthropomorphism.
A post-check raises if any banned term slips into the output.
"""
from __future__ import annotations

import re

_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
          "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
          "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]

_CLASS = {"synthetic_likely": "fully synthetic",
          "partially_synthetic": "partly synthetic",
          "authentic_likely": "authentic"}

# Jargon / metaphor that must never appear in audience-facing summaries.
_BANNED = ["node", "nodes", "topology", "betweenness", "broker", "brokers",
           "structural hole", "homophily", "homophilous", "contagion", "vector",
           "preach", "swallow", "constellation", "hinge", "diplomatic"]


def _w(n: int) -> str:
    return _WORDS[n] if 0 <= n < len(_WORDS) else str(n)


def _check(text: str) -> str:
    for term in _BANNED:
        if re.search(rf"\b{re.escape(term)}\b", text, re.IGNORECASE):
            raise ValueError(f"Summary contains banned term: {term}")
    return text


def _counts(nodes: list[dict]) -> dict:
    c = {"full": 0, "partial": 0, "auth": 0, "incon": 0}
    for n in nodes:
        v = n.get("verdict")
        if v == "synthetic_likely":
            c["full"] += 1
        elif v == "partially_synthetic":
            c["partial"] += 1
        elif v == "authentic_likely":
            c["auth"] += 1
        else:
            c["incon"] += 1
    return c


def _bridges(nodes: list[dict]) -> list[dict]:
    return sorted([n for n in nodes if n.get("betweenness", 0) > 0],
                  key=lambda n: n.get("betweenness", 0), reverse=True)


def _bridge_breakdown(bridges: list[dict]) -> str:
    by = {"fully synthetic": 0, "partly synthetic": 0, "authentic": 0}
    for b in bridges:
        label = _CLASS.get(b.get("verdict"))
        if label:
            by[label] += 1
    parts = [f"{_w(v)} {k}" for k, v in by.items() if v]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return ", ".join(parts[:-1]) + " and " + parts[-1]


def graph_summary(data: dict, source: str = "") -> dict:
    nodes = data["nodes"]
    n_total = len(nodes)
    c = _counts(nodes)
    n_manip = c["full"] + c["partial"]
    n_groups = data["stats"]["clusters"]
    bridges = _bridges(nodes)
    nb = len(bridges)

    # Rating sentence (numbers as words in this in-sentence breakdown). Attribute
    # the counts to the real source: live/cached analyses for reports, folder
    # labels for the dev-only corpus, and fixed labels for the toy example.
    if source == "corpus":
        rating_subject = "The folder labels record"
        rating_verb = "mark"
    elif source == "example":
        rating_subject = "The illustrative labels mark"
        rating_verb = "mark"
    else:
        rating_subject = "The analysis rated"
        rating_verb = "read"
    incon = f", and {_w(c['incon'])} inconclusive" if c["incon"] else ""
    rating = (f"{rating_subject} {_w(c['full'])} as likely synthetic, {_w(c['partial'])} as partly "
              f"synthetic, and {_w(c['auth'])} as likely authentic{incon}, so they {rating_verb} "
              f"{n_manip} of the {n_total} as at least partly synthetic.")

    # Groups + bridges sentences.
    # Images with no links at all must not be described as part of a connected
    # group - the reader can see them sitting alone in the picture.
    isolated = sum(1 for n in nodes if not n.get("degree"))
    linked = n_total - isolated
    apart = ""
    if isolated == 1:
        apart = " One item sits apart with no links."
    elif isolated > 1:
        apart = f" {_w(isolated).capitalize()} items sit apart with no links."

    if n_groups >= 2:
        groups = f"The items form {_w(n_groups)} main groups.{apart}"
    elif data["stats"]["edges"] > 0 and isolated:
        groups = (f"{_w(linked).capitalize()} of the {_w(n_total)} items form one connected "
                  f"group.{apart}")
    elif data["stats"]["edges"] > 0:
        groups = "The items form a single connected group."
    else:
        groups = "The items do not form connected groups in this sample."

    breakdown = _bridge_breakdown(bridges)
    if nb and breakdown:
        bridge_sent = (f"Within the graph, {_w(nb)} items act as bridges, connecting parts that would "
                       f"otherwise sit apart: {breakdown}.")
    else:
        bridge_sent = "No single item links otherwise separate parts together."

    # Interpretation only when the bridges are actually mostly partly synthetic.
    partial_bridges = sum(1 for b in bridges if b.get("verdict") == "partially_synthetic")
    full_bridges = sum(1 for b in bridges if b.get("verdict") == "synthetic_likely")
    if nb and partial_bridges > full_bridges:
        interp = ("Items rated fully synthetic mostly stay among similar items, while those rated "
                  "partly synthetic form most of the links between groups in this constructed map.")
        so_what = ("In this sample, the partly altered items provide most of the links between groups, "
                   "because their analysis results sit between the other two kinds.")
    elif nb and full_bridges > partial_bridges:
        interp = "Items rated fully synthetic form most of the links between groups here."
        so_what = ("In this sample, the items rated fully synthetic, not the partly altered ones, "
                   "do most of the connecting.")
    else:
        interp = ""
        so_what = ("In this sample, no one kind of item clearly links the others, so the similarities "
                   "are not concentrated on a single route.")

    # The headline is the one string a skimmer copies out alone, so it carries
    # its own attribution and hedging ("likely").
    incon_head = f", {c['incon']} inconclusive" if c["incon"] else ""
    head_item = ("corpus items" if source == "corpus" else
                 "illustrative items" if source == "example" else "analysed items")
    head_action = "labelled" if source == "corpus" else ("marked" if source == "example" else "rated")
    headline = (f"Diffusion graph of {n_total} {head_item}: {c['full']} {head_action} likely synthetic, "
                f"{c['partial']} partly synthetic, {c['auth']} likely authentic{incon_head}.")
    intro = ("Each point is an analysed item, and lines connect items with similar verdicts and "
             "ratings, or near-duplicate pixels.")
    # The paragraph tier reads as standalone prose, so it gets a fuller opening and
    # an extra plain-English line on what the bridging items mean for the reader.
    para_intro = ("Each point is an analysed item, and lines connect items whose analysis results "
                  "are similar, or whose pixels are near-duplicates.")
    if source == "corpus":
        intro = para_intro = "Points are corpus images; labels are assigned from their folders. Model analysis is outside this view. Lines link similar labels or pixels."
    elif source == "example":
        intro = para_intro = "Points and links are hand-authored illustrations. Platform activity has not been observed."
    bridge_context = ("The links between the groups run mainly through these bridging items, which is "
                      "where the groups meet in this similarity map.") if nb and breakdown else ""
    closer = "This is a similarity map of the analysed set. Distribution history: not assessed."
    caption = " ".join(x for x in [
        f"Diffusion graph of {n_total} {head_item}.", intro, rating, groups, bridge_sent, interp, closer] if x)
    paragraph = " ".join(x for x in [
        f"Diffusion graph of {n_total} {head_item}.", para_intro, rating, groups, bridge_sent,
        bridge_context, so_what, closer] if x)

    with_notes = sum(bool(n.get("second_opinions")) for n in nodes)
    if with_notes:
        note_text = (f"Researcher-pasted second opinions accompany {_w(with_notes)} item(s); "
                     "they are recorded separately from the automated verdicts and ratings.")
        caption += " " + note_text
        paragraph += " " + note_text

    if data.get("population"):
        from .diffusion import population_text
        coverage = population_text(data["population"])
        headline += " " + coverage
        caption += " " + coverage
        paragraph += " " + coverage
    with_audio = sum(bool(n.get("audio_observations")) for n in nodes)
    if with_audio:
        note = (f"Separate audio/vendor observations accompany {_w(with_audio)} item(s); "
                "they are recorded separately from the ratings and similarity links. "
                "AI-origin detection from sound is outside this workflow.")
        caption += " " + note
        paragraph += " " + note
    return {"headline": _check(headline), "caption": _check(caption), "paragraph": _check(paragraph)}

def verdict_map_summary(data: dict) -> dict:
    """Deterministic plain-English read of a single item's verdict map - same
    no-LLM contract as graph_summary, tuned to the per-item view."""
    nodes = data.get("nodes", [])
    centre = next((n for n in nodes if n.get("source") == "item"), {})
    signals = [n for n in nodes if n.get("source") == "signal"]
    visual_models = [n for n in signals if n.get("signal_kind") == "vision"]
    text_models = [n for n in signals if n.get("signal_kind") == "analysis"]
    sigs = visual_models or text_models
    other = [n for n in signals if n not in sigs]
    sos = [n for n in nodes if n.get("source") == "second_opinion"]
    synth = [n for n in sigs if n.get("verdict") in ("synthetic_likely", "partially_synthetic")]
    auth = [n for n in sigs if n.get("verdict") == "authentic_likely"]
    unsure = [n for n in sigs if n.get("verdict") == "inconclusive"]
    rating = centre.get("rating")

    def _lean(n: int, word: str) -> str:
        return f"{_w(n)} lean{'s' if n == 1 else ''} {word}"

    incon_bit = f", {_w(len(unsure))} inconclusive" if unsure else ""
    # Text-only workflows must not claim that a visual assessment took place.
    noun = "visual LLM" if visual_models else "text-analysis LLM"
    headline = (f"{_w(len(sigs)).capitalize()} {noun}{'s' if len(sigs) != 1 else ''} "
                f"assessed this item: {_lean(len(synth), 'synthetic')}, "
                f"{_lean(len(auth), 'authentic')}{incon_bit}.")
    if not sigs:
        headline = "No successful visual or text-analysis LLM assessments are available for this item."

    bits = [headline]
    if rating is not None and rating >= 0:
        bits.append(f"The combined indicative rating is {rating} out of one hundred. Not a calibrated probability.")
    if other:
        bits.append(f"{_w(len(other)).capitalize()} other check(s) are shown separately: "
                    + ", ".join(n.get("label", "Unnamed check") for n in other) + ".")
    if sos:
        for opinion in sos:
            label = opinion.get("label", "External check")
            score = opinion.get("rating", -1)
            status = (f"note score {score}/100" if score is not None and score >= 0
                      else "not scored")
            bits.append(f"Pasted second opinion: {label} ({status}).")
        bits.append("Second opinions are researcher-supplied notes, recorded separately from the "
                    "visual LLM count and combined assessment.")
    observations = [n for n in nodes if n.get("source") == "observation"]
    for observation in observations:
        bits.append(f"Separate observation: {observation.get('label')} "
                    f"({observation.get('status')}; {observation.get('finding')}).")
    if observations:
        bits.append("Audio observations and vendor findings appear as additional, unscored context. "
                    "Dashed links connect them to the item; the visual model count is unchanged. "
                    "AI-origin detection from sound is outside this workflow.")
    bits.append("Distribution history: not assessed.")
    caption = " ".join(bits)

    def names(ns):
        return ", ".join(n.get("label", "?") for n in ns)

    para = [caption]
    if synth:
        para.append(f"Leaning synthetic: {names(synth)}.")
    if auth:
        para.append(f"Leaning authentic: {names(auth)}.")
    if unsure:
        para.append(f"Undecided: {names(unsure)}.")
    para.append("Signals that share a verdict are linked to each other; the size of "
                "each scored mark follows its synthetic rating. This is a view of one analysis record.")
    return {"headline": _check(headline), "caption": _check(caption),
            "paragraph": _check(" ".join(para))}
