import type { AudioAssessment, CorpusInfo, ExampleEntry, GraphData, ProvidersInfo, Report, SunoCheck } from "./types";
import { isLightTheme } from "./lib";
import { exampleArtwork, preparedDocumentArtwork } from "./exampleArtwork";
import {
  SHOWCASE, CONFERENCE, EXAMPLES_ONLY, showcaseExamples, showcaseFileUrl, showcaseGraph, showcasePreview,
  showcaseProviders, showcaseReport, showcaseSummary, showcaseThumb,
  showcaseVerdictMap, showcaseVerdictMapSummary, showcaseVmapFileUrl,
} from "./showcase";

export async function getProviders(): Promise<ProvidersInfo> {
  if (SHOWCASE) return showcaseProviders() as unknown as ProvidersInfo;
  const res = await fetch("/api/providers");
  if (!res.ok) throw new Error("Could not load provider status.");
  return res.json();
}

export async function getCorpus(): Promise<CorpusInfo> {
  // The static showcase has no backend: never let a /api call leave the page.
  if (SHOWCASE) return { available: false, labels: [] };
  const res = await fetch("/api/corpus");
  if (!res.ok) throw new Error("Could not load corpus.");
  return res.json();
}

export interface AnalyseArgs {
  file?: File | null;
  corpusPath?: string | null;
  caption: string;
  mode: string;
}

export async function analyse({ file, corpusPath, caption, mode }: AnalyseArgs): Promise<Report> {
  if (SHOWCASE) return showcaseReport(file?.name ?? "");
  if (CONFERENCE) {
    const res = await fetch("/api/conference/analyse", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ example_id: file?.name ?? "", mode, consent_to_providers: true }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Conference analysis failed.");
    return data;
  }
  const form = new FormData();
  if (file) form.append("file", file);
  if (corpusPath) form.append("corpus_path", corpusPath);
  form.append("caption", caption);
  form.append("mode", mode);
  const res = await fetch("/api/analyse", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || "Analysis failed.");
  return data as Report;
}

// Incremental deep pass: the server analyses ONLY the frames the capped first
// pass skipped (the file is re-uploaded because the server is stateless), then
// recombines the verdict over all frames. Not available in the static showcase.
export async function analyseDeep(
  { file, caption, mode, prior }: { file: File; caption: string; mode: string; prior: Report },
): Promise<Report> {
  if (EXAMPLES_ONLY) return prior;
  const form = new FormData();
  form.append("file", file);
  form.append("caption", caption);
  form.append("mode", mode);
  form.append("prior_report", JSON.stringify(prior));
  const res = await fetch("/api/analyse/deep", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || "Deep pass failed.");
  return data as Report;
}

// One analysed frame as a standalone image (local re-extraction, no API cost),
// so the exact analysed figure can be attached to Gemini's SynthID check
// without manual screenshotting. Full tool only (needs the backend).
export async function downloadFrameImage(file: File, label: string): Promise<boolean> {
  if (EXAMPLES_ONLY) return false;
  const form = new FormData();
  form.append("file", file);
  form.append("label", label);
  const res = await fetch("/api/frame", { method: "POST", body: form });
  if (!res.ok) return false;
  const dispo = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(dispo);
  triggerDownload(URL.createObjectURL(await res.blob()), match ? match[1] : `sda-frame-${label.replace(/\W+/g, "_")}.jpg`, true);
  return true;
}

// Annotation lane (opt-in, pointer-not-verdict): the server runs the vision
// panel once with the annotation prompt and returns validated pointers. The
// file is re-uploaded because the server is stateless. Full tool only.
export interface AnnotateResult {
  annotation_pointers: import("./types").AnnotationPointer[];
  annotation_meta: import("./types").AnnotationMeta;
}

export async function annotate(file: File, caption: string): Promise<AnnotateResult> {
  // The static showcase has no backend: never let a /api call leave the page.
  if (EXAMPLES_ONLY) throw new Error("The annotation lane needs the full tool.");
  const form = new FormData();
  form.append("file", file);
  form.append("caption", caption);
  const res = await fetch("/api/annotate", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || "Annotation lane failed.");
  return data as AnnotateResult;
}

export async function assessSoundtrack(file: File, hash: string, track: number, start: number): Promise<AudioAssessment> {
  if (EXAMPLES_ONLY) throw new Error("Soundtrack assessment needs the full local app.");
  const form = new FormData();
  form.append("file", file);
  form.append("expected_sha256", hash);
  form.append("track_index", String(track));
  form.append("start_seconds", String(start));
  form.append("consent_to_google", "true");
  const res = await fetch("/api/audio/assess", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || "Soundtrack assessment failed.");
  return data;
}

export async function checkSuno(file: File, hash: string): Promise<SunoCheck> {
  if (EXAMPLES_ONLY) throw new Error("Vendor checks need the full local app.");
  const form = new FormData();
  form.append("file", file);
  form.append("expected_sha256", hash);
  form.append("consent_to_suno", "true");
  const res = await fetch("/api/suno/check", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || "Suno check failed.");
  return data;
}

export function corpusFileUrl(path: string): string {
  return `/api/corpus/file?path=${encodeURIComponent(path)}`;
}

export async function getExamples(): Promise<ExampleEntry[]> {
  if (SHOWCASE) return showcaseExamples();
  try {
    const res = await fetch("/api/examples");
    if (!res.ok) return [];
    const files: { name: string }[] = (await res.json()).files ?? [];
    // The download link serves the original bytes via the backend, so C2PA
    // manifests and watermarks survive intact.
    return files.map((f) => ({
      name: f.name,
      downloadUrl: `/api/examples/file?name=${encodeURIComponent(f.name)}`,
    }));
  } catch {
    return [];
  }
}

// Examples are loaded as a File and analysed via the normal upload path, so they
// work in the public build (which has no corpus access).
export async function fetchExampleFile(name: string): Promise<File> {
  if (SHOWCASE) {
    // Load only the selected image/audio for preview and playback. Documents
    // use a name-only File here; their bundled originals remain downloadable.
    const { url } = await showcasePreview(name);
    if (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not load that example.");
      const blob = await response.blob();
      return new File([blob], name, { type: blob.type });
    }
    return new File([], name);
  }
  const res = await fetch(`/api/examples/file?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error("Could not load that example.");
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type });
}

// The first page/slide (or cover art / waveform) of an example, so PDFs, slide
// decks and audio show a real preview before anything has been analysed. Null
// whenever there is no visual to show - the UI falls back to the kind glyph.
export async function exampleThumb(name: string, file?: File): Promise<string | null> {
  // Presentation previews leave saved analysis thumbnails intact.
  if (SHOWCASE) {
    const prepared = preparedDocumentArtwork(name);
    if (prepared) return prepared;
  }
  try {
    const artwork = await exampleArtwork(file);
    if (artwork) return artwork;
  } catch { /* A missing cover falls back to the recorded preview. */ }
  try {
    if (SHOWCASE) return await showcaseThumb(name);
    const res = await fetch(`/api/examples/thumb?name=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    return (await res.json()).thumb ?? null;
  } catch {
    return null;
  }
}

export interface OpinionScore {
  score: number | null;
  read: string;
}

export async function scoreOpinion(text: string): Promise<OpinionScore> {
  if (EXAMPLES_ONLY) return { score: null, read: "Note scoring is unavailable in this demo." };
  try {
    const res = await fetch("/api/opinion-score", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, consent_to_anthropic: true }),
    });
    if (!res.ok) return { score: null, read: "Note scoring unavailable; original note retained." };
    return await res.json();
  } catch {
    return { score: null, read: "Note scoring failed; original note retained." };
  }
}

export interface DiffusionPayload {
  min_component?: number;
  source: string;
  threshold: number;
  edge_mode: string;
  reports?: Report[];
  // For the per-item verdict map in the showcase: which cached record to use.
  itemName?: string;
  // PNG export only: colour nodes the way the on-screen graph is coloured.
  colour_by?: string;
  // PNG export only: match the download's chrome (background, labels, edges)
  // to the interface theme it was taken from. Node data colours are identical
  // in both.
  theme?: "dark" | "light";
}

export async function getDiffusion(p: DiffusionPayload): Promise<GraphData> {
  if (SHOWCASE) {
    return p.source === "item" && p.itemName ? showcaseVerdictMap(p.itemName) : showcaseGraph();
  }
  const res = await fetch("/api/diffusion", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || "Could not build graph.");
  return data as GraphData;
}

function triggerDownload(url: string, filename: string, revoke: boolean) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  if (revoke) URL.revokeObjectURL(url);
}

async function downloadDiffusionFile(p: DiffusionPayload, path: string, filename: string): Promise<void> {
  const res = await fetch(path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error("Could not export file.");
  triggerDownload(URL.createObjectURL(await res.blob()), filename, true);
}

export async function downloadDiffusionGexf(p: DiffusionPayload): Promise<void> {
  if (SHOWCASE) {
    const url = p.source === "item" && p.itemName
      ? await showcaseVmapFileUrl(p.itemName, "gexf") : showcaseFileUrl("gexf");
    triggerDownload(url, `sda-diffusion-${p.source === "item" ? "item" : "showcase"}.gexf`, false);
    return;
  }
  return downloadDiffusionFile(p, "/api/diffusion/gexf", `sda-diffusion-${p.source}.gexf`);
}

export async function downloadDiffusionCsv(p: DiffusionPayload): Promise<void> {
  if (SHOWCASE) {
    const url = p.source === "item" && p.itemName
      ? await showcaseVmapFileUrl(p.itemName, "csv") : showcaseFileUrl("csv");
    triggerDownload(url, `sda-diffusion-${p.source === "item" ? "item" : "showcase"}-csv.zip`, false);
    return;
  }
  return downloadDiffusionFile(p, "/api/diffusion/csv", `sda-diffusion-${p.source}-csv.zip`);
}

export async function downloadDiffusionPng(p: DiffusionPayload): Promise<void> {
  const mode = p.colour_by || "verdict";
  // The PNG chrome follows the interface theme at the moment of download
  // (light for the light and console themes, dark otherwise).
  const light = isLightTheme();
  const suffix = light ? "-light" : "";
  if (SHOWCASE) {
    const url = p.source === "item" && p.itemName
      ? await showcaseVmapFileUrl(p.itemName, "png", mode, light) : showcaseFileUrl("png", mode, light);
    triggerDownload(url, `sda-diffusion-${p.source === "item" ? "item" : "showcase"}-by-${mode}${suffix}.png`, false);
    return;
  }
  return downloadDiffusionFile(
    { ...p, theme: light ? "light" : "dark" },
    "/api/diffusion/png",
    `sda-diffusion-${p.source}-by-${mode}${suffix}.png`,
  );
}

export interface DiffusionSummary {
  headline: string;
  caption: string;
  paragraph: string;
}

export async function getDiffusionSummary(p: DiffusionPayload): Promise<DiffusionSummary> {
  if (SHOWCASE) {
    return p.source === "item" && p.itemName ? showcaseVerdictMapSummary(p.itemName) : showcaseSummary();
  }
  const res = await fetch("/api/diffusion/summary", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || "Could not write the summary.");
  return { headline: data.headline, caption: data.caption, paragraph: data.paragraph };
}
