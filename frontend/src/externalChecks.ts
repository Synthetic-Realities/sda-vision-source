import type { Report } from "./types";
import type { DetectorMaterial } from "./detectorMaterial";

// A pasted demo reply records the offered example, not proof of the file sent to a service.
export interface DemoDetectorReply {
  service: "SynthID Detector";
  response: string;
  recorded_at: string;
  source_filename: string;
  source_sha256: string;
  material_id: string;
  material_label: string;
  offered_filename: string;
  offered_sha256: string;
}

export const DEMO_REPLY_SCOPE = "Participant-pasted SynthID Detector reply, linked to the prepared example below. The submitted file and service outcome have not been independently checked by SDA. Kept separate from the recorded assessment.";

export function updateDemoDetectorReplies(replies: DemoDetectorReply[], report: Report, material: DetectorMaterial, response: string): DemoDetectorReply[] {
  const remaining = replies.filter(reply => reply.material_id !== material.id);
  if (!response.trim()) return remaining;
  return [...remaining, {
    service: "SynthID Detector", response: response.slice(0, 20000), recorded_at: new Date().toISOString(),
    source_filename: report.meta.filename, source_sha256: report.meta.input_sha256 ?? "",
    material_id: material.id, material_label: material.label,
    offered_filename: material.filename, offered_sha256: material.expectedHash ?? "",
  }];
}

export function demoDetectorReplyRows(reply: DemoDetectorReply): string[][] {
  return [
    ["Service", reply.service], ["Entry", "Pasted reply"], ["Recorded at", reply.recorded_at],
    ["Example", reply.source_filename], ["Example SHA-256", reply.source_sha256 || "Not available"],
    ["Prepared material", reply.material_label], ["Offered filename", reply.offered_filename],
    ["Offered SHA-256", reply.offered_sha256 || "Not available"],
    ["Exact reply", reply.response], ["Scope", DEMO_REPLY_SCOPE],
  ];
}

export type ExternalCheckStatus = "detected" | "not_detected" | "inconclusive" | "unsupported" | "failed" | "not_checked";
export interface ExternalCheck {
  schema_version: "external-check-v1";
  id: string;
  service: "SynthID Detector";
  service_url: "https://synthid.com/";
  entry_method: "manual";
  status: ExternalCheckStatus;
  checked_at: string;
  recorded_at: string;
  operator: string;
  source_filename: string;
  source_sha256: string;
  checked_filename: string;
  checked_sha256: string;
  checked_bytes: number;
  relationship: "original" | "derived_image" | "participant_selected";
  material_label: string;
  reported_scope: string;
  reported_origin: string;
  response: string;
}

export const EXTERNAL_CHECK_SCOPE = "Manually recorded external watermark check. Covers the identified file and the service's stated scope; kept separately from SDA's model assessment and human reflections.";
export const AUDIO_EXTERNAL_SCOPE = "The built-in audio checks describe the transcript, excerpts and file information. Any external watermark check is recorded separately with its own file and coverage.";
export const externalStatus: Record<ExternalCheckStatus, string> = {
  detected: "Watermark detected", not_detected: "Watermark not detected", inconclusive: "Inconclusive",
  unsupported: "Unsupported by the service", failed: "Check failed", not_checked: "Not checked",
};

export function externalCheckRows(check: ExternalCheck): string[][] {
  return [
    ["Service", check.service], ["Service address", check.service_url], ["Result", externalStatus[check.status]],
    ["Entry", "Participant-entered record; not independently verified by SDA"],
    [check.status === "not_checked" ? "Record date" : "Check date", check.checked_at],
    ["Recorded at", check.recorded_at], ["Recorded by", check.operator || "Not stated"],
    ["Original item", check.source_filename], ["Original SHA-256", check.source_sha256 || "Not available"],
    ["Checked material", check.material_label], ["Relationship", check.relationship.replace(/_/g, " ")],
    ["Checked file", check.checked_filename], ["Checked SHA-256", check.checked_sha256],
    ["File size (bytes)", String(check.checked_bytes)], ["Coverage reported by service", check.reported_scope || "Not specified"],
    ["Origin reported by service", check.reported_origin || "Not specified"], ["Exact reply", check.response || "No reply recorded"],
    ["Scope", EXTERNAL_CHECK_SCOPE],
    ...(check.status === "not_detected" ? [["Interpretation", "Origin remains unresolved by this check; absence of a detected watermark does not establish human authorship."]] : []),
    ...(check.status === "failed" ? [["Interpretation", "The check supplied no usable watermark finding. Record a cause only if the service gives one."]] : []),
  ];
}

// Escaped plain text: a pasted reply must not become HTML, links or remote images.
const escaped = (text: string) => text.replace(/([\\`*_{}\[\]()#+.!<>|~-])/g, "\\$1");
export function demoDetectorRepliesMarkdown(replies: DemoDetectorReply[] = []): string {
  return replies.map(reply => "\n## SynthID Detector reply\n" +
    demoDetectorReplyRows(reply).map(([key, value]) => `${escaped(key)}: ${escaped(value)}\n`).join("\n")).join("");
}
export function externalChecksMarkdown(checks: ExternalCheck[] = []): string {
  return checks.map((check, index) => `\n## External watermark check ${index + 1}\n` +
    externalCheckRows(check).map(([key, value]) => `${escaped(key)}: ${escaped(value)}\n`).join("\n")).join("");
}

export function reportExternalChecks(report: Report | null): ExternalCheck[] {
  return report?.external_checks ?? [];
}
