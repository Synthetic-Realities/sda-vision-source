"""Explicit-consent vendor check. Never participates in SDA's verdict."""
import hashlib
from datetime import datetime, timezone

import httpx

ENDPOINT = "https://studio-api.prod.suno.com/api/c2pa/detect"
MAX_BYTES = 100_000_000
VERDICTS = {"verified_suno", "no_suno_provenance", "inconclusive"}


async def check(client: httpx.AsyncClient, raw: bytes, mime: str, suffix: str) -> dict:
    result = {"status": "error", "provider": "Suno Credentials", "endpoint": ENDPOINT,
              "input_sha256": hashlib.sha256(raw).hexdigest(),
              "checked_at": datetime.now(timezone.utc).isoformat(), "consent_to_suno": True,
              "submitted_original": False, "verdict": None, "http_status": None,
              "response_sha256": None,
              "note": "Credential result reported by Suno; recorded separately from SDA's visual assessment."}
    if len(raw) > MAX_BYTES:
        result["note"] += " File exceeds Suno's documented 100 MB limit; not uploaded."
        return result
    try:
        result["submitted_original"] = True
        async with client.stream("POST", ENDPOINT,
                                 files={"file": ("original" + suffix, raw, mime)}) as response:
            result["http_status"] = response.status_code
            chunks, size = [], 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > 1024 * 1024:
                    raise ValueError("Vendor response exceeds limit")
                chunks.append(chunk)
            payload = b"".join(chunks)
            result["response_sha256"] = hashlib.sha256(payload).hexdigest()
            if response.status_code != 200:
                result["note"] += f" Suno's check could not be completed (HTTP {response.status_code}). Provenance remains unresolved by this check."
                return result
            import json
            data = json.loads(payload)
            if (not isinstance(data, dict) or not isinstance(data.get("verdict"), str)
                    or data["verdict"] not in VERDICTS):
                raise ValueError("Unrecognised vendor response")
            result.update(status="ok", verdict=data["verdict"], response=data)
    except (httpx.HTTPError, ValueError):
        result["note"] += " Service unavailable or response unsupported; no retry or alternative upload was made."
    return result
