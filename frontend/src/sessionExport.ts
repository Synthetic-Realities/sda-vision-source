import { citationRows } from "./citation";
import type { Report } from "./types";
import { sessionRecord } from "./sessionNotes";
import { buildSummaryFile, type SummarySection } from "./workshopExport";

export type SessionFormat = "json" | "md" | "csv" | "pdf" | "pptx";

function rows(value: unknown, path = ""): string[][] {
  if (value === undefined) return [];
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return [[path, Array.isArray(value) ? "[]" : "{}"]];
    return entries.flatMap(([key, item]) => rows(item, path ? `${path}.${key}` : key));
  }
  return [[path, value === null ? "Not recorded" : String(value)]];
}

export async function buildSessionExport(reports: Report[], format: SessionFormat): Promise<Blob> {
  const record = sessionRecord(reports);
  if (format === "json") return new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const sections: SummarySection[] = [
    { heading: "SDA session scope", lines: [], rows: [
      ["Downloaded at", record.downloaded_at], ["Coverage", record.scope],
      ["Audio scope", "AI-origin detection from the sound itself is outside this workflow."],
      ["Record structure", "Findings are followed by Second Opinion notes and the session record. JSON retains every original field; readable formats omit combined-confidence labels and include individual check findings and evidence."],
    ] },
  ];
  for (const item of record.items) {
    const report = item.recorded_analysis;
    // Raw API envelopes can contain pixel/base64 data. Preserve them losslessly
    // in JSON; readable exports retain all interpreted findings and evidence.
    const { meta, providers, consensus, frames, ...findings } = report;
    const { confidence: _combinedConfidence, ...conclusion } = consensus;
    const { thumbnail: _thumb, ...metadata } = meta;
    sections.push({ heading: `Recorded analysis: ${meta.filename}`, lines: [], rows: rows({ consensus: conclusion, frames, ...findings }) });
    for (const provider of providers) {
      const { raw: _raw, ...evidence } = provider;
      sections.push({ heading: `${meta.filename}: ${provider.name}`, lines: [], rows: rows(evidence) });
    }
    sections.push({ heading: `${meta.filename}: Second Opinion notes`, lines: [], rows: rows({
      Gemini_reply: item.visitor_notes.gemini || "No session reply entered",
      Gemini_session: fresh(item.visitor_notes.geminiFresh),
      OpenAI_reply: item.visitor_notes.openai || "No session reply entered",
      OpenAI_session: fresh(item.visitor_notes.openaiFresh),
      scope: "Participant-entered account of an external check. Kept separate from the recorded assessment; independent verification is not established by this note.",
    }) });
    sections.push({ heading: `Cite this analysis: ${meta.filename}`, lines: [], rows: citationRows(meta) });
    sections.push({ heading: `Session record: ${meta.filename}`, lines: [], rows: rows(metadata) });
  }
  if (format === "md") {
    // Literal blocks prevent pasted HTML/Markdown from becoming remote images or
    // links when the downloaded Markdown is opened in another viewer.
    const literal = (text: string) => {
      const fence = "`".repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), match => match[0].length + 1)));
      return `${fence}text\n${text.replace(/\r\n?/g, "\n")}\n${fence}`;
    };
    const heading = (text: string) => text.replace(/[\r\n]/g, " ").replace(/([\\`*_{}\[\]()#+.!<>|~-])/g, "\\$1");
    return new Blob([sections.map(section => `## ${heading(section.heading)}\n\n` +
      section.rows!.map(([key, value]) => `${literal(key)}\n\n${literal(value)}\n`).join("\n")).join("\n")], { type: "text/markdown;charset=utf-8" });
  }
  return buildSummaryFile("", format, undefined, sections);
}

function fresh(value?: boolean) {
  return value === true ? "Fresh chat/check (participant stated)" : value === false ? "Existing chat (participant stated)" : "Not stated";
}

export async function downloadSession(reports: Report[], format: SessionFormat) {
  const blob = await buildSessionExport(reports, format);
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = `sda-session-${reports.length === 1 ? reports[0].meta.filename.replace(/\W+/g, "_") : "batch"}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
