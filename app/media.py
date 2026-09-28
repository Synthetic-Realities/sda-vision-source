"""Image loading and normalization shared by every provider."""
from __future__ import annotations

import base64
import io
from dataclasses import dataclass

from PIL import Image

try:  # HEIC support is best-effort; cameras often export it.
    import pillow_heif  # type: ignore

    pillow_heif.register_heif_opener()
except Exception:  # pragma: no cover
    pass

# Formats the vision APIs accept directly. Anything else we transcode to JPEG.
_VISION_SAFE = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@dataclass
class Media:
    raw_bytes: bytes          # original file, untouched (used by C2PA + forensics)
    filename: str
    mime: str                 # original mime
    vision_b64: str           # base64 of a vision-API-safe image
    vision_mime: str          # mime of vision_b64 (jpeg/png/webp/gif)
    width: int | None
    height: int | None

    @property
    def vision_data_url(self) -> str:
        return f"data:{self.vision_mime};base64,{self.vision_b64}"


def _guess_mime(filename: str, raw: bytes) -> str:
    head = raw[:12]
    if head[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if head[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    lower = filename.lower()
    if lower.endswith((".heic", ".heif")):
        return "image/heic"
    return "application/octet-stream"


_GENERIC_MIME = {"", "application/octet-stream", "binary/octet-stream"}


def load_media(raw: bytes, filename: str, mime: str | None = None) -> Media:
    # A typeless browser File uploads as application/octet-stream; treat generic
    # MIMEs as unknown so the magic-byte guess wins (C2PA needs the real
    # container type to read a manifest).
    if mime and mime.lower() in _GENERIC_MIME:
        mime = None
    mime = mime or _guess_mime(filename, raw)
    width = height = None
    vision_b64 = base64.b64encode(raw).decode("ascii")
    vision_mime = mime

    try:
        img = Image.open(io.BytesIO(raw))
        width, height = img.size
        if mime not in _VISION_SAFE:
            # Transcode to JPEG so HEIC/TIFF/etc. still reach the vision models.
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=92)
            vision_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            vision_mime = "image/jpeg"
    except Exception:
        # Not a still image (or unreadable). Vision providers will report cleanly.
        pass

    return Media(
        raw_bytes=raw,
        filename=filename,
        mime=mime,
        vision_b64=vision_b64,
        vision_mime=vision_mime,
        width=width,
        height=height,
    )


def _thumb_data_url(img: "Image.Image", size: int) -> str:
    img.thumbnail((size, size))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=75)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _audio_visual(raw: bytes, filename: str) -> bytes | None:
    """A visual for an audio file: embedded cover art when present, otherwise a
    rendered waveform (ffmpeg, local, deterministic). None if ffmpeg is absent."""
    import os
    import subprocess
    import tempfile
    suffix = os.path.splitext(filename)[1] or ".m4a"
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "in" + suffix)
        out = os.path.join(td, "out.png")
        with open(src, "wb") as f:
            f.write(raw)
        # Cover art first (attached picture stream), then a waveform.
        for args in (["-i", src, "-an", "-map", "0:v:0", "-frames:v", "1", out],
                     ["-i", src, "-filter_complex",
                      "showwavespic=s=560x280:colors=0x4f8cff", "-frames:v", "1", out]):
            r = subprocess.run(["ffmpeg", "-v", "quiet", "-y", *args], capture_output=True)
            if r.returncode == 0 and os.path.exists(out) and os.path.getsize(out) > 0:
                return open(out, "rb").read()
            if os.path.exists(out):
                os.unlink(out)
    return None


def report_thumbnail(raw: bytes, ing, size: int = 360) -> str | None:
    """A small JPEG data-URL showing WHAT was analysed - the image itself, the
    first analysed frame (page/slide/video frame), or the audio's cover art /
    waveform - so every report carries a visual of the item for the input
    preview, the graph info card and the exports."""
    try:
        return _thumb_data_url(Image.open(io.BytesIO(raw)), size)
    except Exception:
        pass
    for fr in (getattr(ing, "frames", None) or [])[:1]:
        try:
            frame_raw = base64.b64decode(fr.media.vision_b64)
            return _thumb_data_url(Image.open(io.BytesIO(frame_raw)), size)
        except Exception:
            pass
    if getattr(ing, "kind", "") == "audio":
        try:
            visual = _audio_visual(raw, getattr(ing, "filename", "") or "audio.m4a")
            if visual:
                return _thumb_data_url(Image.open(io.BytesIO(visual)), size)
        except Exception:
            pass
    return None
