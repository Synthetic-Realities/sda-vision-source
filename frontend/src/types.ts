// Mirrors the JSON the FastAPI backend returns.

export type Status = "ok" | "error" | "unconfigured" | "pending" | "disabled" | "timeout";
export type Verdict =
  | "authentic_likely"
  | "partially_synthetic"
  | "synthetic_likely"
  | "inconclusive"
  | "not_applicable";
export type Kind = "vision" | "analysis" | "provenance" | "watermark" | "forensic";

export interface ProviderResult {
  id: string;
  name: string;
  kind: Kind;
  status: Status;
  rating: number | null;
  verdict: Verdict;
  confidence: string | null;
  summary: string;
  evidence: string[];
  visible_text: string | null;
  vaccine_relevance: string | null;
  model: string | null;
  latency_ms: number;
  raw: Record<string, unknown>;
}

export interface EvidenceEntry {
  name: string;
  rating: number | null;
  verdict: string;
  note: string;
}

export interface TraceStep {
  step: string;
  [key: string]: unknown;
}

export interface Consensus {
  score_basis?: string;
  overall_rating: number | null;
  overall_verdict: Verdict;
  confidence: string;
  headline: string;
  explanation: string;
  agreement: string;
  decision_trace: TraceStep[];
  supporting: EvidenceEntry[];
  not_decisive: EvidenceEntry[];
  visible_text: string;
  vaccine_codes: string[];
  disclaimer: string;
}

export interface FrameSummary {
  frame: string;
  rating: number | null;
  verdict: Verdict;
}

export interface Meta {
  report_id?: string;
  input_sha256?: string;
  method_version?: string;
  tool: string;
  version: string;
  generated_at: string;
  filename: string;
  kind: string;
  frame_count: number;
  // Frames that qualified before the frame budget was applied (finite sources
  // only). When larger than frame_count the UI offers an incremental deep pass.
  frames_found?: number;
  notes: string[];
  mode: string;
  elapsed_ms: number;
  models: string[];
  // Small data-URL preview attached to baked showcase records and to reports
  // sent for graphing, so graph nodes stay identifiable.
  thumbnail?: string;
}

export interface Report {
  consensus: Consensus;
  providers: ProviderResult[];
  frames: FrameSummary[];
  meta: Meta;
  // Optional free-text the researcher pastes from an external second-opinion
  // tool. Tagged per source so exports show which LLM each note came from.
  // The *_score / *_read fields are a cheap Haiku distillation of each note.
  // Hidden everywhere when empty.
  second_opinion_gemini?: string;
  second_opinion_gemini_score?: number;
  second_opinion_gemini_read?: string;
  second_opinion_chatgpt?: string;
  second_opinion_chatgpt_score?: number;
  second_opinion_chatgpt_read?: string;
  // Tri-state fresh-session attestation per note: true = attested fresh,
  // false = researcher states the session was not fresh, absent = not
  // attested. Researcher-reported provenance of the note, never evidence.
  // The second_opinion_ prefix is load-bearing: the deep pass carries
  // researcher fields by that prefix (app/pipeline.py, _carry_researcher_fields).
  second_opinion_gemini_fresh_session?: boolean;
  second_opinion_chatgpt_fresh_session?: boolean;
  // Annotation lane (pointer-not-verdict): checkable pointers to authenticated
  // referents plus the human's auditable check records. Read-only with respect
  // to the scored aggregation. The annotation_ prefix is load-bearing: the
  // deep pass carries researcher fields by prefix (app/pipeline.py).
  annotation_pointers?: AnnotationPointer[];
  annotation_checks?: AnnotationCheck[];
  annotation_meta?: AnnotationMeta;
  audio_inspection?: AudioInspection;
  audio_assessment?: AudioAssessment;
  suno_check?: SunoCheck;
}

export interface AudioInspection {
  method_version: string;
  input_sha256: string;
  status: "present" | "absent" | "unavailable" | "error";
  stream_count: number | null;
  synthetic_audio_assessed: false;
  provenance_scope: string;
  notes: string[];
  tracks: {
    index: number; codec: string; channels: number; sample_rate: number;
    duration_seconds: number | null; decode_status: string;
    samples: { start_seconds: number; duration_seconds: number; peak_dbfs: number | null;
      signal_above_minus_60_dbfs: boolean }[];
  }[];
}

export interface AudioAssessment {
  status: string; input_sha256: string; excerpt_sha256: string; provider: string; model: string;
  prompt_version: string; checked_at: string; track_index: number; start_seconds: number;
  duration_seconds: number; consent_to_google: boolean; synthetic_audio_assessed: false;
  content_type: string; observations: string[]; transcript_excerpt: string; limitations: string[];
}

export interface SunoCheck {
  status: string; provider: string; endpoint: string; input_sha256: string; checked_at: string;
  consent_to_suno: boolean; submitted_original: boolean;
  verdict: "verified_suno" | "no_suno_provenance" | "inconclusive" | null;
  http_status: number | null; response_sha256: string | null; note: string;
  response?: Record<string, unknown>;
}

// Spec 6.3, verbatim: no field carries a verdict, probability, confidence or
// accuracy, and the server-side validator rejects any that would.
export interface AnnotationPointer {
  pointer_id: string;
  artefact_ref: string;
  observation: string;
  verification_action: string;
  referent_source: string;
  referent_capture_date: string;
  referent_authority: string;
  referent_version: string;
  emitted_by: string;
  panel_version: string;
  prompt_version: string;
  emitted_at: string;
}

// Spec 6.6, verbatim. The outcome enum is stored exactly as written here.
export interface AnnotationCheck {
  pointer_id: string;
  checked_by: string;
  checked_at: string;
  outcome: "verified" | "not_verified" | "inconclusive";
  referent_consulted: string;
  note: string;
}

export interface AnnotationMeta {
  panel_version: string;
  prompt_version: string;
  emitted_at: string;
  models: string[];
  // Operational lane notes only (drop counts, provider errors, cap overflows).
  notes: string[];
}

export interface ProviderState {
  configured: boolean;
  state: string;
  model: string;
}

export interface ProvidersInfo {
  delivery_profile?: "research" | "conference";
  tool: string;
  version: string;
  vaccine_lens: boolean;
  dev_mode: boolean;
  corpus_available: boolean;
  claude: ProviderState;
  openai: ProviderState;
  gemini: ProviderState;
  synthid: ProviderState;
  c2pa: ProviderState;
  local: ProviderState;
}

export interface CorpusFile {
  name: string;
  path: string;
}

export interface CorpusLabel {
  label: string;
  count: number;
  files: CorpusFile[];
}

export interface CorpusInfo {
  available: boolean;
  labels: CorpusLabel[];
}

export interface GraphNode {
  id: string;
  label: string;
  verdict: string | null;
  rating: number | null;
  provenance: string | null;
  source: string | null;
  provider: string | null;
  signal_kind?: string | null;
  status?: string;
  finding?: string;
  detail?: string;
  input_sha256?: string;
  audio_observations?: string;
  cluster: number | null;
  community: number;
  degree: number;
  betweenness: number;
  thumb: string | null;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  variant_type: string;
}

export interface GraphData {
  population?: {
    source_items: number; eligible_items: number; loaded_items: number; displayed_items: number;
    excluded_unsupported: number; excluded_unreadable: number; excluded_duplicates: number;
    excluded_by_filter: number; isolated_before_filter: number; isolated_displayed: number;
    min_component: number; edge_mode: string; threshold: number;
  } | null;
  source: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: { nodes: number; edges: number; clusters: number; largest_cluster: number };
}

// A bundled example file as listed in the input panel. downloadUrl serves the
// ORIGINAL bytes (second-opinion tools need them untouched: a re-encode would
// strip C2PA manifests and can break SynthID watermarks); null when the file
// is not bundled in this build, with downloadNote saying where it lives.
export interface ExampleEntry {
  name: string;
  downloadUrl: string | null;
  downloadNote?: string;
}
