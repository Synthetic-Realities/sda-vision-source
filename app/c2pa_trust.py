"""Load a locally reviewed, checksum-pinned trust snapshot; never fetch anchors.

The policy file records an operator review, not a certification by this app.
Without it, SDK validation is informative and cannot override model results.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from .config import ROOT

POLICY_PATH = ROOT / "trust-store" / "c2pa-policy.json"


def load_policy(path: Path | None = None, *, root: Path = ROOT) -> tuple[dict, dict]:
    path = path or POLICY_PATH
    if not path.exists():
        return {}, {"approved": False, "scope": "sdk-default-unreviewed",
                    "reason": "No reviewed local C2PA trust snapshot installed."}
    try:
        base = root.resolve()
        if path.is_symlink() or not path.resolve().is_relative_to(base):
            raise ValueError("Policy must be a regular project-local file.")
        raw = path.read_bytes()
        policy = json.loads(raw)
        if policy.get("schema_version") != 1 or policy.get("approved") is not True:
            raise ValueError("Trust snapshot has not been approved.")
        for field in ("label", "source_url", "reviewed_at", "valid_until"):
            if not isinstance(policy.get(field), str) or not policy[field].strip():
                raise ValueError("Incomplete trust policy metadata.")
        reviewed = datetime.fromisoformat(policy["reviewed_at"].replace("Z", "+00:00"))
        expiry = datetime.fromisoformat(policy["valid_until"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if reviewed.tzinfo is None or expiry.tzinfo is None or not reviewed <= now < expiry:
            raise ValueError("Trust snapshot is expired or has invalid review dates.")
        anchor = policy["trust_anchors"]
        filename = Path(anchor["file"])
        target = path.parent / filename
        if filename.is_absolute() or ".." in filename.parts or target.is_symlink():
            raise ValueError("Invalid trust anchor path.")
        if not target.resolve().is_relative_to(base):
            raise ValueError("Trust anchors must remain inside the project.")
        content = target.read_bytes()
        digest = hashlib.sha256(content).hexdigest()
        if digest != anchor["sha256"]:
            raise ValueError("Trust anchor checksum does not match the reviewed snapshot.")
        pem = content.decode("ascii")
        if "-----BEGIN CERTIFICATE-----" not in pem or "PRIVATE KEY" in pem:
            raise ValueError("Expected public PEM certificates only.")
        return {"trust_anchors": pem}, {
            "approved": True, "scope": "reviewed-local-anchor-snapshot",
            "label": policy["label"], "source_url": policy["source_url"],
            "reviewed_at": policy["reviewed_at"], "valid_until": policy["valid_until"],
            "anchors_sha256": digest, "policy_sha256": hashlib.sha256(raw).hexdigest(),
        }
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        # Do not expose a local path or file content in an analysis report.
        return {}, {"approved": False, "scope": "invalid-local-policy",
                    "reason": "Local trust policy failed date, structure, path or checksum validation."}
