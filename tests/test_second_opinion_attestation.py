"""Regression tests for the second-opinion fresh-session attestation.

The repo has no wider automated suite yet (one is a roadmap prerequisite for
the JOSS companion); these pin the pure export helpers so the tri-state
semantics cannot drift: absent renders as "not attested", never as "stale"
and never as "fresh".

Run from the repo root: .venv/bin/python -m pytest tests/
"""
from app.export import _fresh_label, _second_opinions


def test_fresh_label_tristate():
    assert _fresh_label(True) == "fresh session (attested)"
    assert _fresh_label(False) == "not a fresh session (researcher stated)"
    assert _fresh_label(None) == "not attested"


def test_second_opinions_carries_fresh_tristate():
    report = {
        "second_opinion_gemini": "Looks authentic to me.",
        "second_opinion_gemini_fresh_session": True,
        "second_opinion_chatgpt": "Likely synthetic.",
        # No attestation on the second note: absent must surface as None
        # (not attested), never coerce to False (explicitly declined).
    }
    ops = {o["label"]: o for o in _second_opinions(report)}
    assert ops["Gemini SynthID"]["fresh"] is True
    assert ops["OpenAI second opinion"]["fresh"] is None


def test_second_opinions_ignores_non_bool_fresh():
    report = {"second_opinion_gemini": "note", "second_opinion_gemini_fresh_session": "yes"}
    (op,) = _second_opinions(report)
    assert op["fresh"] is None


def test_old_record_without_fields_renders_not_attested():
    # Back-compat: a pre-attestation record with a note must render
    # "not attested" and must never raise.
    report = {"second_opinion_gemini": "an old pasted note"}
    (op,) = _second_opinions(report)
    assert _fresh_label(op["fresh"]) == "not attested"


def test_openai_completion_budget_guards_the_past_not_the_present():
    # Era guard polarity: only the documented legacy family (gpt-4*) gets its
    # documented 1,024 cap; current AND unknown future families inherit the
    # modern default, so a gpt-6 era cannot silently drop to the legacy cap.
    from app.providers.openai import _completion_budget
    assert _completion_budget("gpt-4o") == 1024
    assert _completion_budget("gpt-4o-mini") == 1024
    assert _completion_budget("gpt-5.5") == 2048
    assert _completion_budget("gpt-6") == 2048
