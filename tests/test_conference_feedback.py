import asyncio
import json
from dataclasses import replace
from types import SimpleNamespace

import httpx
import pytest

from app import diffusion, narrate
from app.annotation import lane
from app.providers import claude, gemini, openai


def report():
    return {
        "meta": {"filename": "sample.png"},
        "consensus": {"overall_verdict": "synthetic_likely", "overall_rating": 90},
        "providers": [
            {"id": name, "name": name, "kind": "vision", "status": "ok",
             "rating": 90, "verdict": "synthetic_likely"}
            for name in ["claude", "openai", "gemini"]
        ] + [{"id": "local", "name": "Local forensics", "kind": "forensic",
              "status": "ok", "rating": 85, "verdict": "synthetic_likely"}],
        "second_opinion_gemini": "Researcher pasted a watermark result.",
    }


def summary(rep):
    return narrate.verdict_map_summary(diffusion.graph_to_json(diffusion.verdict_map(rep)))


def test_caption_counts_only_visual_llms_and_includes_unscored_note():
    text = summary(report())["caption"]
    assert text.startswith("Three visual LLMs assessed this item: three lean synthetic, zero lean authentic.")
    assert "Local forensics" in text
    assert "Gemini SynthID (not scored)" in text
    assert "recorded separately from the visual LLM count and combined assessment" in text
    assert "Four visual" not in text


def test_scored_notes_are_separate_and_removed_notes_disappear():
    rep = report()
    rep.update(second_opinion_gemini_score=99, second_opinion_chatgpt="Another note",
               second_opinion_chatgpt_score=10)
    text = summary(rep)["caption"]
    assert "Gemini SynthID (note score 99/100)" in text
    assert "OpenAI second opinion (note score 10/100)" in text
    assert "rating is 90" in text
    del rep["second_opinion_gemini"]
    assert "Gemini SynthID" not in summary(rep)["caption"]


def test_missing_rating_is_not_rendered_as_minus_one():
    rep = report()
    rep["consensus"]["overall_rating"] = None
    assert "rating is" not in summary(rep)["caption"]


def test_batch_caption_and_json_preserve_note_presence():
    records = [report(), report()]
    records[1]["meta"]["filename"] = "other.png"
    data = diffusion.graph_to_json(diffusion.graph_for_payload("batch", records))
    assert all(n["second_opinions"] for n in data["nodes"])
    caption = narrate.graph_summary(data, "batch")["caption"]
    assert "second opinions accompany two item(s)" in caption


def test_text_only_and_failed_models_are_not_visual_assessments():
    rep = report()
    for provider in rep["providers"][:3]:
        provider["kind"] = "analysis"
    rep["providers"][0]["status"] = "error"
    assert summary(rep)["headline"].startswith("Two text-analysis LLMs")
    rep["providers"] = []
    assert summary(rep)["headline"].startswith("No successful")


@pytest.mark.parametrize("model,effort,cap", [
    ("gpt-6-astra", "low", 8192), ("gpt-6-astra-2026-09-03", "low", 8192),
    ("gpt-6-sol", "none", 2048), ("gpt-5.5", "none", 2048), ("gpt-4o", None, 1024),
])
def test_openai_settings(model, effort, cap):
    body = {}
    openai._tune_reasoning(body, model)
    assert body.get("reasoning_effort") == effort
    assert openai._completion_budget(model) == cap


@pytest.mark.parametrize("model,effort,cap", [
    ("gemini-3.8-flash", "low", 8192), ("gemini-3.7-flash", "low", 8192),
    ("gemini-3.5-flash", "minimal", 2048),
])
def test_google_settings(model, effort, cap):
    cfg = gemini.generation_config(model, 2048)
    assert cfg["thinkingConfig"] == {"thinkingLevel": effort}
    assert cfg["maxOutputTokens"] == cap
    assert "temperature" not in cfg
    assert cfg["responseMimeType"] == "application/json"
    audio = gemini.generation_config(model, 8192, json_out=False)
    assert "responseMimeType" not in audio


def test_opus_budget_is_family_specific():
    body = {"max_tokens": 1024}
    claude.tune_request(body, "claude-opus-5-5")
    assert body == {"max_tokens": 8192, "output_config": {"effort": "low"}}
    old = {"max_tokens": 1024}
    claude.tune_request(old, "claude-opus-4-8")
    assert old == {"max_tokens": 1024}


@pytest.mark.parametrize("provider,model,host", [
    (claude, "claude-opus-5-5", "api.anthropic.com"),
    (openai, "gpt-6-astra", "api.openai.com"),
    (gemini, "gemini-3.8-flash", "generativelanguage.googleapis.com"),
])
def test_current_provider_image_text_and_annotation_contracts(monkeypatch, provider, model, host):
    settings = replace(provider.settings, anthropic_key="fixture", openai_key="fixture",
                       google_key="fixture", disable_anthropic=False, disable_openai=False,
                       disable_google=False, anthropic_model="claude-opus-5-5",
                       openai_model="gpt-6-astra", google_model="gemini-3.8-flash")
    monkeypatch.setattr(provider, "settings", settings)
    monkeypatch.setattr(lane, "settings", settings)
    media = SimpleNamespace(filename="fixture.png", vision_mime="image/png", vision_b64="AA==",
                            vision_data_url="data:image/png;base64,AA==")
    calls = []
    answer = json.dumps({"synthetic_rating": 50, "verdict": "inconclusive", "tells": []})

    def handler(req):
        assert req.url.host == host
        body = json.loads(req.content)
        calls.append(body)
        if provider is claude:
            assert body["model"] == model
            assert body["output_config"] == {"effort": "low"}
            assert body["max_tokens"] == 8192
            response = {"content": [{"type": "thinking", "thinking": "not an answer"},
                                    {"type": "text", "text": answer}]}
        elif provider is openai:
            assert body["model"] == model
            assert body["reasoning_effort"] == "low"
            assert body["max_completion_tokens"] == 8192
            response = {"choices": [{"message": {"content": answer}}]}
        else:
            assert model in str(req.url)
            assert body["generationConfig"]["thinkingConfig"] == {"thinkingLevel": "low"}
            assert body["generationConfig"]["maxOutputTokens"] == 8192
            response = {"candidates": [{"content": {"parts": [{"text": answer}]}}]}
        return httpx.Response(200, json=response)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            image = await provider.run(client, media, "", "general")
            text = await provider.run_text(client, "sample transcript", "", "general")
            assert image.status.value == text.status.value == "ok"
            assert image.model == text.model == model
            assert text.kind.value == "analysis"
            annotation, error = await getattr(lane, "_ask_" + provider.ID)(client, media, "fixture")
            assert error is None and annotation == answer

    asyncio.run(run())
    assert len(calls) == 3
