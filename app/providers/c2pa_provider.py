"""Embedded C2PA verification, with integrity and signer trust kept separate.

Signed declarations are provenance, not calibrated probabilities or proof that
the depicted scene is true. Network manifest and revocation fetches are disabled.
"""
from __future__ import annotations

import io
import json
import re
import time
from importlib.metadata import version

from ..c2pa_trust import load_policy
from ..media import Media
from ..schema import Kind, ProviderResult, Status, Verdict

ID = "c2pa"
NAME = "C2PA Content Credentials"
POLICY = "embedded-offline-reviewed-trust-v3"
SPECIFICATION_TARGET = "2.4"
_SOURCE_PREFIX = "http://cv.iptc.org/newscodes/digitalsourcetype/"
_AI_SOURCE = _SOURCE_PREFIX + "trainedalgorithmicmedia"
_COMPOSITE_AI_SOURCE = _SOURCE_PREFIX + "compositewithtrainedalgorithmicmedia"
_CAMERA_SOURCE = _SOURCE_PREFIX + "digitalcapture"
_TRUST_FAILURES = {"signingCredential.untrusted", "timeStamp.untrusted"}


def _read_manifest_json(raw: bytes, mime: str, trust: dict | None = None) -> str | None:
    import c2pa

    # Per-reader settings avoid a global settings race between concurrent uploads.
    with c2pa.Settings.from_dict({"trust": trust or {}, "core": {
            "allowed_network_hosts": [],
        }, "verify": {
            "verify_after_reading": True,
            "verify_trust": True,
            "verify_timestamp_trust": True,
            "remote_manifest_fetch": False,
            "ocsp_fetch": False,
        }}) as settings:
        with c2pa.Context(settings=settings) as context:
            try:
                with c2pa.Reader(mime or "image/jpeg", io.BytesIO(raw), context=context) as reader:
                    return reader.json()
            except c2pa.C2paError.ManifestNotFound:
                return None


def run(media: Media) -> ProviderResult:
    started = time.monotonic()
    try:
        import c2pa

        trust, policy = load_policy()
        manifest_str = _read_manifest_json(media.raw_bytes, media.mime, trust)
        if manifest_str is None:
            result = ProviderResult(
                ID, NAME, Kind.PROVENANCE, Status.OK,
                summary="Embedded credentials: none found. Origin remains unresolved by this check.",
                evidence=["Coverage: credentials embedded in the submitted file. External credentials were not retrieved."],
                raw={"validation": {"integrity": "absent", "trust": "unknown", "complete": False}},
            )
        else:
            result = _interpret(json.loads(manifest_str), _ms(started), policy_approved=policy["approved"])
        result.raw.update({
            "sdk_version": version("c2pa-python"),
            "native_sdk_version": c2pa.sdk_version(),
            "specification_target": SPECIFICATION_TARGET,
            "verification_policy": POLICY,
            "network_access": False,
            "trust_policy": policy,
        })
        result.evidence.append(
            f"Verifier: c2pa-python {result.raw['sdk_version']}; native SDK "
            f"{result.raw['native_sdk_version']}; specification target {SPECIFICATION_TARGET}; policy {POLICY}."
        )
        result.evidence.append(
            "Offline embedded-manifest verification; no network trust-list, manifest or revocation refresh."
        )
        if not policy["approved"]:
            result.evidence.append(policy["reason"] + " Provenance overrides are disabled.")
        result.latency_ms = _ms(started)
        return result
    except ModuleNotFoundError:
        return ProviderResult(ID, NAME, Kind.PROVENANCE, Status.UNCONFIGURED,
                              summary="c2pa-python is not installed.")
    except Exception as exc:
        return ProviderResult(
            ID, NAME, Kind.PROVENANCE, Status.ERROR,
            summary=f"C2PA verification could not complete: {exc}",
            latency_ms=_ms(started),
            raw={"verification_policy": POLICY,
                 "validation": {"integrity": "unknown", "trust": "unknown", "complete": False}},
        )


def _validation(store: dict, active: dict, active_found: bool) -> dict:
    state = store.get("validation_state")
    codes, failures = [], []
    well_formed = active_found

    def statuses(value, is_failure):
        nonlocal well_formed
        if not isinstance(value, list):
            well_formed = False
            return
        for entry in value:
            if not isinstance(entry, dict) or not isinstance(entry.get("code"), str):
                well_formed = False
                continue
            code = entry["code"]
            codes.append(code)
            if is_failure:
                failures.append(code)

    def results(value):
        nonlocal well_formed
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ("success", "informational", "failure"):
                    statuses(child, key == "failure")
                elif isinstance(child, (dict, list)):
                    results(child)
        elif isinstance(value, list):
            for child in value:
                if isinstance(child, (dict, list)):
                    results(child)
                else:
                    well_formed = False

    structured = store.get("validation_results")
    if isinstance(structured, dict) and isinstance(structured.get("activeManifest"), dict):
        results(structured)
    else:
        well_formed = False
    # The SDK's legacy validation_status contains adverse validation outcomes.
    for owner in (store, active):
        if owner.get("validation_status") is not None:
            statuses(owner["validation_status"], True)

    failures = list(dict.fromkeys(failures))
    codes = list(dict.fromkeys(codes))
    broken = state == "Invalid" or any(code not in _TRUST_FAILURES for code in failures)
    integrity = "invalid" if broken else ("valid" if well_formed and state in ("Valid", "Trusted") else "unknown")
    trust = ("untrusted" if any(code in _TRUST_FAILURES for code in failures)
             else "trusted" if state == "Trusted" and integrity == "valid" else "unknown")
    return {
        "integrity": integrity, "trust": trust,
        "complete": integrity == "valid" and trust == "trusted" and not failures,
        "sdk_state": state, "codes": codes, "failure_codes": failures,
    }


def _interpret(store: dict, latency: int, *, policy_approved: bool = False) -> ProviderResult:
    if not isinstance(store, dict):
        raise ValueError("Manifest store must be an object.")
    manifests = store.get("manifests")
    active_id = store.get("active_manifest")
    active = manifests.get(active_id) if isinstance(manifests, dict) and isinstance(active_id, str) else None
    active_found = isinstance(active, dict) and bool(active)
    active = active if active_found else {}
    validation = _validation(store, active, active_found)
    validation["policy_approved"] = policy_approved
    validation["complete"] = validation["complete"] and policy_approved
    source_types = _digital_source_types(active)
    history, history_complete = _history(manifests, active_id)
    generator = active.get("claim_generator") or _generator_from_info(active)
    issuer = _signature_issuer(active)
    actions = _actions(active)
    sources = {a["digitalSourceType"].strip().lower() for a in actions
               if isinstance(a.get("digitalSourceType"), str) and not a["_sda_scoped"]}
    scoped_sources = [a["digitalSourceType"] for a in actions
                      if isinstance(a.get("digitalSourceType"), str) and a["_sda_scoped"]]

    if _COMPOSITE_AI_SOURCE in sources or {_AI_SOURCE, _CAMERA_SOURCE} <= sources:
        declared, declaration = Verdict.PARTIALLY_SYNTHETIC, "Manifest declares AI-composited or mixed capture/AI content."
    elif _AI_SOURCE in sources:
        declared, declaration = Verdict.SYNTHETIC_LIKELY, "Manifest declares AI-generated content."
    elif _CAMERA_SOURCE in sources:
        declared, declaration = Verdict.AUTHENTIC_LIKELY, "The credential records a camera-capture declaration. Assess the depicted claim separately."
    else:
        declared, declaration = Verdict.INCONCLUSIVE, "No recognised AI-generation or camera-capture declaration."
        if scoped_sources:
            declaration = "These declarations concern a region or a recorded action. Whole-file coverage is unresolved."
    if scoped_sources and declared == Verdict.AUTHENTIC_LIKELY:
        declared = Verdict.INCONCLUSIVE
        declaration = "Capture and scoped source declarations coexist. Whole-file origin remains unresolved."

    if validation["complete"]:
        summary = "SDK reports valid integrity and trusted signer. " + declaration
    elif validation["integrity"] == "invalid":
        summary = "C2PA validation failed; declarations are not decisive evidence."
    elif validation["integrity"] == "valid":
        summary = "File integrity: validated. Signer trust: unresolved under the current local policy. The recorded declarations remain available for review and are not used as a decisive provenance finding."
    else:
        summary = "C2PA verification is incomplete. The recorded declarations remain available for review and are excluded from decisive provenance findings."

    if not validation["complete"]:
        summary += " " + declaration
    if declared == Verdict.INCONCLUSIVE:
        summary += " Creation-tool information and AI-generation declarations are considered separately."

    evidence = ["Credentials: embedded manifest found.",
                f"Integrity: {validation['integrity']} (SDK validation).",
                f"Signer trust: {validation['trust']} under the configured verifier.",
                f"Active manifest: {declaration}"]
    if generator:
        evidence.append(f"Claim generator (declared tool): {generator}")
    if issuer:
        evidence.append(f"Declared signer: {issuer}")
    evidence.extend(f"Declared source type: {source}" for source in source_types)
    if scoped_sources:
        evidence.append("Scoped declarations are displayed as context and excluded from whole-file provenance verdicts.")
    for entry in history:
        scope = "Active record" if entry["scope"] == "active" else "Ingredient record"
        evidence.append(f"{scope} - declared tool: {entry['generator'] or 'not recorded'}; "
                        f"actions: {', '.join(entry['actions']) or 'not recorded'}.")
        completeness = entry["all_actions_included"]
        evidence.append(f"{scope} - all actions recorded (signer's declaration): "
                        + ("yes" if completeness is True else "no" if completeness is False else "not established") + ".")
        if entry["scope"] != "active" and entry["source_types"]:
            evidence.append("Contributing material - source declaration: "
                            + ", ".join(entry["source_types"]))
        for disclosure in entry["ai_disclosures"]:
            fields = "; ".join(f"{k}: {v}" for k, v in disclosure.items())
            evidence.append(f"{scope} - AI model disclosure (context; whole-file origin assessed separately): {fields}")
        if entry.get("failure_codes"):
            evidence.append(f"{scope} validation issues: " + ", ".join(entry["failure_codes"]))
    if len(history) > 1:
        evidence.append("Ingredient history describes contributing material. Whole-file conclusions are assessed separately.")
    if not history_complete:
        evidence.append("Some referenced history could not be displayed; no external manifests were fetched.")
    ordered_codes = list(dict.fromkeys(validation["failure_codes"] + validation["codes"]))
    evidence.extend(f"Validation outcome: {code}" for code in ordered_codes)
    if not active_found:
        evidence.append("The active manifest could not be resolved.")
    return ProviderResult(
        ID, NAME, Kind.PROVENANCE, Status.OK, rating=None,
        verdict=declared if validation["complete"] else Verdict.INCONCLUSIVE,
        confidence="high" if validation["complete"] and declared != Verdict.INCONCLUSIVE else None,
        summary=summary, evidence=evidence, latency_ms=latency,
        raw={"active_manifest": active_id, "generator": generator,
             "source_type": " ".join(source_types), "source_types": source_types,
             "declared_verdict": declared.value, "declaration": declaration,
             "scoped_source_types": scoped_sources,
             "history": history, "history_complete": history_complete, "validation": validation},
    )


def _generator_from_info(active: dict) -> str:
    info = active.get("claim_generator_info")
    if isinstance(info, list):
        info = info[0] if info else {}
    if isinstance(info, dict):
        return f"{info.get('name', '')} {info.get('version', '')}".strip()
    return ""


def _signature_issuer(active: dict) -> str:
    sig = active.get("signature_info")
    return (sig.get("issuer") or sig.get("common_name") or "") if isinstance(sig, dict) else ""


def _assertions(active: dict):
    assertions = active.get("assertions") or []
    if not isinstance(assertions, list):
        raise ValueError("Manifest assertions must be a list.")
    for assertion in assertions:
        if not isinstance(assertion, dict):
            raise ValueError("Manifest assertion must be an object.")
        yield assertion


def _label(assertion: dict) -> str:
    label = assertion.get("label")
    return re.sub(r"__[0-9]+$", "", label) if isinstance(label, str) else ""


def _actions(active: dict) -> list[dict]:
    found = []
    for assertion in _assertions(active):
        if _label(assertion) not in ("c2pa.actions", "c2pa.actions.v2"):
            continue
        data = assertion.get("data")
        if not isinstance(data, dict) or not isinstance(data.get("actions"), list):
            raise ValueError("C2PA actions assertion is malformed.")
        templates = data.get("templates", [])
        if not isinstance(templates, list) or any(not isinstance(t, dict) for t in templates):
            raise ValueError("C2PA action templates are malformed.")
        metadata = data.get("metadata")
        scoped_assertion = isinstance(metadata, dict) and "regionOfInterest" in metadata
        pending = [(action, scoped_assertion, 0) for action in data["actions"]]
        while pending:
            action, scoped, depth = pending.pop(0)
            if depth > 32 or len(found) >= 4096:
                raise ValueError("C2PA action display limit exceeded.")
            if not isinstance(action, dict):
                raise ValueError("C2PA action must be an object.")
            # C2PA 18.15.6: wildcard defaults, named templates in order, then action.
            resolved = {}
            for selector in ("*", action.get("action")):
                if selector is None:
                    continue
                for template in templates:
                    if template.get("action") == selector:
                        resolved.update(template)
            resolved.update(action)
            resolved["_sda_scoped"] = scoped or "changes" in action
            found.append(resolved)
            related = action.get("related", [])
            if not isinstance(related, list):
                raise ValueError("C2PA related actions must be a list.")
            pending.extend((child, True, depth + 1) for child in related)
    return found


def _all_actions_included(active: dict) -> bool | None:
    declarations = [a.get("data", {}).get("allActionsIncluded") for a in _assertions(active)
                    if _label(a) in ("c2pa.actions", "c2pa.actions.v2")
                    and isinstance(a.get("data"), dict)]
    if any(value is False for value in declarations):
        return False
    return True if declarations and all(value is True for value in declarations) else None


def _digital_source_types(active: dict) -> list[str]:
    return list(dict.fromkeys(action["digitalSourceType"].strip().lower()
                             for action in _actions(active)
                             if isinstance(action.get("digitalSourceType"), str)))


def _ai_disclosures(active: dict) -> list[dict]:
    disclosures = []
    for assertion in _assertions(active):
        if _label(assertion) != "c2pa.ai-disclosure":
            continue
        data = assertion.get("data")
        if not isinstance(data, dict):
            continue
        fields = {key: data[key] for key in ("modelType", "modelName", "modelIdentifier")
                  if isinstance(data.get(key), str)}
        profile = data.get("contentProfile")
        if isinstance(profile, dict) and isinstance(profile.get("humanOversightLevel"), str):
            fields["humanOversightLevel"] = profile["humanOversightLevel"]
        if fields:
            disclosures.append(fields)
    return disclosures


def _history(manifests, active_id) -> tuple[list[dict], bool]:
    """Only follow reachable embedded ingredients; never inherit their verdicts."""
    if not isinstance(manifests, dict) or not isinstance(active_id, str):
        return [], False
    pending = [(active_id, "active", "", ())]
    seen, history, complete = set(), [], True
    while pending and len(history) < 64:
        label, scope, relationship, failures = pending.pop(0)
        if label in seen:
            continue
        seen.add(label)
        manifest = manifests.get(label)
        if not isinstance(manifest, dict):
            complete = False
            continue
        try:
            actions = _actions(manifest)
            sources = _digital_source_types(manifest)
            disclosures = _ai_disclosures(manifest)
        except ValueError:
            complete = False
            continue
        history.append({"manifest": label, "scope": scope, "relationship": relationship,
                        "generator": manifest.get("claim_generator") or _generator_from_info(manifest),
                        "declared_signer": _signature_issuer(manifest),
                        "actions": list(dict.fromkeys(a["action"] for a in actions
                                                     if isinstance(a.get("action"), str))),
                        "source_types": sources, "ai_disclosures": disclosures,
                        "all_actions_included": _all_actions_included(manifest),
                        "failure_codes": list(failures)})
        ingredients = manifest.get("ingredients") or []
        if not isinstance(ingredients, list):
            complete = False
            continue
        for ingredient in ingredients:
            if not isinstance(ingredient, dict):
                complete = False
                continue
            target = ingredient.get("active_manifest")
            if isinstance(target, str):
                outcome = _validation(ingredient, {}, True)
                pending.append((target, "ingredient", ingredient.get("relationship", ""),
                                outcome["failure_codes"]))
    return history, complete and not pending


def _ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)
