import io

import pytest

from app.aggregate import aggregate
from app.media import load_media
from app.providers import c2pa_provider as provider
from app.schema import Kind, ProviderResult, Verdict


def manifest(*sources, state="Trusted", failures=()):
    return {
        "active_manifest": "active",
        "manifests": {"active": {
            "claim_generator": "Example signer",
            "assertions": [{"label": "c2pa.actions.v2", "data": {"actions": [
                {"digitalSourceType": provider._SOURCE_PREFIX + source} for source in sources
            ]}}],
        }},
        "validation_state": state,
        "validation_results": {"activeManifest": {
            "success": [{"code": "claimSignature.validated"}, {"code": "assertion.dataHash.match"}],
            "informational": [], "failure": [{"code": c} for c in failures],
        }},
    }


@pytest.mark.parametrize("code", [
    "assertion.hashedURI.mismatch", "assertion.dataHash.mismatch",
    "claimSignature.mismatch", "signingCredential.expired", "assertion.missing",
])
def test_validation_failures_cannot_override_even_without_word_error(code):
    row = provider._interpret(manifest("trainedalgorithmicmedia", failures=[code]), 0)
    assert row.verdict == Verdict.INCONCLUSIVE
    assert row.raw["validation"]["integrity"] == "invalid"
    result = aggregate([row], "", "general")
    assert result["overall_verdict"] == "inconclusive"
    assert "validation failed" in result["not_decisive"][0]["note"]


@pytest.mark.parametrize("state", ["Valid", "Invalid", None, "Unexpected"])
def test_only_explicit_trusted_complete_validation_can_override(state):
    row = provider._interpret(manifest("trainedalgorithmicmedia", state=state), 0)
    assert row.verdict == Verdict.INCONCLUSIVE
    assert aggregate([row], "", "general")["overall_rating"] is None


def test_untrusted_is_distinct_from_tampered():
    row = provider._interpret(manifest("trainedalgorithmicmedia", state="Valid",
                                      failures=["signingCredential.untrusted"]), 0)
    assert row.raw["validation"]["integrity"] == "valid"
    assert row.raw["validation"]["trust"] == "untrusted"
    assert row.verdict == Verdict.INCONCLUSIVE
    assert row.rating is None


@pytest.mark.parametrize(("sources", "verdict"), [
    (["trainedalgorithmicmedia"], Verdict.SYNTHETIC_LIKELY),
    (["compositewithtrainedalgorithmicmedia"], Verdict.PARTIALLY_SYNTHETIC),
    (["digitalcapture", "trainedalgorithmicmedia"], Verdict.PARTIALLY_SYNTHETIC),
    (["digitalcapture", "compositewithtrainedalgorithmicmedia"], Verdict.PARTIALLY_SYNTHETIC),
    (["digitalcapture"], Verdict.AUTHENTIC_LIKELY),
    (["nottrainedalgorithmicmedia"], Verdict.INCONCLUSIVE),
    ([], Verdict.INCONCLUSIVE),
])
def test_exact_source_types_and_mixed_history(sources, verdict):
    row = provider._interpret(manifest(*sources), 0, policy_approved=True)
    assert row.verdict == verdict
    assert row.rating is None
    combined = aggregate([row], "", "general")
    if verdict in (Verdict.SYNTHETIC_LIKELY, Verdict.PARTIALLY_SYNTHETIC):
        assert combined["overall_verdict"] == verdict.value
        assert combined["overall_rating"] is None
    else:
        assert combined["overall_verdict"] == "inconclusive"


def test_generator_name_is_not_ai_generation_evidence():
    store = manifest()
    store["manifests"]["active"]["claim_generator"] = "Adobe Firefly OpenAI"
    assert provider._interpret(store, 0).verdict == Verdict.INCONCLUSIVE


@pytest.mark.parametrize("mutation", ["active", "results", "state", "statuses"])
def test_missing_or_malformed_validation_fails_closed(mutation):
    store = manifest("trainedalgorithmicmedia")
    if mutation == "active":
        store["active_manifest"] = "missing"
    elif mutation == "results":
        store["validation_results"] = []
    elif mutation == "state":
        del store["validation_state"]
    else:
        store["validation_results"]["activeManifest"]["failure"] = "bad"
    assert provider._interpret(store, 0).verdict == Verdict.INCONCLUSIVE


def test_ingredient_failure_prevents_override():
    store = manifest("trainedalgorithmicmedia")
    store["validation_results"]["ingredientDeltas"] = [{
        "ingredientAssertionURI": "example",
        "validationDeltas": {"failure": [{"code": "assertion.dataHash.mismatch"}]},
    }]
    assert provider._interpret(store, 0).verdict == Verdict.INCONCLUSIVE


def test_old_or_untrusted_provider_rows_cannot_bypass_aggregate_guard():
    row = ProviderResult("c2pa", "C2PA", Kind.PROVENANCE, rating=95,
                         verdict=Verdict.SYNTHETIC_LIKELY)
    assert aggregate([row], "", "general")["overall_verdict"] == "inconclusive"
    row.raw["validation"] = {"integrity": "valid", "trust": "trusted", "complete": True,
                             "failure_codes": ["assertion.dataHash.mismatch"]}
    assert aggregate([row], "", "general")["overall_verdict"] == "inconclusive"


def _jpeg_fixture():
    from PIL import Image
    output = io.BytesIO()
    Image.new("RGB", (40, 40), "blue").save(output, format="JPEG")
    return output.getvalue()


def _signed_fixture():
    """Generate disposable in-memory signing keys; no research media or trust list."""
    from datetime import datetime, timedelta, timezone
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID
    c2pa = pytest.importorskip("c2pa")
    root_key, key = (ec.generate_private_key(ec.SECP256R1()) for _ in range(2))
    root_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "SDA temporary test root")])
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "SDA temporary test signer")])
    now = datetime.now(timezone.utc)

    def certificate(subject, issuer, public_key, signing_key, ca):
        builder = (x509.CertificateBuilder().subject_name(subject).issuer_name(issuer)
                   .public_key(public_key).serial_number(x509.random_serial_number())
                   .not_valid_before(now - timedelta(days=1)).not_valid_after(now + timedelta(days=1))
                   .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True)
                   .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False,
                       key_encipherment=False, data_encipherment=False, key_agreement=False,
                       key_cert_sign=ca, crl_sign=ca, encipher_only=None, decipher_only=None), critical=True)
                   .add_extension(x509.SubjectKeyIdentifier.from_public_key(public_key), critical=False)
                   .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(signing_key.public_key()), critical=False))
        if not ca:
            builder = builder.add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.EMAIL_PROTECTION]), critical=False)
        return builder.sign(signing_key, hashes.SHA256()).public_bytes(serialization.Encoding.PEM)

    chain = (certificate(name, root_name, key.public_key(), root_key, False)
             + certificate(root_name, root_name, root_key.public_key(), root_key, True))
    private_key = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                    serialization.NoEncryption())
    info = c2pa.C2paSignerInfo(b"es256", chain, private_key, None)
    document = {"claim_generator": "SDA test fixture", "assertions": [
        {"label": "c2pa.actions.v2", "data": {"actions": [{"action": "c2pa.created",
            "digitalSourceType": provider._SOURCE_PREFIX + "algorithmicMedia"}]}},
        {"label": "org.sda.fixture", "data": {"note": "SDA test assertion"}},
    ]}
    output = io.BytesIO()
    with c2pa.Signer.from_info(info) as signer, c2pa.Builder(document) as builder:
        builder.sign(signer, "image/jpeg", io.BytesIO(_jpeg_fixture()), output)
    return output.getvalue()


def test_real_sdk_tampering_is_detected_without_changing_fixture(tmp_path):
    original = _signed_fixture()
    path = tmp_path / "signed-test.jpg"
    path.write_bytes(original)
    baseline = provider.run(load_media(original, path.name))
    assert baseline.raw["validation"]["integrity"] == "valid"
    assert baseline.raw["validation"]["trust"] == "untrusted"
    assert b"SDA test assertion" in original
    tampered = original.replace(b"SDA test assertion", b"SDA test assertiox", 1)
    row = provider.run(load_media(tampered, path.name))
    assert row.raw["validation"]["integrity"] == "invalid"
    assert "assertion.hashedURI.mismatch" in row.raw["validation"]["failure_codes"]
    assert aggregate([row], "", "general")["overall_verdict"] == "inconclusive"
    assert row.raw["network_access"] is False
    import c2pa
    from importlib.metadata import version
    assert row.raw["sdk_version"] == version("c2pa-python")
    assert row.raw["native_sdk_version"] == c2pa.sdk_version()
    assert row.raw["specification_target"] == "2.4"
    assert path.read_bytes() == original


def test_unsigned_image_is_absent_not_invalid():
    row = provider.run(load_media(_jpeg_fixture(), "unsigned-test.jpg"))
    assert row.raw["validation"]["integrity"] == "absent"
    assert row.verdict == Verdict.INCONCLUSIVE
