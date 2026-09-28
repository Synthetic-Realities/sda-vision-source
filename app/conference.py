"""Presenter-only, fixed-example delivery profile; analysis method is unchanged."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


def example_manifest(settings, root: Path) -> dict[str, Path]:
    try:
        document = json.loads(Path(settings.conference_manifest).read_text())
        entries = document["examples"]
        if not isinstance(entries, list) or len(entries) > 50:
            raise ValueError("Example list must contain at most 50 items")
        result = {}
        for entry in entries:
            name, digest = entry["filename"], entry["sha256"]
            if not isinstance(name, str) or Path(name).name != name or name in result:
                raise ValueError("Use unique original basenames")
            if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
                raise ValueError("Each example needs its SHA-256")
            path = root / name
            if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
                raise ValueError("Example file is missing or outside the example folder")
            result[name] = path
        return result
    except (OSError, ValueError, KeyError, TypeError):
        raise HTTPException(503, "Conference example manifest is unavailable or invalid.") from None


def example_bytes(settings, root: Path, name: str) -> tuple[Path, bytes]:
    paths = example_manifest(settings, root)
    if name not in paths:
        raise HTTPException(404, "Example is not in the conference set.")
    path = paths[name]
    if path.stat().st_size > 200 * 1024 * 1024:
        raise HTTPException(413, "Conference example exceeds the 200 MB limit.")
    raw = path.read_bytes()
    entries = json.loads(Path(settings.conference_manifest).read_text())["examples"]
    expected = next(item["sha256"] for item in entries if item["filename"] == name)
    if not raw or hashlib.sha256(raw).hexdigest() != expected:
        raise HTTPException(409, "Example bytes differ from the reviewed manifest.")
    return path, raw


class ConferenceBoundary:
    """Authenticate before routing, reject unlisted API paths and bound JSON bodies."""
    GET = {"/api/providers", "/api/examples", "/api/examples/file", "/api/examples/thumb", "/api/examples/slides", "/api/corpus"}
    POST = {"/api/conference/analyse", "/api/export/md", "/api/export/csv", "/api/export/pdf", "/api/export/pptx",
            "/api/export/batch/md", "/api/export/batch/csv", "/api/export/batch/pdf", "/api/export/batch/pptx",
            "/api/diffusion", "/api/diffusion/summary", "/api/diffusion/gexf", "/api/diffusion/csv", "/api/diffusion/png"}

    def __init__(self, app, settings):
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or self.settings.delivery_profile != "conference":
            return await self.app(scope, receive, send)
        request = Request(scope, receive)
        path, method = scope["path"], scope["method"]
        async def reject(code, detail, headers=None):
            await JSONResponse({"detail": detail}, status_code=code, headers=headers)(scope, receive, send)
        if len(self.settings.conference_password) < 20:
            return await reject(503, "Set a conference presenter password of at least 20 characters.")
        if path == "/healthz" and method == "GET":
            return await self.app(scope, receive, send)
        try:
            scheme, token = request.headers.get("authorization", "").split(" ", 1)
            credentials = base64.b64decode(token, validate=True).decode("utf-8")
            valid = scheme.lower() == "basic" and hmac.compare_digest(
                credentials.encode(), ("presenter:" + self.settings.conference_password).encode())
        except (ValueError, UnicodeError):
            valid = False
        if not valid:
            return await reject(401, "Presenter sign-in required.", {"WWW-Authenticate": 'Basic realm="SDA Conference", charset="UTF-8"'})
        if path.startswith("/api/") and not ((method == "GET" and path in self.GET) or (method == "POST" and path in self.POST)):
            return await reject(403, "This route is unavailable in the fixed-example conference profile.")
        if method not in {"GET", "HEAD", "POST"}:
            return await reject(405, "Method unavailable.")
        if method == "POST":
            if path not in self.POST or request.headers.get("content-type", "").split(";", 1)[0] != "application/json":
                return await reject(415, "Conference requests must use the listed JSON routes.")
            origin = request.headers.get("origin")
            if origin and origin != str(request.base_url).rstrip("/"):
                return await reject(403, "Cross-origin conference requests are unavailable.")
            limit = 4096 if path == "/api/conference/analyse" else 8 * 1024 * 1024
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > limit:
                    return await reject(413, "Conference request exceeds its size limit.")
            replayed = False
            async def replay():
                nonlocal replayed
                if not replayed:
                    replayed = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await receive()
            return await self.app(scope, replay, send)
        return await self.app(scope, receive, send)


def install(app, settings, examples_dir, ingest, analyse, thumbnail):
    app.add_middleware(ConferenceBoundary, settings=settings)
    state = {"busy": False, "attempts": 0}
    app.state.conference_runs = state

    @app.get("/healthz")
    def health():
        if settings.delivery_profile == "conference":
            example_manifest(settings, examples_dir)
        return {"status": "ok", "profile": settings.delivery_profile}

    @app.post("/api/conference/analyse")
    async def run(request: Request):
        if settings.delivery_profile != "conference":
            raise HTTPException(404, "Conference profile is not enabled.")
        try:
            payload = await request.json()
        except (ValueError, UnicodeError):
            raise HTTPException(400, "Expected a JSON object.") from None
        if not isinstance(payload, dict) or set(payload) != {"example_id", "mode", "consent_to_providers"}:
            raise HTTPException(400, "Provide only example_id, mode and consent_to_providers.")
        if payload["consent_to_providers"] is not True:
            raise HTTPException(400, "Confirm provider processing for this selection first.")
        if not isinstance(payload["example_id"], str) or payload["mode"] not in ("general", "vaccine"):
            raise HTTPException(400, "Invalid conference selection.")
        path, raw = example_bytes(settings, examples_dir, payload["example_id"])
        if state["busy"]:
            raise HTTPException(409, "Another conference analysis is running; retry after it finishes.")
        if state["attempts"] >= settings.conference_max_runs:
            raise HTTPException(429, "The conference analysis allowance for this server process has been reached.")
        state["busy"] = True
        state["attempts"] += 1
        mode = "vaccine" if payload["mode"] == "vaccine" and settings.enable_vaccine_lens else "general"
        async def native_call(function, *args):
            # A native conversion thread cannot be forcibly cancelled. Keep the
            # run slot occupied until it exits, without starting later stages.
            worker = asyncio.create_task(asyncio.to_thread(function, *args))
            try:
                return await asyncio.shield(worker)
            except asyncio.CancelledError:
                try:
                    await worker
                finally:
                    raise
        async def execute():
            try:
                ing = await native_call(ingest, raw, path.name, None)
                report = await analyse(ing, "", mode)
                report["meta"]["thumbnail"] = await native_call(thumbnail, raw, ing)
                return report
            finally:
                state["busy"] = False
        task = asyncio.create_task(execute())
        try:
            return JSONResponse(await asyncio.wait_for(asyncio.shield(task), timeout=settings.conference_timeout))
        except asyncio.TimeoutError:
            task.cancel()
            # Retrieve any eventual native-library exception after the response.
            task.add_done_callback(lambda done: None if done.cancelled() else done.exception())
            raise HTTPException(504, "Conference analysis timed out. Open the saved-results fallback.") from None
        except asyncio.CancelledError:
            task.cancel()
            task.add_done_callback(lambda done: None if done.cancelled() else done.exception())
            raise
