import asyncio
import hashlib
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI

from app import conference

PASSWORD = "fixture-presenter-password-only"


@pytest.fixture
def profile(tmp_path):
    original = tmp_path / "example.png"
    original.write_bytes(b"local fixture")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"examples": [{"filename": original.name, "sha256": hashlib.sha256(original.read_bytes()).hexdigest()}]}))
    settings = SimpleNamespace(delivery_profile="conference", conference_password=PASSWORD,
        conference_manifest=str(manifest), conference_max_runs=2, conference_timeout=1, enable_vaccine_lens=False)
    calls = []
    async def analyse(ing, caption, mode):
        calls.append((ing, caption, mode))
        return {"meta": {"filename": original.name}, "consensus": {"overall_rating": 42}}
    app = FastAPI()
    conference.install(app, settings, tmp_path, lambda raw, name, mime: (raw, name), analyse, lambda raw, ing: "fixture")
    @app.post("/api/analyse")
    async def forbidden():
        raise AssertionError("Upload route reached")
    return app, settings, calls, original, manifest


def request(profile, path, method="GET", **kwargs):
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=profile[0]), base_url="http://test") as client:
            return await client.request(method, path, **kwargs)
    return asyncio.run(run())


def payload(name="example.png", **updates):
    return {"example_id": name, "mode": "general", "consent_to_providers": True, **updates}


def test_auth_before_upload_body_or_handlers(profile):
    response = request(profile, "/api/analyse", "POST", content=b"new visitor media")
    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Basic")
    assert profile[2] == []
    assert request(profile, "/healthz").status_code == 200


@pytest.mark.parametrize("path", ["/api/analyse", "/api/analyse/deep", "/api/annotate", "/api/audio/assess",
    "/api/suno/check", "/api/preview/slides", "/api/frame", "/api/opinion-score", "/api/corpus/file"])
def test_other_input_and_inference_routes_rejected(profile, path):
    assert request(profile, path, "POST", auth=("presenter", PASSWORD), json={}).status_code == 403
    assert profile[2] == []


def test_requires_exact_allowlisted_original_and_consent(profile):
    auth = ("presenter", PASSWORD)
    for value in ("../example.png", "file:///tmp/example.png", "https://example.com/image.png", "missing.png"):
        assert request(profile, "/api/conference/analyse", "POST", auth=auth, json=payload(value)).status_code == 404
    for value in (payload(consent_to_providers=False), payload(file="bytes"), payload(caption="audience text")):
        assert request(profile, "/api/conference/analyse", "POST", auth=auth, json=value).status_code == 400
    assert profile[2] == []
    response = request(profile, "/api/conference/analyse", "POST", auth=auth, json=payload())
    assert response.status_code == 200
    assert response.json()["consensus"]["overall_rating"] == 42
    assert profile[2] == [((b"local fixture", "example.png"), "", "general")]
    assert not (profile[3].parent / "dev_runs").exists()


def test_changed_original_rejected_before_provider(profile):
    profile[3].write_bytes(b"replacement bytes")
    assert request(profile, "/api/conference/analyse", "POST", auth=("presenter", PASSWORD), json=payload()).status_code == 409
    assert profile[2] == []


def test_manifest_rejects_symlink_duplicate_and_missing_hash(profile):
    app, settings, calls, original, manifest = profile
    link = original.parent / "linked.png"
    link.symlink_to(original)
    digest = hashlib.sha256(original.read_bytes()).hexdigest()
    for entries in ([{"filename": link.name, "sha256": digest}], [{"filename": original.name}],
                    [{"filename": original.name, "sha256": digest}] * 2):
        manifest.write_text(json.dumps({"examples": entries}))
        assert request(profile, "/healthz").status_code == 503
    assert calls == []


def test_limits_json_origin_and_analysis_allowance(profile):
    auth = ("presenter", PASSWORD)
    assert request(profile, "/api/conference/analyse", "POST", auth=auth, content=b"file", headers={"content-type": "multipart/form-data"}).status_code == 415
    assert request(profile, "/api/conference/analyse", "POST", auth=auth, json=payload(), headers={"origin": "https://another.example"}).status_code == 403
    assert request(profile, "/api/conference/analyse", "POST", auth=auth, content=b" " * 4097, headers={"content-type": "application/json"}).status_code == 413
    for _ in range(2):
        assert request(profile, "/api/conference/analyse", "POST", auth=auth, json=payload()).status_code == 200
    assert request(profile, "/api/conference/analyse", "POST", auth=auth, json=payload()).status_code == 429
    assert len(profile[2]) == 2


def test_missing_password_fails_closed(profile):
    profile[1].conference_password = ""
    assert request(profile, "/healthz").status_code == 503
    assert request(profile, "/api/conference/analyse", "POST", json=payload()).status_code == 503


def test_concurrent_run_and_timeout_release_slot(tmp_path):
    async def run():
        original = tmp_path / "sample.png"; original.write_bytes(b"fixture")
        manifest = tmp_path / "manifest.json"
        manifest.write_text(json.dumps({"examples": [{"filename": original.name, "sha256": hashlib.sha256(b"fixture").hexdigest()}]}))
        settings = SimpleNamespace(delivery_profile="conference", conference_password=PASSWORD,
            conference_manifest=str(manifest), conference_max_runs=3, conference_timeout=.2, enable_vaccine_lens=False)
        entered = asyncio.Event()
        async def slow(*args):
            entered.set()
            await asyncio.sleep(2)
        app = FastAPI(); conference.install(app, settings, tmp_path, lambda *args: None, slow, lambda *args: None)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", auth=("presenter", PASSWORD)) as client:
            first = asyncio.create_task(client.post("/api/conference/analyse", json=payload("sample.png")))
            await entered.wait()
            assert (await client.post("/api/conference/analyse", json=payload("sample.png"))).status_code == 409
            assert (await first).status_code == 504
            await asyncio.sleep(0)
            assert app.state.conference_runs == {"busy": False, "attempts": 1}
    asyncio.run(run())


def test_timeout_keeps_native_conversion_slot_and_skips_provider(tmp_path):
    import threading
    async def run():
        original = tmp_path / "sample.png"; original.write_bytes(b"fixture")
        manifest = tmp_path / "manifest.json"
        manifest.write_text(json.dumps({"examples": [{"filename": original.name, "sha256": hashlib.sha256(b"fixture").hexdigest()}]}))
        settings = SimpleNamespace(delivery_profile="conference", conference_password=PASSWORD,
            conference_manifest=str(manifest), conference_max_runs=3, conference_timeout=.05, enable_vaccine_lens=False)
        release = threading.Event()
        calls = []
        def convert(*args):
            release.wait(2)
        async def analyse(*args):
            calls.append(args)
        app = FastAPI(); conference.install(app, settings, tmp_path, convert, analyse, lambda *args: None)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", auth=("presenter", PASSWORD)) as client:
            try:
                assert (await client.post("/api/conference/analyse", json=payload("sample.png"))).status_code == 504
                assert app.state.conference_runs["busy"] is True
                assert (await client.post("/api/conference/analyse", json=payload("sample.png"))).status_code == 409
            finally:
                release.set()
            for _ in range(100):
                if not app.state.conference_runs["busy"]: break
                await asyncio.sleep(.01)
            assert app.state.conference_runs["busy"] is False
            assert calls == []
    asyncio.run(run())
