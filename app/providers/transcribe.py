"""Audio transcription so spoken content can run the text-analysis pipeline.

Audio files are often large (tens of MB), so we transcode to compact mono 16 kHz
MP3 with ffmpeg first (speech needs no fidelity) and cap the duration. Gemini's
native audio understanding is preferred; OpenAI Whisper is the fallback.
"""
from __future__ import annotations

import base64
import os
import subprocess
import tempfile
from shutil import which

import httpx

from ..config import settings
from .gemini import generation_config

_TRANSCRIBE_PROMPT = "Transcribe this audio verbatim as plain text. Output only the transcript."


async def transcribe(client: httpx.AsyncClient, raw: bytes, filename: str) -> tuple[str | None, list[str]]:
    """Return (transcript, notes). transcript is None if transcription failed."""
    notes: list[str] = []
    if not which("ffmpeg"):
        return None, ["ffmpeg not found on PATH — needed to prepare audio for transcription."]

    small = _transcode(raw, filename, notes)
    if small is None:
        return None, notes

    if settings.google_key and not settings.disable_google:
        text = await _gemini_transcribe(client, small)
        if text:
            notes.append("Transcribed with Gemini.")
            return text, notes
        notes.append("Gemini transcription returned nothing; trying Whisper.")

    if settings.openai_key and not settings.disable_openai:
        text = await _whisper_transcribe(client, small)
        if text:
            notes.append(f"Transcribed with OpenAI {settings.openai_transcribe_model}.")
            return text, notes
        notes.append("Whisper transcription returned nothing.")

    if not settings.google_key and not settings.openai_key:
        notes.append("No transcription provider configured (needs a Google or OpenAI key).")
    return None, notes


def _transcode(raw: bytes, filename: str, notes: list[str]) -> bytes | None:
    """Down-convert to mono 16 kHz MP3, capped to AUDIO_MAX_SECONDS."""
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "in" + os.path.splitext(filename)[1])
        out = os.path.join(td, "out.mp3")
        with open(src, "wb") as f:
            f.write(raw)
        cap = settings.audio_max_seconds
        r = subprocess.run(
            ["ffmpeg", "-v", "quiet", "-i", src, "-t", str(cap),
             "-ac", "1", "-ar", "16000", "-b:a", "32k", out],
            capture_output=True)
        if r.returncode != 0 or not os.path.exists(out):
            notes.append("ffmpeg could not transcode the audio.")
            return None
        data = open(out, "rb").read()
        notes.append(f"Transcoded to {len(data)//1024} KB mono 16 kHz (≤{cap}s).")
        return data


async def _gemini_transcribe(client: httpx.AsyncClient, mp3: bytes) -> str | None:
    model = settings.google_model
    # Key in the x-goog-api-key header, not the URL query string (log hygiene).
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    headers = {"content-type": "application/json", "x-goog-api-key": settings.google_key}
    body = {
        "contents": [{"role": "user", "parts": [
            {"text": _TRANSCRIBE_PROMPT},
            {"inline_data": {"mime_type": "audio/mpeg",
                             "data": base64.b64encode(mp3).decode("ascii")}}]}],
        "generationConfig": generation_config(model, 8192, json_out=False,
                                              legacy_temperature=0),
    }
    try:
        resp = await client.post(url, headers=headers, json=body)
        if resp.status_code >= 300:
            return None
        parts = (((resp.json().get("candidates") or [{}])[0].get("content") or {}).get("parts")) or []
        return "".join(p.get("text", "") for p in parts).strip() or None
    except httpx.HTTPError:
        return None


async def _whisper_transcribe(client: httpx.AsyncClient, mp3: bytes) -> str | None:
    try:
        resp = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"authorization": f"Bearer {settings.openai_key}"},
            files={"file": ("audio.mp3", mp3, "audio/mpeg")},
            data={"model": settings.openai_transcribe_model},
        )
        if resp.status_code >= 300:
            return None
        return (resp.json().get("text") or "").strip() or None
    except httpx.HTTPError:
        return None
