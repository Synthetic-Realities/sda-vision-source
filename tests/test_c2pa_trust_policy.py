import hashlib
import json
from datetime import datetime, timedelta, timezone

import pytest

from app.c2pa_trust import load_policy
from app.providers import c2pa_provider as provider
from app.schema import Verdict


def policy_fixture(tmp_path):
    pem = b"-----BEGIN CERTIFICATE-----\nfixture-not-a-real-root\n-----END CERTIFICATE-----\n"
    (tmp_path / "anchors.pem").write_bytes(pem)
    now = datetime.now(timezone.utc)
    data = {"schema_version": 1, "approved": True, "label": "Unit test only",
            "source_url": "https://example.invalid/test-roots",
            "reviewed_at": (now - timedelta(days=1)).isoformat(),
            "valid_until": (now + timedelta(days=1)).isoformat(),
            "trust_anchors": {"file": "anchors.pem", "sha256": hashlib.sha256(pem).hexdigest()}}
    path = tmp_path / "policy.json"
    path.write_text(json.dumps(data))
    return path, data


def test_no_policy_disables_overrides(tmp_path):
    settings, meta = load_policy(tmp_path / "absent.json", root=tmp_path)
    assert settings == {} and meta["approved"] is False


def test_reviewed_snapshot_is_pinned(tmp_path):
    path, data = policy_fixture(tmp_path)
    settings, meta = load_policy(path, root=tmp_path)
    assert meta["approved"] is True
    assert meta["anchors_sha256"] == data["trust_anchors"]["sha256"]
    assert "allowed_list" not in settings and "user_anchors" not in settings


@pytest.mark.parametrize("mutation", ["checksum", "expired", "future", "path", "unapproved", "malformed"])
def test_invalid_policy_fails_closed(tmp_path, mutation):
    path, data = policy_fixture(tmp_path)
    if mutation == "checksum":
        data["trust_anchors"]["sha256"] = "0" * 64
    elif mutation == "expired":
        data["valid_until"] = "2000-01-01T00:00:00Z"
    elif mutation == "future":
        data["reviewed_at"] = "2999-01-01T00:00:00Z"
    elif mutation == "path":
        data["trust_anchors"]["file"] = "../outside.pem"
    elif mutation == "unapproved":
        data["approved"] = False
    else:
        data = []
    path.write_text(json.dumps(data))
    settings, meta = load_policy(path, root=tmp_path)
    assert settings == {} and meta["approved"] is False


def test_settings_object_passed_to_reader_is_the_configured_one(monkeypatch):
    import c2pa
    seen = {}
    class Settings:
        def __init__(self, config=None):
            self.config = config
        @classmethod
        def from_dict(cls, config):
            return cls(config)
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
    class Context(Settings):
        def __init__(self, *, settings):
            seen["settings"] = settings.config
    class Reader(Settings):
        def __init__(self, mime, stream, *, context):
            pass
        def json(self):
            return "{}"
    monkeypatch.setattr(c2pa, "Settings", Settings)
    monkeypatch.setattr(c2pa, "Context", Context)
    monkeypatch.setattr(c2pa, "Reader", Reader)
    assert provider._read_manifest_json(b"fixture", "image/jpeg") == "{}"
    cfg = seen["settings"]
    assert cfg["verify"]["remote_manifest_fetch"] is False
    assert cfg["verify"]["ocsp_fetch"] is False
    assert cfg["verify"]["verify_trust"] is True
    assert cfg["verify"]["verify_timestamp_trust"] is True
    assert cfg["core"]["allowed_network_hosts"] == []


def test_sdk_trusted_without_reviewed_policy_is_not_decisive():
    store = {"active_manifest": "a", "manifests": {"a": {"assertions": [{
        "label": "c2pa.actions", "data": {"actions": [{
            "digitalSourceType": provider._AI_SOURCE}]}}]}},
        "validation_state": "Trusted", "validation_results": {"activeManifest": {"success": [], "failure": []}}}
    row = provider._interpret(store, 0)
    assert row.raw["validation"]["trust"] == "trusted"
    assert row.raw["validation"]["complete"] is False
    assert row.verdict == Verdict.INCONCLUSIVE
