"""Generator surface-tells note for the annotation prompt. Dated and versioned.

Referenced ONLY by app/annotation/prompts.py. It must never reach the scored
panel prompt (app/providers/prompt.py); a test pins this. The note describes
surface patterns worth pointing at in place-anchored synthetic imagery; it is
descriptive guidance for the model's attention, never a verdict rule.
"""
from __future__ import annotations

NOTE_VERSION = "tells-v0.1"
NOTE_DATE = "2026-08-01"

TELLS_NOTE = (
    "Surface patterns worth pointing at in place-anchored imagery (dated note "
    f"{NOTE_VERSION}, {NOTE_DATE}): structures or terrain absent from, or "
    "inconsistent with, the mapped state of the named location; shoreline, road "
    "or ridge geometry that departs from surveyed geometry; shadows or sun "
    "position implausible for the stated place and season; vegetation or "
    "climate cues inconsistent with the location; repeated texture tiling in "
    "terrain or foliage; signage, street furniture or architectural styles "
    "foreign to the region; seams, resolution shifts or lighting boundaries "
    "where generated content meets photographic content. Each such pattern is "
    "an OBSERVATION to hand to a human with a named referent to check it "
    "against; none of them is a conclusion."
)
