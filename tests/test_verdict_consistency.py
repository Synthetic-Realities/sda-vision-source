"""Directional agreement must respect explicit provider uncertainty."""
import copy

import pytest

from app.aggregate import aggregate, aggregate_frames
from app.providers.base import vision_result_from_json
from app.schema import Kind, ProviderResult, Status, Verdict


def row(name, rating, verdict=Verdict.INCONCLUSIVE, status=Status.OK, kind=Kind.VISION):
    return ProviderResult(name, name, kind, status, rating=rating, verdict=verdict,
                          raw={"synthetic_rating": rating, "verdict": verdict.value})


def agreement(result):
    return next(step for step in result["decision_trace"] if step["step"] == "model_agreement")


@pytest.mark.parametrize("kind", [Kind.VISION, Kind.TEXT])
@pytest.mark.parametrize("rating", [0, 15, 30, 31, 45, 59, 60, 85, 100])
@pytest.mark.parametrize("verdict", [Verdict.INCONCLUSIVE, Verdict.NOT_APPLICABLE])
def test_undecided_replies_cannot_create_directional_agreement(kind, rating, verdict):
    rows = [row("a", rating, verdict, kind=kind), row("b", rating, verdict, kind=kind)]
    before = copy.deepcopy(rows)
    result = aggregate(rows, "", "general")
    assert result["overall_verdict"] == "inconclusive"
    assert result["overall_rating"] == rating
    assert result["confidence"] == "low"
    trace = agreement(result)
    assert trace["synthetic"] == trace["authentic"] == []
    assert trace["uncertain"] == ["a", "b"]
    assert result["supporting"] == []
    assert {e["name"] for e in result["not_decisive"]} == {"a", "b"}
    assert rows == before


@pytest.mark.parametrize("verdict,rating", [
    (Verdict.AUTHENTIC_LIKELY, 90), (Verdict.AUTHENTIC_LIKELY, 45),
    (Verdict.SYNTHETIC_LIKELY, 10), (Verdict.SYNTHETIC_LIKELY, 45),
    (Verdict.PARTIALLY_SYNTHETIC, 10),
])
def test_conflicting_verdict_and_rating_stay_undecided(verdict, rating):
    result = aggregate([row("a", rating, verdict), row("b", rating, verdict)], "", "general")
    assert result["overall_verdict"] == "inconclusive"
    assert agreement(result)["uncertain"] == ["a", "b"]
    assert result["supporting"] == []


def test_document_frame_regression_retains_three_models_and_ratings():
    rows = [row("claude", 58), row("openai", 15), row("gemini", 25, Verdict.AUTHENTIC_LIKELY)]
    result = aggregate(rows, "", "general")
    assert result["overall_verdict"] == "inconclusive"
    assert result["overall_rating"] == 25
    assert agreement(result)["authentic"] == ["gemini"]
    assert agreement(result)["uncertain"] == ["claude", "openai"]
    assert result["agreement"] != "single model"


@pytest.mark.parametrize("verdict,ratings", [
    (Verdict.AUTHENTIC_LIKELY, [20, 30, 0]),
    (Verdict.SYNTHETIC_LIKELY, [60, 90, 100]),
])
def test_only_matching_votes_support_direction_and_confidence(verdict, ratings):
    rows = [row("a", ratings[0], verdict), row("b", ratings[1], verdict), row("undecided", ratings[2])]
    result = aggregate(rows, "", "general")
    assert result["overall_verdict"] == verdict.value
    assert result["confidence"] == "medium"  # Two agreeing models, not three.
    assert {e["name"] for e in result["supporting"]} == {"a", "b"}
    assert {e["name"] for e in result["not_decisive"]} == {"undecided"}
    assert agreement(result)["uncertain"] == ["undecided"]


def test_explicit_partial_assessments_keep_the_existing_middle_band():
    result = aggregate([row("a", 45, Verdict.PARTIALLY_SYNTHETIC),
                        row("b", 50, Verdict.PARTIALLY_SYNTHETIC), row("c", 55)], "", "general")
    assert result["overall_verdict"] == "partially_synthetic"
    assert result["confidence"] == "low"
    assert {e["name"] for e in result["supporting"]} == {"a", "b"}
    assert {e["name"] for e in result["not_decisive"]} == {"c"}


def test_conflicting_third_reply_is_visible_without_claiming_unanimity():
    result = aggregate([row("a", 20, Verdict.AUTHENTIC_LIKELY),
                        row("b", 25, Verdict.AUTHENTIC_LIKELY),
                        row("c", 45, Verdict.SYNTHETIC_LIKELY)], "", "general")
    assert result["overall_verdict"] == "authentic_likely"
    assert agreement(result)["uncertain"] == ["c"]
    assert result["not_decisive"][0]["verdict"] == "synthetic_likely"
    assert "none flag synthetic" not in result["explanation"]


@pytest.mark.parametrize("status", [Status.ERROR, Status.TIMEOUT, Status.UNCONFIGURED, Status.DISABLED, Status.PENDING])
def test_failed_or_unchecked_directional_reply_cannot_corroborate(status):
    result = aggregate([row("a", 90, Verdict.SYNTHETIC_LIKELY),
                        row("b", 95, Verdict.SYNTHETIC_LIKELY, status)], "", "general")
    assert result["overall_verdict"] == "inconclusive"
    assert result["agreement"] == "single model"


def test_absent_rating_and_empty_panel_remain_distinct_from_usable_uncertainty():
    for rows in ([], [row("a", None)]):
        result = aggregate(rows, "", "general")
        assert result["overall_verdict"] == "inconclusive"
        assert result["overall_rating"] is None
        assert result["agreement"] == "no models"
    result = aggregate([row("a", 10), row("b", 90)], "", "general")
    assert result["overall_rating"] == 50
    assert result["agreement"] != "no models"


def test_local_forensics_cannot_turn_uncertainty_into_a_vote():
    result = aggregate([row("a", 95), row("b", 85),
                        row("local", 95, Verdict.SYNTHETIC_LIKELY, kind=Kind.FORENSIC)], "", "general")
    assert result["overall_verdict"] == "inconclusive"
    assert result["overall_rating"] == 90
    assert result["supporting"] == []


@pytest.mark.parametrize("authentic_frames", [1, 2])
def test_document_minorities_keep_inconclusive_frames_and_mean_rating(authentic_frames):
    frames = []
    for i in range(4):
        verdict = Verdict.AUTHENTIC_LIKELY if i < authentic_frames else Verdict.INCONCLUSIVE
        frames.append(aggregate([row("a", 15, verdict), row("b", 25, Verdict.AUTHENTIC_LIKELY),
                                 row("c", 45)], "", "general"))
    result = aggregate_frames(frames, [], "", "general")
    assert result["overall_verdict"] == "inconclusive"
    assert result["overall_rating"] == 25
    trace = result["decision_trace"][0]
    assert trace["frames"] == 4 and trace["authentic_frames"] == authentic_frames


def test_document_supporting_lists_use_the_same_rule():
    providers = [row("a", 20, Verdict.AUTHENTIC_LIKELY), row("b", 25, Verdict.AUTHENTIC_LIKELY), row("c", 5)]
    frames = [aggregate(providers, "", "general")] * 4
    result = aggregate_frames(frames, providers, "", "general")
    assert result["overall_verdict"] == "authentic_likely"
    assert {e["name"] for e in result["supporting"]} == {"a", "b"}
    assert {e["name"] for e in result["not_decisive"]} == {"c"}


@pytest.mark.parametrize("rating", [10, 50, 90])
def test_explicit_provider_json_uncertainty_survives_parsing_and_aggregation(rating):
    data = {"synthetic_rating": rating, "verdict": "inconclusive", "tells": []}
    rows = [vision_result_from_json(provider_id=name, name=name, model="fixture",
                                   data=data, raw_text="fixture", latency_ms=12)
            for name in ("a", "b")]
    result = aggregate(rows, "", "general")
    assert result["overall_verdict"] == "inconclusive"
    assert result["overall_rating"] == rating
    assert all(r.raw == data and r.verdict == Verdict.INCONCLUSIVE for r in rows)
