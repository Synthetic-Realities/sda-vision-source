import { citationRows, softwareCitationRows } from "./citation";
import { ratingBasis } from "./assessmentNotes";
import type { ProviderResult, Report, Verdict } from "./types";
import { AUD_EXT, extOf, IMG_EXT, VID_EXT } from "./lib";
import type { WorkshopResponses } from "./workshop";

export type Presentation = "developer" | "community" | "trainer" | "facilitator";
export type WorkshopStep = "notice" | "discuss" | "check" | "reflect";

export const COMMUNITY_READS: Record<Verdict, string> = {
  synthetic_likely: "The checks lean towards AI-made or altered content",
  authentic_likely: "The checks lean towards authentic content",
  partially_synthetic: "The checks suggest a mixture or possible editing",
  inconclusive: "We need more information",
  not_applicable: "This check does not apply to this item",
};

export function mediaKind(name: string, report?: Report | null): string {
  if (report) return report.meta.kind;
  const ext = extOf(name);
  if (IMG_EXT.includes(ext)) return "image";
  if (VID_EXT.includes(ext)) return "video";
  if (AUD_EXT.includes(ext)) return "audio";
  if (["pdf", "pptx"].includes(ext)) return ext;
  if (["txt", "srt", "vtt", "md"].includes(ext)) return "text";
  return "file";
}

export function mediaLabel(kind: string): string {
  return ({ image: "Image", video: "Video", audio: "Audio / podcast", pdf: "PDF", pptx: "Slides", text: "Transcript" } as Record<string, string>)[kind] ?? "File";
}

export function assessmentTitle(report: Report): string {
  if (report.meta.kind === "audio") return ({
    synthetic_likely: "The recording’s transcript leans towards generated or altered wording",
    authentic_likely: "The recording’s transcript leans towards authentic content",
    partially_synthetic: "The recording’s transcript suggests a mixture or possible editing",
    inconclusive: "We need more information about this recording’s transcript",
    not_applicable: "A transcript assessment is unavailable for this recording",
  } as Record<Verdict, string>)[report.consensus.overall_verdict];
  const text = textAssessment(report);
  if (text) return ({
    synthetic_likely: "The text checks lean towards generated or altered content",
    authentic_likely: "The text checks lean towards authentic content",
    partially_synthetic: "The text checks suggest a mixture or possible editing",
    inconclusive: "We need more information about this text",
    not_applicable: "A text assessment is unavailable for this item",
  } as Record<Verdict, string>)[report.consensus.overall_verdict];
  return COMMUNITY_READS[report.consensus.overall_verdict];
}

export function textAssessment(report: Report): boolean {
  return ["audio", "text"].includes(report.meta.kind)
    || (report.meta.frame_count === 0 && report.providers.some(p => p.kind === "analysis"));
}

export function assessmentScope(report: Report): string {
  const { kind, frame_count, frames_found } = report.meta;
  if (kind === "audio") {
    const excerpt = report.meta.notes?.join(" ").match(/first (\d+) characters.*?(\d+)-character/);
    const coverage = excerpt
      ? `The models reviewed the first ${Number(excerpt[1]).toLocaleString("en-GB")} characters of the recording’s ${Number(excerpt[2]).toLocaleString("en-GB")}-character transcript (about ${Math.round(Number(excerpt[1]) / Number(excerpt[2]) * 100)}% of its characters).`
      : "The models reviewed this recording’s transcript; its available coverage is described in the detailed record.";
    return `${coverage} AI-origin detection from the sound itself is outside this workflow.`;
  }
  if (kind === "text") return "Content assessment covers the submitted text.";
  if (textAssessment(report)) return "Content assessment covers text extracted from this document. Consult the detailed record for extraction coverage.";
  if (kind === "video") return `Visual assessment covers ${frame_count} sampled still frame${frame_count === 1 ? "" : "s"}. Soundtrack checks are recorded separately; continuous motion is outside this assessment.`;
  if (kind === "pdf" || kind === "pptx") return `Assessment covers ${frame_count} extracted frame${frame_count === 1 ? "" : "s"}${frames_found && frames_found > frame_count ? ` of ${frames_found} found` : ""}. Check the detailed record for the pages or slides sampled.`;
  return "Visual assessment covers the submitted image.";
}

export function checkStatus(p: ProviderResult): string {
  return ({ ok: "Complete", error: "Check failed", timeout: "Timed out", disabled: "Disabled", unconfigured: "Unavailable", pending: "Not checked" })[p.status] ?? p.status;
}

export function providerRating(p: ProviderResult): number | null {
  return p.status === "ok" && ["vision", "analysis", "forensic"].includes(p.kind)
    && typeof p.rating === "number" && Number.isFinite(p.rating) && p.rating >= 0 && p.rating <= 100
    ? p.rating : null;
}

export function assessmentModels(report: Report): ProviderResult[] {
  return report.providers.filter(p => p.kind === (textAssessment(report) ? "analysis" : "vision"));
}

export function modelDisplayName(provider: ProviderResult): string {
  return ({ claude: "Claude", openai: "OpenAI", gemini: "Google Gemini" } as Record<string, string>)[provider.id] ?? provider.name;
}

export function modelReadingSummary(report: Report): string {
  const models = assessmentModels(report);
  const completed = models.filter(p => p.status === "ok");
  const audio = report.meta.kind === "audio";
  const noun = audio ? "transcript" : textAssessment(report) ? "text" : "visual";
  if (!models.length) return `No ${noun} model checks are recorded. Explore the source and available file checks.`;
  if (!completed.length) return `No ${noun} model checks completed. Review their recorded statuses and the source context.`;
  const labels = completed.map(modelDisplayName);
  const names = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  const subject = audio ? `${completed.length} model${completed.length === 1 ? "" : "s"} (${names}) reviewing the recording’s transcript`
    : `${completed.length} ${noun} model${completed.length === 1 ? "" : "s"} (${names})`;
  const verdicts = new Set(completed.map(p => p.verdict));
  const readings: Record<Verdict, string> = {
    synthetic_likely: audio ? "generated or altered wording" : textAssessment(report) ? "generated or altered text" : "synthetic content",
    authentic_likely: "authentic content", partially_synthetic: "a mixture or possible editing",
    inconclusive: "an inconclusive reading", not_applicable: "this item being outside their assessment scope",
  };
  let finding: string;
  if (verdicts.size > 1) finding = `${subject} returned mixed findings.`;
  else if (completed[0].verdict === "synthetic_likely" && report.meta.frame_count <= 1 && !textAssessment(report) && completed.length > 1) {
    finding = `${subject} agree this is likely synthetic.`;
  } else if (completed[0].verdict === "inconclusive") finding = `${subject} returned inconclusive findings.`;
  else if (completed[0].verdict === "not_applicable") finding = `${subject} reported this item outside their assessment scope.`;
  else finding = `${subject} ${completed.length === 1 ? "leans" : "lean"} towards ${readings[completed[0].verdict]}.`;
  const coverage = completed.length < models.length ? `${completed.length} of ${models.length} ${noun} model checks completed. ` : "";
  return `${coverage}${finding} Compare these readings with the source and context.`;
}

export function providerFinding(p: ProviderResult): string {
  if (p.status !== "ok") return p.summary || checkStatus(p);
  // Preserve provenance and watermark declarations instead of translating them
  // as another visual-model vote.
  if (["provenance", "watermark"].includes(p.kind)) return p.summary || "No finding recorded.";
  return p.summary || COMMUNITY_READS[p.verdict] || "No finding recorded.";
}

export function soundtrackFinding(report: Report): string {
  const a = report.audio_inspection;
  if (!a) return "Audio inspection was not recorded in this report.";
  if (a.status === "absent") return "No audio track was found.";
  if (a.status === "error") return "Audio inspection failed. Track presence is unknown.";
  if (a.status === "unavailable") return "Audio inspection is unavailable. Track presence is unknown.";
  return `${a.stream_count ?? a.tracks.length} audio track(s) found. Track presence can include silence.`;
}

const md = (s: string) => s.replace(/[\\`*_{}\[\]<>#|]/g, "\\$&").replace(/\r?\n/g, " ");

export interface OverviewRow {
  label: string; finding: string; detail: string; question?: string;
  answers?: { question: string; label: string; answer: string }[];
}

export function creationHistory(report: Report | null, kind: string): OverviewRow {
  const c = report?.providers.find(p => p.id === "c2pa");
  const validation = c?.raw?.validation as Record<string, unknown> | undefined;
  const usable = c?.status === "ok" && validation?.integrity !== "absent";
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const active = usable && Array.isArray(c.raw?.history) ? c.raw.history.find(entry =>
    entry && typeof entry === "object" && entry.scope === "active" && entry.manifest === c.raw.active_manifest) : undefined;
  const signer = text(active?.declared_signer);
  let finding = "Creation history not checked";
  let detail = "SDA can look for a creation record saved inside the file, called Content Credentials.";
  if (c) {
    if (c.status !== "ok") {
      finding = `Creation history: ${checkStatus(c).toLowerCase()}`;
      detail = "This check has no completed result. The detailed checks show its recorded status.";
    } else if (validation?.integrity === "absent") {
      finding = "No creation record found";
      detail = "No embedded Content Credentials were found in this file.";
    } else if (validation?.integrity === "invalid") {
      finding = "Creation record check failed";
      detail = "The record failed its technical checks. Its statements could not be confirmed by this check.";
    } else if (validation?.integrity === "valid") {
      finding = "Creation record found";
      detail = validation.trust === "trusted" && validation.complete === true && validation.policy_approved === true
        ? "The file and its creation record passed their technical checks. The signer meets SDA's trust policy. Read the recorded creation details below."
        : "The file and its creation record passed their technical checks. SDA has yet to establish trust in whoever signed the record.";
    } else {
      finding = c.raw?.active_manifest ? "Creation record needs checking" : "Creation history unresolved";
      detail = "The creation-history checks are incomplete. Any statements in the record remain unconfirmed by this check.";
    }
  }
  const declarations: Record<string, string> = {
    synthetic_likely: "The record declares AI-generated content.",
    partially_synthetic: "The record declares AI-composited content or a mix of AI and camera capture.",
    authentic_likely: "The record declares camera capture.",
  };
  const scoped = usable && Array.isArray(c.raw?.scoped_source_types) && c.raw.scoped_source_types.length > 0;
  const how = usable
    ? declarations[text(c.raw?.declared_verdict)] || (scoped
      ? "Recorded statements cover parts or actions; how the whole file was made remains open."
      : text(c.raw?.declaration) ? `The record says: ${text(c.raw.declaration)}` : "This report has no clear creation-method declaration. See the recorded details below.")
    : c?.status === "ok" ? "No creation-method declaration was found by this check." : "A creation-method finding is not available yet.";
  return { label: kind === "image" ? "Image history" : "File history", question: "Who made it? When and where was it made?", finding, detail, answers: [
    { question: "Who made or first shared it?", label: "Creator or first sharer", answer: signer
      ? `The record names its signer as ${signer}. This identifies the signer, rather than the creator or first sharer.`
      : "The creator and first sharer are not established by this check." },
    { question: "When and where was it made?", label: "Date and place", answer: "Creation date and place are not established by this check." },
    { question: "Does the file record how it was made?", label: "Recorded creation method", answer: how + (usable && ["audio", "video"].includes(kind) ? " Soundtrack-specific coverage needs a separate check." : "") },
  ] };
}

export function fileRecordSummary(report: Report): { finding: string; lines: string[] } {
  const c = report.providers.find(p => p.id === "c2pa");
  if (!c) return { finding: "File label not checked", lines: ["This report has no result for a creation label saved inside the file."] };
  if (c.status !== "ok") return { finding: `File label: ${checkStatus(c).toLowerCase()}`, lines: ["This check did not produce a completed result."] };
  const validation = c.raw?.validation as Record<string, unknown> | undefined;
  if (validation?.integrity === "absent") return { finding: "No creation label found", lines: ["This file has no built-in label saying how it was made. This check only reads labels inside the file."] };
  const lines: string[] = [];
  const declared: Record<string, string> = {
    synthetic_likely: "The label says this was made with AI.",
    partially_synthetic: "The label describes a mix of AI and other content.",
    authentic_likely: "The label says this was captured with a camera.",
  };
  if (declared[String(c.raw?.declared_verdict)]) lines.push(declared[String(c.raw?.declared_verdict)]);
  else if (Array.isArray(c.raw?.scoped_source_types) && c.raw.scoped_source_types.length) lines.push("The label describes parts of the file, rather than how the whole item was made.");
  else lines.push("The saved check does not give a clear account of how the whole item was made.");
  const active = Array.isArray(c.raw?.history) ? c.raw.history.find(h => h && typeof h === "object" && h.scope === "active" && h.manifest === c.raw.active_manifest) : undefined;
  if (typeof active?.declared_signer === "string" && active.declared_signer.trim()) lines.push(`It names ${active.declared_signer.trim()} as the organisation that signed the label.`);
  if (validation?.integrity === "invalid") lines.push("The label failed its checks, so SDA could not confirm that it matches this file.");
  else if (validation?.integrity === "valid") {
    lines.push("The label's digital signature checks out and matches this file.");
    lines.push(validation.trust === "trusted" && validation.complete === true && validation.policy_approved === true
      ? "The signing organisation also meets SDA's trust checks."
      : "SDA has not confirmed the signing organisation through its trust checks, so the label is shown as information alongside the other findings.");
  } else lines.push("The label checks are incomplete, so its details remain unconfirmed.");
  if (["audio", "video"].includes(report.meta.kind)) lines.push("A label for the whole file does not necessarily describe how its sound was made.");
  return { finding: validation?.integrity === "invalid" ? "Creation label check failed" : "About this file's creation label", lines };
}

// Coverage summary only: does not recompute or replace the research verdict.
export function workshopOverview(report: Report | null, kind: string): OverviewRow[] {
  const isText = report ? textAssessment(report) : ["audio", "text"].includes(kind);
  const models = report?.providers.filter(p => p.kind === (isText ? "analysis" : "vision")) ?? [];
  const completed = models.filter(p => p.status === "ok");
  const verdicts = new Set(completed.map(p => p.verdict));
  const readings: Record<string, string> = { synthetic_likely: "Leans AI-made or altered", authentic_likely: "Leans authentic", partially_synthetic: "Possible editing or mixing", inconclusive: "Inconclusive", not_applicable: "Outside this check's scope" };
  const count = models.length ? `${completed.length} of ${models.length} model checks completed.` : "No model checks recorded.";
  const unavailable = models.filter(p => p.status !== "ok").map(p => `${p.name}: ${checkStatus(p)}.`).join(" ");
  const rows: OverviewRow[] = [{ label: kind === "audio" ? "Transcript clues" : isText ? "Text clues" : "Visual clues",
    question: kind === "audio" ? "What do the recording’s words suggest?" : isText ? "How was the text made?" : "Is it authentic?",
    finding: !report ? "Not checked" : !completed.length ? "No completed readings" : verdicts.size > 1 ? "Mixed readings" : readings[completed[0].verdict] ?? "Inconclusive",
    detail: `${count} ${unavailable} ${isText ? "These checks interpret the words and framing." : kind === "video" ? "Visual models inspect sampled still frames; continuous motion is outside this check." : "Visual models look for patterns in the submitted images."}`.trim() }];
  rows.push(creationHistory(report, kind));
  if (["audio", "video"].includes(kind)) {
    const a = report?.audio_inspection;
    rows.push({ label: "Soundtrack", finding: !a ? "Not checked" : a.status === "present" ? "Audio track found" : a.status === "absent" ? "No audio track" : a.status === "error" ? "Inspection failed" : "Inspection unavailable",
      detail: report ? soundtrackFinding(report) : "Local inspection checks whether an audio track is present. A track can include silence." });
    rows.push({ label: "Sound description", finding: report?.audio_assessment ? report.audio_assessment.status === "ok" ? "Excerpt described" : "Check failed" : "Not checked",
      detail: "An optional Google check describes a short excerpt. AI-origin detection from the sound itself is outside this workflow." });
    if (report?.suno_check) rows.push({ label: "Suno credentials", finding: report.suno_check.status !== "ok" ? "Check failed" : ({ verified_suno: "Suno reports a match", no_suno_provenance: "No Suno provenance reported", inconclusive: "Suno result inconclusive" }[report.suno_check.verdict ?? "inconclusive"]), detail: report.suno_check.note });
  }
  rows.push({ label: "Shared claim", question: "What evidence supports its claim?", finding: "Claim accuracy: not assessed",
    detail: "Compare the claim with its original source, supporting evidence and relevant expertise." });
  return rows;
}

export function communitySummary(report: Report, reflection: string, impression: string, cached: boolean, responses?: WorkshopResponses, sourceNote?: string): string {
  const lines = ["# SDA Community: Our findings", "", `File: ${md(report.meta.filename)}`,
    `Analysis: ${md(report.meta.report_id ?? report.meta.generated_at)}`,
    `Analysis date: ${md(report.meta.generated_at)}`, `Run: ${cached ? "Cached showcase report" : "Analysis recorded in SDA"}`,
    `Analysis lens: ${md(report.meta.mode ?? "not recorded")}`,
    `Recorded conclusion: ${md(report.consensus.overall_verdict.replace(/_/g, " "))}`,
    `Tool: ${md(report.meta.tool)} ${md(report.meta.version)}; method: ${md(report.meta.method_version ?? "not recorded")}`,
    `Models: ${report.meta.models.map(md).join(", ") || "not recorded"}`,
    `Original SHA-256: ${md(report.meta.input_sha256 ?? "not recorded")}`, "",
    "## What the checks suggest", md(assessmentTitle(report)), md(modelReadingSummary(report)), `${ratingBasis(report.consensus)}. Ratings are not calibrated probabilities.`,
    `Recorded explanation: ${md(report.consensus.explanation)}`, "",
    "## Coverage", assessmentScope(report), "", "## SDA's checks at a glance",
    ...workshopOverview(report, report.meta.kind).filter(row => !["Image history", "File history"].includes(row.label)).flatMap(row => [`- ${row.label}${row.question ? ` (${md(row.question)})` : ""}: ${md(row.finding)}. ${md(row.detail)}`,
      ...(row.answers ?? []).map(({ question, answer }) => `  - ${md(question)} ${md(answer)}`)]),
    sourceNote ? md(sourceNote) : "Workshop source note: none linked in this view.", "", "## Recorded checks"];
  for (const p of report.providers) {
    lines.push(`### ${md(p.name)}`, `Model / check: ${md(p.model ?? p.kind)}`,
      `Check status: ${checkStatus(p)}`, `Finding: ${md(providerFinding(p))}`);
    if (p.status === "ok") {
      const rating = providerRating(p);
      lines.push(`  - Recorded verdict: ${md(p.verdict.replace(/_/g, " "))}${rating === null ? "" : `; synthetic rating: ${rating}/100`}${p.confidence ? `; recorded confidence: ${md(p.confidence)}` : ""}.`);
      for (const evidence of p.evidence) lines.push(`  - Key evidence: ${md(evidence)}`);
    }
  }
  lines.push("", "## Cite this analysis", ...citationRows(report.meta).map(([label, text]) => `${label}: ${md(text)}`));
  const fileRecord = fileRecordSummary(report);
  lines.push("", "## About this file", md(fileRecord.finding), ...fileRecord.lines.map(md));
  if (["video", "audio"].includes(report.meta.kind)) {
    lines.push("", "## Soundtrack", soundtrackFinding(report), "AI-origin detection from the sound itself is outside this workflow.");
    const a = report.audio_assessment;
    lines.push(a ? `Excerpt check: ${md(a.provider)}, ${md(a.model)}; status: ${md(a.status)}. Track ${a.track_index}, ${a.start_seconds}s + ${a.duration_seconds}s.` : "Excerpt description: not checked.");
    if (a?.status === "ok") lines.push(...a.observations.map(o => `- ${md(o)}`));
    const suno = report.suno_check;
    lines.push(suno ? `Suno credential check: ${md(suno.status)}; vendor result: ${md(suno.verdict ?? "no usable result")}. ${md(suno.note)}` : "Suno credentials: not checked.");
    lines.push("Audio findings remain separate from the visual score. Audio-track credential coverage is unresolved unless established in the detailed record.");
  }
  for (const [label, note] of [["Gemini second-opinion note", report.second_opinion_gemini], ["OpenAI second-opinion note", report.second_opinion_chatgpt]]) {
    if (note) lines.push("", `## ${label}`, md(note), "Researcher-supplied note, retained separately from the automated assessment.");
  }
  if (impression || reflection) lines.push("", "## Workshop reflection", "Participant discussion notes; separate from automated scoring.",
    ...(impression ? [`First impression: ${md(impression)}`] : []), ...(reflection ? [md(reflection)] : []));
  if (responses) lines.push(...workshopResponseLines(responses));
  lines.push("", "## Questions to take away", "- Who originally shared this item?", "- What do the date, source and context tell us?",
    "- What evidence supports the accompanying claim?", "", "An item's origin and the accuracy of its accompanying claim are separate questions.",
    "Model ratings are not calibrated probabilities. The full research report retains the detailed evidence and check statuses.");
  return lines.join("\n") + "\n";
}

function workshopResponseLines(responses: WorkshopResponses): string[] {
  const lines = ["", "## Workshop responses", "Researcher/participant responses; separate from automated scoring and from documented origin."];
  if (responses.impression.length) lines.push(`Notice: ${md(responses.impression.join("; "))}${responses.impressionAfterChecks ? " (chosen after SDA findings were available)" : " (chosen before SDA findings were available in this view)"}.`);
  for (const [label, value] of [["Notice note", responses.noticeNote], ["Discussion cues", responses.clues.join("; ")], ["Discussion note", responses.discussionNote], ["Questions to follow up", responses.questions.join("; ")], ["Image-search evidence (participant note)", responses.sourceSearchNote], ["Later view", responses.laterImpression.join("; ")], ["Next actions", responses.nextActions.join("; ")], ["Reflection", responses.reflectionNote]]) {
    if (value) lines.push(`${label}: ${md(value)}`);
  }
  return lines;
}

export function workshopSessionSummary(filename: string, responses?: WorkshopResponses, status = ""): string {
  return ["# SDA Community: Session summary", "", `File: ${md(filename)}`,
    "SDA findings: no completed report is available for this session.",
    "", "## Software citation", ...softwareCitationRows().map(([label, text]) => `${label}: ${md(text)}`),
    ...(status ? [`Recorded check status: ${md(status)}`] : []),
    ...(responses ? workshopResponseLines(responses) : []), ""].join("\n");
}
