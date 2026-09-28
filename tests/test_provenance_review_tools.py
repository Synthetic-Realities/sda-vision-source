import hashlib
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

from app.c2pa_trust import load_policy
from app.schema import Kind, ProviderResult
from scripts.inspect_provenance import inspect
from scripts.prepare_c2pa_trust_review import prepare


def public_test_certificate():
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Test root only")])
    now = datetime.now(timezone.utc)
    return (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now - timedelta(days=1))
            .not_valid_after(now + timedelta(days=1)).sign(key, hashes.SHA256())
            .public_bytes(serialization.Encoding.PEM))


def test_public_snapshot_is_pinned_unapproved_and_never_installed(tmp_path):
    cert = public_test_certificate()
    requests = []
    def request(req):
        requests.append(req)
        assert req.method == "GET" and not req.content
        assert "authorization" not in req.headers
        if req.url.host == "api.github.com":
            return httpx.Response(200, json={"sha": "a" * 40})
        assert req.url.host == "raw.githubusercontent.com"
        assert "/" + "a" * 40 + "/" in req.url.path
        return httpx.Response(200, content=cert)
    output = prepare(tmp_path, transport=httpx.MockTransport(request))
    assert len(requests) == 3
    review = json.loads((output / "review.json").read_text())
    policy = json.loads((output / "c2pa-policy.json").read_text())
    assert not policy["approved"] and not policy["reviewed_at"]
    assert not (tmp_path / "trust-store").exists()
    assert {r["role"] for r in review["lists"]} == {"signer", "timestamp"}
    assert hashlib.sha256((output / "anchors.pem").read_bytes()).hexdigest() == review["combined_sha256"]
    assert load_policy(output / "c2pa-policy.json", root=tmp_path)[1]["approved"] is False


def test_local_inspector_preserves_input_and_never_calls_vision(monkeypatch, tmp_path):
    path = tmp_path / "test.mp4"
    path.write_bytes(b"test media")
    seen = []
    def run(media):
        seen.append(media)
        return ProviderResult("c2pa", "C2PA", Kind.PROVENANCE)
    monkeypatch.setattr("scripts.inspect_provenance.c2pa_provider.run", run)
    output = inspect(path, root=tmp_path)
    report = json.loads(output.read_text())
    assert report["input_sha256"] == hashlib.sha256(b"test media").hexdigest()
    assert path.read_bytes() == b"test media"
    assert len(seen) == 1 and seen[0].vision_b64 == ""
    assert output.is_relative_to(tmp_path / ".review-cache")


def test_inspector_rejects_outside_input_before_reading(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    outside = tmp_path / "private.mp4"
    outside.write_bytes(b"not permitted")
    with pytest.raises(ValueError, match="inside this project"):
        inspect(outside, root=root)
    link = root / "escape.mp4"
    link.symlink_to(outside)
    with pytest.raises(ValueError, match="inside this project"):
        inspect(link, root=root)


def test_review_anchors_require_exact_hash(monkeypatch, tmp_path):
    path = tmp_path / "test.mp4"
    path.write_bytes(b"test media")
    cache = tmp_path / ".review-cache"
    cache.mkdir()
    anchors = cache / "anchors.pem"
    anchors.write_bytes(public_test_certificate())
    monkeypatch.setattr("scripts.inspect_provenance.c2pa_provider.run",
                        lambda media: ProviderResult("c2pa", "C2PA", Kind.PROVENANCE))
    with pytest.raises(ValueError, match="SHA-256 mismatch"):
        inspect(path, review_anchors=anchors, review_sha256="0" * 64, root=tmp_path)
