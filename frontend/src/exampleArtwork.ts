import podcastCover from "./assets/podcast-cover.png";
import infographicPreview from "./assets/infographic-preview.png";
import presentationPreview from "./assets/presentation-preview.png";

// Presentation previews match the exact approved originals. Historical analysis
// thumbnails and provider inputs remain part of their unchanged saved records.
const ARTWORK: Record<string, string> = {
  "58663a6a9e4b634bdb703ead0aaa7cd6dce7fbf97e70c3c1cc61b3311b94c0b4": podcastCover,
  "02915f051b6eb2c9ef0c21f5bb20c4229ca21324bf20172f3867c32c299a5924": infographicPreview,
  "d0ec89da564078611922195fca82364f2f8e63d253d02a6d9bb672a8265c5f15": presentationPreview,
};

export async function exampleArtwork(file?: File): Promise<string | null> {
  if (!file || !/\.(m4a|pdf|pptx)$/i.test(file.name) || !file.size) return null;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return ARTWORK[hash] ?? null;
}

// The static document selector uses name-only Files. Its originals are checked
// against the approved bundle during release preparation, without downloading
// the entire document just to show its cover.
export function preparedDocumentArtwork(name: string): string | null {
  return ({ "infographic.pdf": infographicPreview, "presentation.pptx": presentationPreview } as Record<string, string>)[name] ?? null;
}
