import credits from "../../config/citation.json";
import type { Report } from "./types";

// Credit software authorship separately from the person running an analysis or
// the creator of its input media. Recorded data stays unchanged.
export function softwareCitation(version?: string): string {
  const edition = version ? `version ${version}` : "version not recorded";
  return `${credits.author} (${credits.year}) ${credits.title} (${edition}) [Computer software]. ${credits.publisher}. Available at: ${credits.url}`;
}

export function softwareCitationRows(version?: string): string[][] {
  return [
    ["Software citation", softwareCitation(version)],
    ["Software creator", credits.creator],
    ["Funding acknowledgement", credits.funding],
  ];
}

export function citationRows(meta: Report["meta"]): string[][] {
  const rows = softwareCitationRows(meta.version);
  rows.push(["Analysis record", `File: ${meta.filename}; media type: ${meta.kind}; recorded at: ${meta.generated_at}; models: ${meta.models?.join(", ") || "not recorded"}.`]);
  return rows;
}
