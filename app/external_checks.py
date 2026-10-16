"""Participant-entered external watermark records: evidence, not provider votes."""
from typing import Annotated, Literal
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator

Hash = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
LABELS = {"detected": "Watermark detected", "not_detected": "Watermark not detected",
          "inconclusive": "Inconclusive", "unsupported": "Unsupported by the service",
          "failed": "Check failed", "not_checked": "Not checked"}
SCOPE = ("Manually recorded external watermark check. Covers the identified file and the "
         "service's stated scope; kept separately from SDA's model assessment and human reflections.")


class ExternalCheck(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    schema_version: Literal["external-check-v1"]
    id: Annotated[str, Field(min_length=1, max_length=100)]
    service: Literal["SynthID Detector"]
    service_url: Literal["https://synthid.com/"]
    entry_method: Literal["manual"]
    status: Literal["detected", "not_detected", "inconclusive", "unsupported", "failed", "not_checked"]
    checked_at: Annotated[str, Field(max_length=40)]
    recorded_at: Annotated[str, Field(max_length=40)]
    operator: Annotated[str, Field(max_length=200)]
    source_filename: Annotated[str, Field(min_length=1, max_length=1000)]
    source_sha256: Annotated[str, Field(pattern=r"^(?:[a-f0-9]{64})?$")]
    checked_filename: Annotated[str, Field(min_length=1, max_length=1000)]
    checked_sha256: Hash
    checked_bytes: Annotated[int, Field(ge=0)]
    relationship: Literal["original", "derived_image", "participant_selected"]
    material_label: Annotated[str, Field(min_length=1, max_length=500)]
    reported_scope: Annotated[str, Field(max_length=2000)]
    reported_origin: Annotated[str, Field(max_length=500)]
    response: Annotated[str, Field(max_length=20000)]

    @model_validator(mode="after")
    def validate_record(self):
        for value in (self.checked_at, self.recorded_at):
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError("External-check dates need a timezone.")
        if self.status != "not_checked" and not self.response.strip():
            raise ValueError("A service outcome needs the exact reply or error.")
        if self.status != "detected" and self.reported_origin:
            raise ValueError("Origin can be recorded only beside a detected result.")
        if self.relationship == "original" and self.source_sha256 and self.source_sha256 != self.checked_sha256:
            raise ValueError("An original-file record must identify the original bytes.")
        return self


def rows(check: dict) -> list[tuple[str, str]]:
    return [
        ("Service", check["service"]), ("Service address", check["service_url"]),
        ("Result", LABELS[check["status"]]), ("Entry", "Participant-entered record; not independently verified by SDA"),
        ("Check / record date", check["checked_at"]), ("Recorded at", check["recorded_at"]),
        ("Recorded by", check["operator"] or "Not stated"), ("Original item", check["source_filename"]),
        ("Original SHA-256", check["source_sha256"] or "Not available"),
        ("Checked material", check["material_label"]), ("Relationship", check["relationship"].replace("_", " ")),
        ("Checked file", check["checked_filename"]), ("Checked SHA-256", check["checked_sha256"]),
        ("File size (bytes)", str(check["checked_bytes"])),
        ("Coverage reported by service", check["reported_scope"] or "Not specified"),
        ("Origin reported by service", check["reported_origin"] or "Not specified"),
        ("Exact reply", check["response"] or "No reply recorded"), ("Scope", SCOPE),
        *([("Interpretation", "Origin remains unresolved by this check; absence of a detected watermark does not establish human authorship.")] if check["status"] == "not_detected" else []),
        *([("Interpretation", "The check supplied no usable watermark finding. Record a cause only if the service gives one.")] if check["status"] == "failed" else []),
    ]


def records(report: dict) -> list[dict]:
    """Only schema-valid records tied to this item are displayed as records.

    Validation establishes structure and file binding, not a vendor signature.
    Incoming API requests reject invalid records; this guard also protects
    direct exports of legacy or hand-edited local reports.
    """
    from pydantic import ValidationError
    output = []
    values = report.get("external_checks") or []
    if not isinstance(values, list):
        return output
    for value in values[:30]:
        try:
            check = ExternalCheck.model_validate(value).model_dump()
        except (ValueError, ValidationError):
            continue
        digest = report.get("meta", {}).get("input_sha256")
        if digest and check["source_sha256"] != digest:
            continue
        output.append(check)
    return output


def description(report: dict) -> str:
    return " || ".join("; ".join(f"{key}: {value}" for key, value in rows(check)) for check in records(report))
