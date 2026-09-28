"""Download official public trust lists for review, never install or approve them.

Only fixed GitHub endpoints are contacted. No media, credentials or local filenames
are sent. Runtime C2PA validation remains offline and unchanged.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx
from cryptography import x509
from cryptography.hazmat.primitives import hashes

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "c2pa-org/conformance-public"
LISTS = {"signer": "C2PA-TRUST-LIST.pem", "timestamp": "C2PA-TSA-TRUST-LIST.pem"}


def prepare(root: Path = ROOT, *, transport=None) -> Path:
    with httpx.Client(timeout=30, follow_redirects=False, transport=transport) as client:
        response = client.get(f"https://api.github.com/repos/{REPOSITORY}/commits/main")
        response.raise_for_status()
        revision = response.json()["sha"]
        if not isinstance(revision, str) or not re.fullmatch(r"[0-9a-f]{40}", revision):
            raise ValueError("Invalid source revision.")
        files, records = {}, []
        for role, filename in LISTS.items():
            url = f"https://raw.githubusercontent.com/{REPOSITORY}/{revision}/trust-list/{filename}"
            response = client.get(url)
            response.raise_for_status()
            raw = response.content
            if len(raw) > 2_000_000 or b"PRIVATE KEY" in raw:
                raise ValueError("Unexpected public trust-list content.")
            certs = x509.load_pem_x509_certificates(raw)
            if not certs:
                raise ValueError("Empty public trust list.")
            raw.decode("ascii")
            files[filename] = raw
            records.append({"role": role, "file": filename, "source_url": url,
                            "sha256": hashlib.sha256(raw).hexdigest(),
                            "certificates": [{"subject": c.subject.rfc4514_string(),
                                              "issuer": c.issuer.rfc4514_string(),
                                              "sha256": c.fingerprint(hashes.SHA256()).hex(),
                                              "valid_until": c.not_valid_after_utc.isoformat()}
                                             for c in certs]})
    now = datetime.now(timezone.utc)
    output = root / ".review-cache" / "c2pa-trust-review" / now.strftime("%Y%m%dT%H%M%S%fZ")
    if not output.resolve().is_relative_to(root.resolve()):
        raise ValueError("Output must stay inside this project.")
    output.mkdir(parents=True, exist_ok=False)
    anchors = b"\n".join(files.values())
    digest = hashlib.sha256(anchors).hexdigest()
    files["anchors.pem"] = anchors
    for name, raw in files.items():
        (output / name).write_bytes(raw)
    review = {"status": "UNAPPROVED_REVIEW_ONLY", "retrieved_at": now.isoformat(),
              "source_revision": revision, "lists": records, "combined_sha256": digest,
              "delivery": "HTTPS from official repository, pinned to a commit; no independent list-signature verification performed",
              "runtime_policy_changed": False, "legacy_itl_included": False}
    policy = {"schema_version": 1, "approved": False,
              "label": "REVIEW REQUIRED: official C2PA signer and TSA snapshot",
              "source_url": f"https://github.com/{REPOSITORY}/tree/{revision}/trust-list",
              "reviewed_at": "", "valid_until": "", "reviewer": "",
              "trust_anchors": {"file": "anchors.pem", "sha256": digest}}
    for name, data in (("review.json", review), ("c2pa-policy.json", policy)):
        (output / name).write_text(json.dumps(data, indent=2) + "\n")
    return output


if __name__ == "__main__":
    print(prepare())
