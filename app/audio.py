"""Bounded, offline soundtrack inspection. No inference about AI origin."""
from __future__ import annotations

import hashlib
import json
import math
import subprocess
import tempfile
from pathlib import Path
from shutil import which

import numpy as np

METHOD = "audio-local-v1"
MAX_TRACKS = 4
SAMPLE_SECONDS = 3
ASSESS_SECONDS = 20
SAMPLE_RATE = 16000
FORMATS = "mov,matroska,webm,avi,mp3,wav,aac,flac,ogg"
LIMIT = "Audio-level measurements cover the sampled windows. The remaining audio has not been inspected by this check."


def _number(value) -> float | None:
    try:
        n = float(value)
        return n if math.isfinite(n) and n >= 0 else None
    except (TypeError, ValueError):
        return None


def _probe(path: Path) -> dict:
    result = subprocess.run([
        "ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe",
        "-format_whitelist", FORMATS, "-show_entries",
        "format=duration:stream=index,codec_type,codec_name,channels,sample_rate,duration",
        "-of", "json", str(path),
    ], capture_output=True, timeout=10, check=True)
    if len(result.stdout) > 1024 * 1024:
        raise ValueError("Probe response exceeds limit")
    data = json.loads(result.stdout)
    if not isinstance(data, dict) or not isinstance(data.get("streams"), list):
        raise ValueError("Invalid stream inventory")
    return data


def _decode(path: Path, index: int, start: float, seconds: int, *, wav: bool = False) -> bytes:
    result = subprocess.run([
        "ffmpeg", "-v", "error", "-nostdin", "-protocol_whitelist", "file,pipe",
        "-format_whitelist", FORMATS, "-ss", str(start), "-i", str(path),
        "-map", f"0:{index}", "-vn", "-sn", "-dn", "-t", str(seconds),
        "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "pcm_s16le",
        "-f", "wav" if wav else "s16le", "pipe:1",
    ], capture_output=True, timeout=15, check=True)
    if not result.stdout or len(result.stdout) > SAMPLE_RATE * 2 * seconds + 4096:
        raise ValueError("No audio or decoded sample exceeds limit")
    return result.stdout


def _offsets(duration: float | None) -> list[float]:
    if duration is None or duration <= SAMPLE_SECONDS:
        return [0.0]
    end = max(0, duration - SAMPLE_SECONDS)
    return sorted({0.0, round(end / 2, 3), round(end, 3)})


def inspect_audio(raw: bytes, filename: str) -> dict:
    result = {"method_version": METHOD, "input_sha256": hashlib.sha256(raw).hexdigest(),
              "status": "unavailable", "stream_count": None, "tracks": [],
              "synthetic_audio_assessed": False, "notes": [LIMIT],
              "provenance_scope": "Original-file credentials are recorded separately. Credential coverage of this audio track: unresolved."}
    if not which("ffprobe"):
        result["notes"].append("Audio inspection unavailable: ffprobe is missing. Audio-track presence is unknown.")
        return result
    with tempfile.TemporaryDirectory(prefix="sda-audio-") as td:
        source = Path(td) / ("input" + Path(filename).suffix.lower())
        source.write_bytes(raw)
        try:
            data = _probe(source)
            streams = [s for s in data["streams"] if isinstance(s, dict) and s.get("codec_type") == "audio"]
        except (OSError, subprocess.SubprocessError, ValueError):
            result["status"] = "error"
            result["notes"].append("Could not inspect the container; audio presence is unknown.")
            return result
        result.update(status="present" if streams else "absent", stream_count=len(streams))
        if len(streams) > MAX_TRACKS:
            result["notes"].append(f"Only the first {MAX_TRACKS} of {len(streams)} audio tracks were sampled.")
        for stream in streams[:MAX_TRACKS]:
            index = stream.get("index")
            if type(index) is not int or index < 0:
                result["notes"].append("A track had an invalid index and was not sampled.")
                continue
            duration = _number(stream.get("duration"))
            if duration is None:
                duration = _number(data.get("format", {}).get("duration"))
            track = {"index": index, "codec": str(stream.get("codec_name", "unknown"))[:80],
                     "channels": int(_number(stream.get("channels")) or 0),
                     "sample_rate": int(_number(stream.get("sample_rate")) or 0),
                     "duration_seconds": duration, "samples": [], "decode_status": "not_checked"}
            result["tracks"].append(track)
            if not which("ffmpeg"):
                continue
            failed = False
            for start in _offsets(duration):
                try:
                    pcm = _decode(source, index, start, SAMPLE_SECONDS)
                    samples = np.frombuffer(pcm, dtype="<i2").astype(np.float64)
                    peak = float(np.max(np.abs(samples))) / 32768
                    track["samples"].append({"start_seconds": start,
                        "duration_seconds": round(len(samples) / SAMPLE_RATE, 3),
                        "peak_dbfs": round(20 * math.log10(peak), 1) if peak else None,
                        "signal_above_minus_60_dbfs": peak > 0.001})
                except (OSError, subprocess.SubprocessError, ValueError):
                    failed = True
            track["decode_status"] = ("partial" if failed and track["samples"] else
                                      "error" if failed else "decoded")
    return result


def extract_excerpt(raw: bytes, filename: str, index: int, start: float) -> tuple[bytes, float]:
    """A content-assessment derivative, never a replacement credential-bearing original."""
    if type(index) is not int or index < 0 or not math.isfinite(start) or start < 0:
        raise ValueError("Invalid track or start time")
    if not which("ffprobe") or not which("ffmpeg"):
        raise ValueError("Audio tools unavailable")
    with tempfile.TemporaryDirectory(prefix="sda-excerpt-") as td:
        source = Path(td) / ("input" + Path(filename).suffix.lower())
        source.write_bytes(raw)
        try:
            data = _probe(source)
            track = next((s for s in data["streams"] if s.get("codec_type") == "audio" and s.get("index") == index), None)
            if not track:
                raise ValueError("Requested audio track not found")
            duration = _number(track.get("duration"))
            if duration is None:
                duration = _number(data.get("format", {}).get("duration"))
            if duration is not None and start >= duration:
                raise ValueError("Excerpt starts beyond the track duration")
            pcm = _decode(source, index, start, ASSESS_SECONDS)
            import io
            import wave
            buffer = io.BytesIO()
            with wave.open(buffer, "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(SAMPLE_RATE)
                output.writeframes(pcm)
            return buffer.getvalue(), round(len(pcm) / (SAMPLE_RATE * 2), 3)
        except (OSError, subprocess.SubprocessError) as exc:
            raise ValueError("Could not decode the requested audio excerpt") from exc


def inspection_lines(value: dict) -> list[str]:
    lines = [f"Audio inspection: {value.get('status', 'unknown')}; tracks: {value.get('stream_count') if value.get('stream_count') is not None else 'unknown'}."]
    for track in value.get("tracks", []):
        samples = track.get("samples", [])
        signal = sum(bool(s.get("signal_above_minus_60_dbfs")) for s in samples)
        lines.append(f"Track {track['index']}: {track['codec']}, {track['channels']} channel(s), "
                     f"{track['sample_rate']} Hz; duration {track.get('duration_seconds')}s; decode {track['decode_status']}; "
                     f"{signal}/{len(samples)} sampled windows above -60 dBFS after mono downmix.")
        if samples:
            lines.append("Sample windows: " + "; ".join(f"{s['start_seconds']}s + {s['duration_seconds']}s" for s in samples))
    lines += [value.get("provenance_scope", ""), *value.get("notes", [])]
    return [line for line in lines if line]
