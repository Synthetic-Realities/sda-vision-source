import type { Verdict } from "./types";

export function verdictLabel(v: string): string {
  return v.replace(/_/g, " ");
}

// Whether the interface is currently on a light-background theme ("light",
// "console", "studio" or "ppie"); "dark" and "pulse" are dark. Read live so downloads
// taken after a theme switch match what is on screen.
export function isLightTheme(): boolean {
  if (["community", "trainer"].includes(document.documentElement.dataset.presentation ?? "")) return true;
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "console" || t === "ppie" || t === "studio";
}

export function verdictColor(v: Verdict | string): string {
  const map: Record<string, string> = {
    synthetic_likely: "var(--danger)",
    partially_synthetic: "var(--partial)",
    authentic_likely: "var(--good)",
    inconclusive: "var(--muted)",
    not_applicable: "var(--muted)",
  };
  return map[v] || "var(--muted)";
}

// Matches app/diffusion.py PALETTE (modularity-community colours).
export const COMMUNITY_PALETTE = [
  "#4f8cff", "#ef5b5b", "#2fbf71", "#d98324",
  "#8a5bff", "#2dc8c8", "#f0a830", "#c85aa0",
];

export function ratingColor(r: number): string {
  if (r >= 70) return "var(--danger)";
  if (r >= 40) return "var(--partial)";
  if (r <= 25) return "var(--good)";
  return "var(--warn)";
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export const IMG_EXT = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
export const VID_EXT = ["mp4", "mov", "webm", "m4v"];
export const AUD_EXT = ["m4a", "mp3", "wav", "aac", "flac"];

export function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

// Task 4: plain-language reasons a signal might disagree with the verdict.
// Written generically; shown only when that signal dissents.
export function dissentNote(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("vision")) {
    return (
      "Visual assessments can vary with compression, filters, screenshots, re-saves and " +
      "stylised imagery. Review alongside source information and the other findings."
    );
  }
  if (n.includes("forensic") || n.includes("local")) {
    return (
      "Local forensics reacts to missing camera metadata and unusual noise, which also occur " +
      "in PNG news graphics, screenshots, exported or re-saved files, and professional studio " +
      "portraits. These observations are considered alongside the model assessments."
    );
  }
  if (n.includes("c2pa")) {
    return (
      "Credential presence, file integrity, signer trust and declarations are assessed separately. " +
      "When credentials are missing, origin remains unresolved by this check."
    );
  }
  if (n.includes("synthid")) {
    return (
      "Interpret the result within this checker's supported media and watermark coverage."
    );
  }
  return "Review this finding alongside the model assessments and source context.";
}

// Produce a base64 JPEG thumbnail (no data: prefix) from an image URL, for
// embedding in PPTX/PDF exports. Returns null for non-images / load failures.
export async function imageThumb(url: string | undefined, max = 360): Promise<string | null> {
  if (!url) return null;
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82).split(",")[1] || null;
  } catch {
    return null;
  }
}

// Presentation nicety: every evidence bullet starts with a capital letter
// (cached records predate the server-side capitalisation).
export function capFirst(s: string): string {
  return s && /[a-z]/.test(s[0]) ? s[0].toUpperCase() + s.slice(1) : s;
}

// What the text block IS per input kind - a podcast transcript is not
// "visible text", and a reviewer will notice.
export function visibleTextLabel(kind: string): string {
  return ({ audio: "Transcribed text", text: "Text content",
            pdf: "Extracted text", pptx: "Extracted text" } as Record<string, string>)[kind]
    ?? "Visible text";
}

// Task 5: the question we hand to a second-opinion assistant. Kind-aware:
// Gemini's SynthID tool accepts ONE directly attached image (or a video/audio
// file) per check and refuses PDF/PPTX containers and multi-image batches, so
// for documents the prompt is written for exactly one extracted frame image
// per message, and the UI walks the researcher through that one-at-a-time flow.
export function secondOpinionPrompt(filename: string, kind = "image", frameLabels: string[] = []): string {
  const shared =
    "Keep it brief: one short paragraph, no more than about 80 words. End with a one-line " +
    "assessment (for example: likely synthetic / partly edited / likely authentic) and your confidence. " +
    "Treat this as one evidence signal for a human to weigh, not a final verdict. ";
  if (kind === "pdf" || kind === "pptx") {
    const frames = frameLabels.length ? ` I will check the other extracted images (${frameLabels.join(", ")}) in separate messages.` : " I will check other extracted images in separate messages.";
    return (
      "I am checking whether an image extracted from a document may be AI-generated or AI-edited " +
      "for research. I am attaching exactly ONE extracted image, because SynthID checks a single " +
      "directly attached image at a time. Please run a SynthID or watermark check on this image " +
      "if you can, then give your honest assessment of how synthetic it looks and why, naming the " +
      "key visual tells. Begin your reply with the attached file's name (or a short description of " +
      "the image if it has no meaningful name) so I can match it to my records. " + shared +
      "(I am NOT attaching the source file and you should not request it: watermark checkers " +
      `cannot read PDF or PPTX files.${frames} For the record only, the images come from: ${filename}.)`
    );
  }
  return (
    "I am checking whether a media file may be AI-generated or AI-edited for research. " +
    "Please give your honest assessment of how synthetic it looks and why, naming the key " +
    "tells, and note any content-provenance or watermark signal you can see. " +
    shared + `(File: ${filename})`
  );
}
