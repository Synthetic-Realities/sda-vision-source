"""Central configuration. Reads .env once and exposes typed settings.

.env is treated as the source of truth: a non-empty value in .env always wins,
and the process environment is only used as a fallback when .env doesn't set a
key. This avoids a stale/empty exported variable (e.g. a leftover
`ANTHROPIC_API_KEY=` from an earlier inline launch) silently shadowing .env.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

VERSION = "0.1.2"
TOOL_NAME = "SDA Vision"
METHOD_VERSION = "pdf-preparation-2026-09-26.1"

# Version gating for the annotation lane (amended brief, section 5). The panel
# version is dated rather than semantic because the panel history is dated eras
# (documented default-model update: 2026-07-08); each pointer also names its
# exact model in emitted_by. Bump PANEL_VERSION when the default panel changes
# and ANNOTATION_PROMPT_VERSION when the annotation prompt or tells note
# changes; the internal-check harness re-runs on either bump.
PANEL_VERSION = "panel-2026-09-24"
ANNOTATION_PROMPT_VERSION = "annotation-groundref-v0.1"

ROOT = Path(__file__).resolve().parent.parent
_ENV_PATH = ROOT / ".env"
_FILE = dotenv_values(_ENV_PATH)
load_dotenv(_ENV_PATH)  # also populate os.environ for any direct readers


def _get(name: str, default: str = "") -> str:
    """Prefer a non-empty value from .env, else the process environment."""
    val = _FILE.get(name)
    if val is None or val == "":
        val = os.getenv(name, default)
    return (val or default).strip()


def _flag(name: str) -> bool:
    return _get(name).lower() in {"1", "true", "yes"}


# The labelled research corpus is never bundled (private/licensed media). It
# defaults to an in-repo folder that does not exist in the public build; set
# CORPUS_DIR in .env to point at your own corpus (dev mode only).
_DEFAULT_CORPUS = ROOT / "labelled-corpus"
CORPUS_DIR = Path(_get("CORPUS_DIR", str(_DEFAULT_CORPUS)))
REPORTS_DIR = ROOT / "reports"
WEB_DIR = ROOT / "web"


@dataclass(frozen=True)
class Settings:
    delivery_profile: str = _get("SDA_PROFILE", "research")
    conference_password: str = _get("SDA_CONFERENCE_PASSWORD")
    conference_manifest: str = _get("SDA_CONFERENCE_MANIFEST", str(ROOT / "config" / "conference-examples.json"))
    conference_max_runs: int = max(0, int(_get("SDA_CONFERENCE_MAX_RUNS", "10")))
    conference_timeout: float = max(1, float(_get("SDA_CONFERENCE_TIMEOUT", "180")))
    anthropic_key: str = _get("ANTHROPIC_API_KEY")
    anthropic_model: str = _get("ANTHROPIC_VISION_MODEL", "claude-opus-5-5")
    # Cheap model used only to distil a pasted second-opinion note into a score.
    anthropic_summary_model: str = _get("ANTHROPIC_SUMMARY_MODEL", "claude-haiku-4-5-20251001")

    openai_key: str = _get("OPENAI_API_KEY")
    openai_model: str = _get("OPENAI_VISION_MODEL", "gpt-6-astra")

    google_key: str = _get("GOOGLE_API_KEY")
    google_model: str = _get("GOOGLE_VISION_MODEL", "gemini-3.8-flash")

    synthid_endpoint: str = _get("SYNTHID_ENDPOINT")
    synthid_token: str = _get("SYNTHID_ACCESS_TOKEN")

    provider_timeout: float = float(_get("PROVIDER_TIMEOUT", "60") or 60)
    provider_retries: int = int(_get("PROVIDER_RETRIES", "1") or 1)
    port: int = int(_get("PORT", "8100") or 8100)

    max_frames: int = int(_get("MAX_FRAMES", "4") or 4)

    pdf_mode: str = _get("PDF_MODE", "auto").lower()
    min_figure_px: int = int(_get("MIN_FIGURE_PX", "300") or 300)

    audio_max_seconds: int = int(_get("AUDIO_MAX_SECONDS", "1800") or 1800)
    openai_transcribe_model: str = _get("OPENAI_TRANSCRIBE_MODEL", "whisper-1")

    disable_anthropic: bool = _flag("DISABLE_ANTHROPIC")
    disable_openai: bool = _flag("DISABLE_OPENAI")
    disable_google: bool = _flag("DISABLE_GOOGLE")

    # The vaccine/health lens is a gated, non-default research configuration for
    # the fellowship case study and community workshops. Off by default so the
    # shipped tool reads as a general, open instrument.
    enable_vaccine_lens: bool = _flag("ENABLE_VACCINE_LENS")

    # Dev mode is for the researcher's own machine. ON exposes the local labelled
    # corpus browser and saves each analysis to dev_runs/ for the next phase of
    # analysis. OFF (the shipped/public default) hides the corpus and saves
    # nothing server-side. Uploads work in both modes (the tool is BYOK).
    dev_mode: bool = _flag("DEV_MODE")


settings = Settings()
