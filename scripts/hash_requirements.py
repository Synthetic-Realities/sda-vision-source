"""Add public PyPI wheel hashes to an exact-version pip-compile lock.

Run with the isolated release tools environment (requests and packaging).
Only package names/versions are sent; the lock is replaced after every lookup succeeds.
"""
import re
from pathlib import Path

import requests
from packaging.requirements import Requirement

ROOT = Path(__file__).resolve().parents[1]


def main():
    path = ROOT / "requirements.lock"
    rows = path.read_text().splitlines()
    if any("--hash=" in row for row in rows):
        raise ValueError("Compile a fresh version-only lock before adding hashes.")
    result = []
    with requests.Session() as session:
        for row in rows:
            if not row.strip() or row.lstrip().startswith(("#", "--")):
                result.append(row)
                continue
            requirement = Requirement(row)
            specs = list(requirement.specifier)
            if len(specs) != 1 or specs[0].operator != "==" or requirement.url:
                raise ValueError("All dependencies must be exact version pins.")
            version = specs[0].version
            response = session.get(f"https://pypi.org/pypi/{requirement.name}/{version}/json", timeout=20)
            response.raise_for_status()
            hashes = sorted({file["digests"]["sha256"] for file in response.json()["urls"]
                             if file["packagetype"] == "bdist_wheel" and not file.get("yanked")})
            if not hashes or not all(re.fullmatch(r"[0-9a-f]{64}", h) for h in hashes):
                raise ValueError(f"No valid wheel hashes for {requirement.name}.")
            result.append(row + " \\")
            result.extend("    --hash=sha256:" + h + (" \\" if i < len(hashes) - 1 else "")
                          for i, h in enumerate(hashes))
            print(f"{requirement.name}=={version}: {len(hashes)} published wheel hashes", flush=True)
    path.write_text("# Wheel hashes added from HTTPS PyPI JSON by scripts/hash_requirements.py\n"
                    + "\n".join(result) + "\n")


if __name__ == "__main__":
    main()
