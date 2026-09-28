"""Validate browser-held reports before merging or exporting them.

This validates structure, not authenticity: client reports remain editable
research records, not server-signed attestations.
"""
from typing import Annotated, Any, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError

Score = Annotated[int | float, Field(ge=0, le=100)]
VerdictValue = Literal["authentic_likely", "partially_synthetic", "synthetic_likely",
                       "inconclusive", "not_applicable"]


class Record(BaseModel):
    model_config = ConfigDict(extra="allow", strict=True, allow_inf_nan=False)


class Meta(Record):
    tool: str
    filename: str
    generated_at: str
    version: str = ""
    kind: str = ""
    frame_count: Annotated[int, Field(ge=0)] = 0
    frames_found: Annotated[int, Field(ge=0)] = 0
    models: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    thumbnail: str | None = None


class ProviderRaw(Record):
    per_frame: list["Frame"] = Field(default_factory=list)
    representative: str | None = None


class Provider(Record):
    id: str
    name: str
    kind: Literal["vision", "analysis", "provenance", "watermark", "forensic"]
    status: Literal["ok", "error", "unconfigured", "pending", "disabled", "timeout"]
    verdict: VerdictValue
    rating: Score | None = None
    confidence: str | None = None
    model: str | None = None
    summary: str = ""
    evidence: list[str] = Field(default_factory=list)
    visible_text: str | None = None
    vaccine_relevance: str | None = None
    latency_ms: int = 0
    raw: ProviderRaw = Field(default_factory=ProviderRaw)


class Frame(Record):
    frame: str
    verdict: VerdictValue
    rating: Score | None = None
    phash: str | None = None


class Evidence(Record):
    name: str
    verdict: str
    rating: Score | None = None
    note: str = ""


class Consensus(Record):
    overall_verdict: VerdictValue
    overall_rating: Score | None = None
    confidence: str = "low"
    headline: str = ""
    explanation: str = ""
    agreement: str = ""
    visible_text: str = ""
    vaccine_codes: list[str] = Field(default_factory=list)
    decision_trace: list[dict[str, Any]] = Field(default_factory=list)
    supporting: list[Evidence] = Field(default_factory=list)
    not_decisive: list[Evidence] = Field(default_factory=list)


class AudioSample(Record):
    start_seconds: Annotated[float | int, Field(ge=0)]
    duration_seconds: Annotated[float | int, Field(ge=0, le=3.1)]
    peak_dbfs: float | int | None
    signal_above_minus_60_dbfs: bool


class AudioTrack(Record):
    index: Annotated[int, Field(ge=0)]
    codec: str
    channels: Annotated[int, Field(ge=0)]
    sample_rate: Annotated[int, Field(ge=0)]
    duration_seconds: float | int | None
    decode_status: Literal["not_checked", "partial", "error", "decoded"]
    samples: Annotated[list[AudioSample], Field(max_length=3)]


class AudioInspection(Record):
    method_version: str
    input_sha256: str
    status: Literal["present", "absent", "unavailable", "error"]
    stream_count: int | None
    synthetic_audio_assessed: Literal[False]
    tracks: Annotated[list[AudioTrack], Field(max_length=4)]
    provenance_scope: str
    notes: list[str]


class AudioAssessment(Record):
    status: Literal["ok", "error", "unconfigured"]
    input_sha256: str
    excerpt_sha256: str
    provider: str
    model: str
    prompt_version: str
    checked_at: str
    track_index: Annotated[int, Field(ge=0)]
    start_seconds: Annotated[int | float, Field(ge=0)]
    duration_seconds: Annotated[int | float, Field(ge=0, le=20.1)]
    consent_to_google: bool
    synthetic_audio_assessed: Literal[False]
    content_type: Literal["speech", "music", "mixed", "other", "unclear"]
    observations: Annotated[list[str], Field(max_length=6)]
    transcript_excerpt: Annotated[str, Field(max_length=1500)]
    limitations: Annotated[list[str], Field(max_length=7)]


class SunoCheck(Record):
    status: Literal["ok", "error"]
    provider: str
    endpoint: str
    input_sha256: str
    checked_at: str
    consent_to_suno: bool
    submitted_original: bool
    verdict: Literal["verified_suno", "no_suno_provenance", "inconclusive"] | None
    http_status: int | None
    response_sha256: str | None
    note: str
    response: dict[str, Any] | None = None


class Report(Record):
    meta: Meta
    consensus: Consensus
    providers: list[Provider]
    frames: list[Frame] = Field(default_factory=list)
    phashes: list[str] = Field(default_factory=list)
    second_opinion_gemini: str | None = None
    second_opinion_chatgpt: str | None = None
    second_opinion_gemini_read: str | None = None
    second_opinion_chatgpt_read: str | None = None
    second_opinion_gemini_score: Score | None = None
    second_opinion_chatgpt_score: Score | None = None
    second_opinion_gemini_fresh_session: bool | None = None
    second_opinion_chatgpt_fresh_session: bool | None = None
    annotation_pointers: list[dict[str, str]] = Field(default_factory=list)
    annotation_checks: list[dict[str, str]] = Field(default_factory=list)
    annotation_meta: dict[str, Any] = Field(default_factory=dict)
    audio_inspection: AudioInspection | None = None
    audio_assessment: AudioAssessment | None = None
    suno_check: SunoCheck | None = None


class GraphRequest(Record):
    source: Literal["example", "item", "batch", "corpus"] = "example"
    reports: Annotated[list[Report], Field(max_length=200)] = Field(default_factory=list)
    threshold: Annotated[int, Field(ge=0, le=64)] = 10
    min_component: Annotated[int, Field(ge=1, le=200)] = 1
    edge_mode: Literal["attributes", "variants"] = "attributes"


def validate_graph(value: Any) -> dict:
    try:
        request = GraphRequest.model_validate(value)
        if request.source == "item" and len(request.reports) != 1:
            raise ValueError("Item graphs need exactly one report.")
        return request.model_dump()
    except (ValidationError, ValueError):
        raise HTTPException(400, "Malformed graph request. Check source, reports and graph settings.")


def validate_report(value: Any) -> dict:
    try:
        return Report.model_validate(value).model_dump()
    except ValidationError:
        # Do not echo invalid input: reports may contain sensitive research text.
        raise HTTPException(400, "Malformed report. Expected structured metadata, consensus, providers and frames.")


def validate_export_item(value: Any) -> dict:
    if not isinstance(value, dict) or "report" not in value:
        raise HTTPException(400, "Each export item needs a report.")
    image = value.get("image")
    if image is not None and not isinstance(image, str):
        raise HTTPException(400, "Export image must be an encoded image string.")
    return {"report": validate_report(value["report"]), "image": image}
