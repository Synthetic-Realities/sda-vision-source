import type { Report } from "./types";

export interface SessionNotes {
  gemini: string;
  openai: string;
  geminiFresh?: boolean;
  openaiFresh?: boolean;
}

// Session overlays never alter the stored example or the report's scored fields.
// Weak keys retain notes while the report is held by the current item/batch only.
const notes = new WeakMap<Report, SessionNotes>();
export function sessionNotes(report: Report | null): SessionNotes {
  return (report && notes.get(report)) || { gemini: "", openai: "" };
}
export function updateSessionNotes(report: Report, patch: Partial<SessionNotes>) {
  notes.set(report, { ...sessionNotes(report), ...patch });
}

export function sessionRecord(reports: Report[]) {
  return {
    record_type: "SDA browser session",
    downloaded_at: new Date().toISOString(),
    scope: "Recorded analyses with separately entered session notes. The combined assessments retain their recorded values. Ratings are not calibrated probabilities. Distribution history: not assessed.",
    items: reports.map(report => ({ recorded_analysis: report, visitor_notes: sessionNotes(report) })),
  };
}
