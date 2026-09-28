"""Create an explicitly unapproved, local-only source review ZIP.

An allowlist, not .gitignore, decides what enters the archive. No Git history,
credentials, research data, trust stores, caches or historical showcase reports.
This script never publishes or invokes a remote Git command.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.example_bundle import load_bundle
from scripts.staged_output import reject_symlinks

FILES = {
    'frontend/public/guides/workshop-activity-1-notice-v1.4.png',
    'frontend/public/guides/workshop-activity-4-reflect-v1.4.png',
    'frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.4.pdf',
    'frontend/public/guides/workshop-activity-2-discuss-v1.4.png',
    'frontend/public/guides/workshop-activity-3-check-v1.4.png',
    'frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.4-cover.png',
    'release/zenodo/guide-metadata.json',

    'docs/Recorded_Example_Scope_2026-09-27.md',
    'docs/Zenodo_Release_Pack.md',
    'tests/fixtures/workshop-review/podcast.json',
    'tests/fixtures/workshop-review/manifest.json',
    'tests/fixtures/workshop-review/animated_video.json',
    'tests/fixtures/workshop-review/illustration_1.json',
    'tests/notice_review.mjs',
    'tests/workshop_review.mjs',
    'tests/community_language_review.mjs',
    'tests/animated_video_review.mjs',
    'docs/guides/SDA_Vision_Facilitator_Guide_v1.4.pdf',
    'frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.4.pdf',
    'frontend/dist/guides/SDA_Vision_Facilitator_Guide_v1.4.pdf',
    'docs/images/SDA_Vision_Facilitator_Guide_v1.4-cover.png',
    'docs/images/workshop-activity-1-notice-v1.4.png',
    'docs/images/workshop-activity-4-reflect-v1.4.png',
    'docs/images/workshop-activity-2-discuss-v1.4.png',
    'docs/images/workshop-activity-3-check-v1.4.png',

    "docs/Responsive_Results_2026-09-27.md",
    "tests/responsive_results.mjs",
    "docs/PowerPoint_Preview_Setup.md",
    'docs/Partners_And_Local_Demo_2026-09-27.md',
    'docs/branding/README.md',
    'docs/branding/mmu-logo.png',
    'docs/branding/sdruk-logo.png',
    'docs/branding/ukri-logo.png',
    'frontend/public/branding/mmu-logo.png',
    'frontend/public/branding/sdruk-logo.png',
    'frontend/public/branding/ukri-logo.png',
    'frontend/dist/branding/mmu-logo.png',
    'frontend/dist/branding/sdruk-logo.png',
    'frontend/dist/branding/ukri-logo.png',
    'docs/guides/SDA_Vision_Facilitator_Guide_v1.3.pdf',
    'frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.3.pdf',
    'frontend/dist/guides/SDA_Vision_Facilitator_Guide_v1.3.pdf',
    'docs/images/SDA_Vision_Facilitator_Guide_v1.3-cover.png',
    'frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.3-cover.png',

    'docs/branding/sda-vision-logo.png',
    'docs/branding/sda-vision-favicon.png',
    'frontend/public/branding/sda-vision-logo.png',
    'frontend/public/branding/sda-vision-favicon.png',
    'frontend/dist/branding/sda-vision-logo.png',
    'frontend/dist/branding/sda-vision-favicon.png',
    'frontend/src/assets/sda-vision-logo.png',
    'docs/Branding_And_Slideshow_2026-09-27.md',
    'frontend/public/slides/presentation/manifest.json',
    'frontend/public/slides/presentation/slide-01.jpg',
    'frontend/public/slides/presentation/slide-02.jpg',
    'frontend/public/slides/presentation/slide-03.jpg',
    'frontend/public/slides/presentation/slide-04.jpg',
    'frontend/public/slides/presentation/slide-05.jpg',
    'frontend/public/slides/presentation/slide-06.jpg',
    'frontend/public/slides/presentation/slide-07.jpg',
    'frontend/public/slides/presentation/slide-08.jpg',
    'frontend/public/slides/presentation/slide-09.jpg',
    'frontend/public/slides/presentation/slide-10.jpg',
    'frontend/public/slides/presentation/slide-11.jpg',
    'frontend/public/slides/presentation/slide-12.jpg',
    'frontend/public/slides/presentation/slide-13.jpg',
    'frontend/public/slides/presentation/slide-14.jpg',
    'frontend/dist/slides/presentation/manifest.json',
    'frontend/dist/slides/presentation/slide-01.jpg',
    'frontend/dist/slides/presentation/slide-02.jpg',
    'frontend/dist/slides/presentation/slide-03.jpg',
    'frontend/dist/slides/presentation/slide-04.jpg',
    'frontend/dist/slides/presentation/slide-05.jpg',
    'frontend/dist/slides/presentation/slide-06.jpg',
    'frontend/dist/slides/presentation/slide-07.jpg',
    'frontend/dist/slides/presentation/slide-08.jpg',
    'frontend/dist/slides/presentation/slide-09.jpg',
    'frontend/dist/slides/presentation/slide-10.jpg',
    'frontend/dist/slides/presentation/slide-11.jpg',
    'frontend/dist/slides/presentation/slide-12.jpg',
    'frontend/dist/slides/presentation/slide-13.jpg',
    'frontend/dist/slides/presentation/slide-14.jpg',
    'docs/guides/SDA_Vision_Facilitator_Guide_v1.2.pdf',
    'frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.2.pdf',
    'frontend/dist/guides/SDA_Vision_Facilitator_Guide_v1.2.pdf',
    'docs/images/SDA_Vision_Facilitator_Guide_v1.2-cover.png',
    'frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.2-cover.png',
    'docs/images/presentation-slideshow.png',

    ".env.example", ".gitignore", "README.md", "PRIVACY.md", "LICENSE", "CITATION.cff", "SCOPE.md",
    "requirements.txt", "requirements.lock", "requirements-dev.txt", "setup.sh", "run.sh",
    "boot-vision.command", "stop-vision.command", "evaluate_corpus.py",
    "frontend/package.json", "frontend/package-lock.json", "frontend/index.html",
    "frontend/tsconfig.json", "frontend/tsconfig.node.json", "frontend/vite.config.ts",
    "frontend/src/assets/fonts/NotoSansMath-Regular.ttf", "frontend/src/assets/fonts/OFL-NotoSansMath.txt",
    "docs/guides/SDA_Vision_Facilitator_Guide_v1.1.pdf", "docs/images/SDA_Vision_Facilitator_Guide_v1.1-cover.png",
    "frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.1.pdf", "frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.1-cover.png",
    "frontend/dist/guides/SDA_Vision_Facilitator_Guide_v1.1.pdf",
    "docs/Community_Workshop_Review_2026-09-27.md", "docs/Release_Pack_Audit_2026-09-27.md", "docs/images/facilitator-tab.png", "docs/images/developer-media-and-batch.png", "tests/workshop_start.mjs",
    "frontend/public/sitemap.xml", "frontend/dist/sitemap.xml",
    "frontend/public/guides/social-preview.png",
    "docs/Developer_Demo_And_Discovery_2026-09-27.md",
    "frontend/public/about.html", "docs/PDF_Dependency_Change_2026-09-26.md",
    "release/PAGES_ACCEPTANCE_2026-09-26.md",
    "frontend/src/assets/fonts/NotoSans-Regular.ttf", "frontend/src/assets/fonts/OFL-NotoSans.txt",
    "frontend/src/assets/community-illustration.png", "frontend/src/assets/README.md",
    "frontend/src/assets/podcast-cover.png",
    "frontend/src/assets/infographic-preview.png", "frontend/src/assets/presentation-preview.png",
    'docs/Facilitator_Guide.md',
    'frontend/facilitator.html',
    'frontend/src/facilitator-guide.html',
    'docs/images/workshop-activity-1-notice.png',
    'docs/images/workshop-activity-2-discuss.png',
    'frontend/public/guides/workshop-activity-1-notice.png',
    'frontend/public/guides/workshop-activity-2-discuss.png',

    "scripts/bake_showcase.py", "scripts/build_showcase.py", "scripts/build_showcase.sh",
    "scripts/staged_output.py", "scripts/example_bundle.py", "scripts/hash_requirements.py", "scripts/package_candidate.py",
    "scripts/build_diffusion_graph.py", "scripts/make_example_graph.py",
    "scripts/inspect_provenance.py", "scripts/prepare_c2pa_trust_review.py",
    "docs/C2PA_Trust_Policy.md", "docs/Method_Change_Record_2026-09-19.md",
    "docs/Method_Change_Record_2026-09-26.md",
    "docs/GitHub_Testing_Checkpoint_2026-09-26.md",
    "docs/Third_Party_Release_Review.md", "docs/Release_Candidate_Readiness_2026-09-19.md",
    "docs/Provider_Upgrade_2026-09-24.md", "docs/Example_Pack_Replacement.md",
    "docs/C2PA_2_4_Upgrade_2026-09-24.md", "docs/Platform_Provenance_Scope_2026-09-24.md",
    "docs/Audio_Workflow_2026-09-24.md",
    "SECURITY.md", "examples/README.md",
    "docs/Governance_Language_Update_2026-09-24.md", "docs/Editorial_Review_2026-09-27.md",
    "docs/Workshop_Activities_2026-09-25.md", "docs/Community_Facilitator_Copy_Audit_2026-09-25.md",
    "docs/Report_Layout_And_Session_Downloads_2026-09-25.md",
    "docs/Showcase_Deploy_Guide.md",
    "release/README.md", "release/RELEASE_METADATA.md", "release/PROCESSING_RECORD.md",
    "release/RELEASE_CHECKLIST.md", "release/RELEASE_NOTES.md",
    "release/VALIDATION.md",
    "release/READINESS_2026-09-26.md", "release/PUBLISHING_ROUTE_2026-09-26.md",
    "release/NEXT_STEPS_GITHUB_PAGES_ZENODO_2026-09-26.md", "release/pages-workflow.yml.template",
    "release/PODCAST_DEPOSIT_REVIEW_2026-09-26.md",
    "release/INSTALLATION_AND_RELEASE_PLAN_2026-09-26.md",
    "tests/community_presentations.mjs",
    "docs/EXAMPLES_OFFLINE_HANDOVER_2026-09-26.md", "docs/CONFERENCE_RUNBOOK_2026-09-26.md",
    "docs/BMJ_RECORDING_AND_SESSION_PLAN_2026-09-26.md",
    "docs/BMJ_VIDEO_SCRIPT_2026-09-27.md",
    "docs/DEMO_ACCEPTANCE_2026-09-26.md",
    "scripts/prepare_conference.py", "scripts/build_conference.py",
    "deploy/conference/Dockerfile", "deploy/conference/.dockerignore", "deploy/conference/render.yaml",
    "config/conference-examples.template.json", "config/citation.json", "docs/Batch_And_Citation_2026-09-28.md",
    "release/CITATION.cff.template", "release/zenodo.json.template",
    "release/ASSET_REGISTER.csv", "release/TEST_RECORD.csv",
    "release/PLATFORM_TEST_RECORD.csv",
    "examples/CREDITS.md",
    "docs/guides/SDA_Vision_Facilitator_Guide_v1.0.pdf",
    "docs/images/SDA_Vision_Facilitator_Guide_v1.0-cover.png",
    "docs/images/community-workshop.png",
    "frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.0.pdf",
    "frontend/public/guides/SDA_Vision_Facilitator_Guide_v1.0-cover.png",
    "frontend/public/LICENSE.txt",
    "frontend/dist/guides/SDA_Vision_Facilitator_Guide_v1.0.pdf",
    "frontend/dist/LICENSE.txt",
    "release/zenodo/README.md", "release/zenodo/guide-manifest.json",
}
TREES = {"third_party": {"", ".md", ".txt", ".json", ".markdown"}, "app": {".py"}, "frontend/src": {".ts", ".tsx", ".css", ".svg"},
         "frontend/dist": {".html", ".js", ".css", ".svg", ".png", ".woff2", ".ttf"},
         "tests": {".py", ".cjs"}}
SECRET = re.compile(rb"(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{25,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)")


def candidate_files(root: Path = ROOT) -> list[Path]:
    selected = {root / name for name in FILES}
    for directory, extensions in TREES.items():
        for path in (root / directory).rglob("*"):
            if path.is_dir() and not path.is_symlink():
                continue
            if path.suffix in extensions and "__pycache__" not in path.parts:
                selected.add(path)
    for path in selected:
        if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError(f"Missing or unsafe candidate input: {path.relative_to(root)}")
    return sorted(selected)


def package(root: Path = ROOT, frontend_dist: Path | None = None,
            example_bundle: Path | None = None) -> Path:
    files = {path.relative_to(root).as_posix(): path for path in candidate_files(root)}
    # Media is opt-in. The default source candidate contains no example originals.
    # A reviewed bundle replaces the development inventory and credit documents.
    if example_bundle is not None:
        if not example_bundle.resolve().is_relative_to(root.resolve()):
            raise ValueError("Use an example bundle inside this project.")
        selected = load_bundle(example_bundle)
        files = {name: path for name, path in files.items() if not name.startswith("examples/")}
        files.update({"examples/" + name: path for name, path in selected.items()})
        files.update({"examples/" + name: example_bundle / name
                      for name in ("manifest.json", "README.md", "CREDITS.md")})
    if frontend_dist is not None:
        reject_symlinks(frontend_dist)
        frontend_dist = frontend_dist.resolve()
        if not frontend_dist.is_relative_to(root.resolve()) or not (frontend_dist / "index.html").is_file():
            raise ValueError("Use a built frontend review directory inside this project.")
        files = {name: path for name, path in files.items() if not name.startswith("frontend/dist/")}
        for path in frontend_dist.rglob("*"):
            relative = path.relative_to(frontend_dist).as_posix()
            if path.is_file() and (path.suffix in TREES["frontend/dist"] or "frontend/dist/" + relative in FILES):
                if path.is_symlink() or not path.resolve().is_relative_to(frontend_dist):
                    raise ValueError("Unsafe frontend build input.")
                files["frontend/dist/" + path.relative_to(frontend_dist).as_posix()] = path
    secrets = [value.encode() for key, value in dotenv_values(root / ".env").items()
               if value and len(value) >= 16 and any(word in key.upper() for word in ("KEY", "TOKEN", "SECRET"))]
    records, contents = [], {}
    for name, path in sorted(files.items()):
        content = path.read_bytes()
        if SECRET.search(content) or any(secret in content for secret in secrets):
            raise ValueError(f"Possible credential in candidate input: {name}; archive not created.")
        contents[name] = content
        records.append({"path": name, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
    env = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1"}
    commit, dirty = None, None
    if (root / ".git").exists():
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, env=env, text=True).strip()
        dirty = bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=root, env=env, text=True).strip())
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = root / ".review-cache" / "release-candidates" / f"sda-vision-UNAPPROVED-{stamp}.zip"
    output.parent.mkdir(parents=True, exist_ok=True)
    manifest = {"status": "UNAPPROVED_LOCAL_REVIEW_ONLY", "created_at": stamp,
                "source_commit": commit, "working_tree_dirty": dirty,
                "placeholder_files": [name for name, content in contents.items()
                                      if name.endswith((".md", ".csv", ".template", ".cff", ".json"))
                                      and b"TODO_RELEASE" in content],
                "excludes": ["git history", "credentials", "private runs/corpus", "historical caches", "trust-store"],
                "remaining_gates": ["user testing", "approved processing-record reconciliation", "licensing and example rights",
                                    "C2PA trust review", "live-model evaluation", "citation/release metadata", "publication permission"],
                "files": records}
    with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in contents.items():
            info = zipfile.ZipInfo("sda-vision-candidate/" + name)
            info.create_system = 3
            info.external_attr = (0o100755 if files[name].stat().st_mode & 0o111 else 0o100644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content)
        archive.writestr("sda-vision-candidate/CANDIDATE_MANIFEST.json", json.dumps(manifest, indent=2))
    with zipfile.ZipFile(output) as archive:
        if archive.testzip():
            raise ValueError("Candidate ZIP verification failed.")
        for entry in records:
            data = archive.read("sda-vision-candidate/" + entry["path"])
            if hashlib.sha256(data).hexdigest() != entry["sha256"]:
                raise ValueError("Candidate checksum verification failed.")
    print(json.dumps({"archive": str(output), "files": len(records), "bytes": output.stat().st_size,
                      "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
                      "status": manifest["status"], "working_tree_dirty": dirty}, indent=2))
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frontend-dir", type=Path, help="Use this separate built frontend without replacing the working build")
    parser.add_argument("--example-bundle", type=Path, help="Include only the neutral originals in this validated bundle")
    args = parser.parse_args()
    package(frontend_dist=args.frontend_dir, example_bundle=args.example_bundle)
