"""Local, no-API forensic cues: EXIF, Error-Level Analysis, noise residual, FFT.

These are heuristics, not proof. They give an independent free signal that runs
even when every network provider is down — which is the robustness the old app
lacked. Always shown with caveats per the project's ethics guidance.
"""
from __future__ import annotations

import io
import re
import time

import numpy as np
from PIL import Image, ImageChops

try:
    import pillow_heif  # type: ignore

    pillow_heif.register_heif_opener()
except Exception:  # pragma: no cover
    pass

from ..media import Media
from ..schema import Kind, ProviderResult, Status, Verdict, verdict_from_rating

ID = "local"
NAME = "Local forensic cues"

_CAMERA_TAGS = {271: "Make", 272: "Model", 305: "Software", 306: "DateTime"}


def run(media: Media) -> ProviderResult:
    started = time.monotonic()
    try:
        img = Image.open(io.BytesIO(media.raw_bytes))
        img.load()
    except Exception as exc:
        # Keep the reason but never leak Python object reprs (memory addresses)
        # into a user-facing row.
        reason = re.sub(r"\s*<[^>]*>", "", str(exc)).strip() or "unreadable image data"
        return ProviderResult(ID, NAME, Kind.FORENSIC, Status.OK, verdict=Verdict.NOT_APPLICABLE,
                              summary=f"Not a still image this layer can read ({reason}).",
                              latency_ms=_ms(started), raw={"error": str(exc)})

    rgb = img.convert("RGB")
    arr = np.asarray(rgb, dtype=np.float64)

    evidence: list[str] = []
    score = 35.0  # neutral prior; nudged by each cue

    # ── 1. EXIF / camera metadata ────────────────────────────────────────────
    exif = _read_exif(img)
    if exif.get("Make") or exif.get("Model"):
        evidence.append(f"Camera EXIF present: {exif.get('Make','')} {exif.get('Model','')}".strip())
        score -= 18
    else:
        evidence.append("No camera EXIF (common in AI exports, screenshots, and re-saves).")
        score += 8
    software = (exif.get("Software") or "").lower()
    if any(h in software for h in ("firefly", "dall", "midjourney", "stable", "gan", "diffusion")):
        evidence.append(f"Editing software tag suggests AI tooling: {exif.get('Software')}")
        score += 22

    # ── 2. Error-Level Analysis (JPEG recompression residual) ────────────────
    ela_mean, ela_max = _error_level(rgb)
    evidence.append(f"ELA mean {ela_mean:.1f}, peak {ela_max:.0f} (uniform high ELA can indicate generation/heavy edit).")
    if ela_mean > 12:
        score += 12
    elif ela_mean < 4:
        score -= 4

    # ── 3. Noise residual uniformity ─────────────────────────────────────────
    noise_std = _noise_residual_std(arr)
    evidence.append(f"High-frequency noise std {noise_std:.2f} (very low/very uniform noise is a synthesis cue).")
    if noise_std < 1.5:
        score += 14
    elif noise_std > 6:
        score -= 6

    # ── 4. FFT spectral peakiness (GAN/diffusion grid artifacts) ─────────────
    spectral = _spectral_peakiness(arr)
    evidence.append(f"Spectral peakiness {spectral:.2f} (periodic frequency peaks can mark generated textures).")
    if spectral > 4.0:
        score += 8

    rating = int(max(0, min(100, round(score))))
    verdict = verdict_from_rating(rating)
    confidence = "low"  # forensics are always advisory here

    return ProviderResult(
        ID, NAME, Kind.FORENSIC, Status.OK,
        rating=rating, verdict=verdict, confidence=confidence,
        summary=f"Heuristic synthetic likelihood {rating}/100 from metadata + pixel statistics.",
        evidence=evidence,
        latency_ms=_ms(started),
        raw={"exif": exif, "ela_mean": round(ela_mean, 2), "noise_std": round(noise_std, 2),
             "spectral_peakiness": round(spectral, 2),
             "dimensions": [media.width, media.height]},
    )


def _read_exif(img: Image.Image) -> dict:
    out: dict[str, str] = {}
    try:
        exif = img.getexif()
        for tag, name in _CAMERA_TAGS.items():
            if tag in exif and exif[tag]:
                out[name] = str(exif[tag]).strip("\x00 ").strip()
    except Exception:
        pass
    return out


def _error_level(rgb: Image.Image, quality: int = 90) -> tuple[float, float]:
    buf = io.BytesIO()
    rgb.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    recompressed = Image.open(buf).convert("RGB")
    diff = ImageChops.difference(rgb, recompressed)
    d = np.asarray(diff, dtype=np.float64)
    return float(d.mean()), float(d.max())


def _noise_residual_std(arr: np.ndarray) -> float:
    gray = arr.mean(axis=2)
    # 3x3 box blur via cumulative trick, then residual.
    k = 3
    pad = np.pad(gray, k // 2, mode="edge")
    blur = (
        pad[:-2, :-2] + pad[:-2, 1:-1] + pad[:-2, 2:]
        + pad[1:-1, :-2] + pad[1:-1, 1:-1] + pad[1:-1, 2:]
        + pad[2:, :-2] + pad[2:, 1:-1] + pad[2:, 2:]
    ) / 9.0
    residual = gray - blur
    return float(residual.std())


def _spectral_peakiness(arr: np.ndarray) -> float:
    gray = arr.mean(axis=2)
    # Downsample large images for speed.
    if max(gray.shape) > 512:
        step = max(gray.shape) // 512 + 1
        gray = gray[::step, ::step]
    f = np.fft.fftshift(np.fft.fft2(gray - gray.mean()))
    mag = np.abs(f)
    mean = mag.mean() + 1e-6
    # Peakiness = how far the strongest non-DC components exceed the mean.
    return float(np.percentile(mag, 99.9) / mean)


def _ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)
