export interface ExportPreview {
  caption: string;
  image?: { dataUrl: string; width: number; height: number };
}

export interface PreviewInput {
  kind: string;
  imageUrl?: string | null;
  thumbnail?: string | null;
  analysed: boolean;
  frameLabel?: string;
}

export function previewCaption(input: PreviewInput): string {
  if (input.kind === "video") return input.analysed
    ? `Video preview: sampled still frame${input.frameLabel ? ` (${input.frameLabel})` : ""}.`
    : "Video preview.";
  if (input.kind === "audio") return "Audio preview: cover artwork or waveform.";
  if (["pdf", "pptx"].includes(input.kind)) return input.analysed
    ? `Document preview: first analysed page, slide or extracted image${input.frameLabel ? ` (${input.frameLabel})` : ""}.`
    : "Document preview: one page, slide or extracted image.";
  return input.analysed ? "Analysed image." : "Selected image.";
}

function localImage(source: string): boolean {
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(source)) return true;
  try {
    const url = new URL(source, window.location.href);
    return ["blob:", "http:", "https:"].includes(url.protocol) && url.origin === window.location.origin;
  } catch { return false; }
}

async function rasterPreview(source: string): Promise<ExportPreview["image"]> {
  if (!localImage(source)) return undefined;
  return new Promise(resolve => {
    const img = new Image();
    const finish = (value?: ExportPreview["image"]) => {
      clearTimeout(timer); img.onload = null; img.onerror = null;
      resolve(value);
    };
    const timer = setTimeout(() => { img.src = ""; finish(); }, 5000);
    img.onerror = () => finish();
    img.onload = () => {
      try {
        if (!img.naturalWidth || !img.naturalHeight) return finish();
        const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        finish({ dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
      } catch { finish(); }
    };
    img.src = source;
  });
}

export async function prepareExportPreview(input: PreviewInput): Promise<ExportPreview> {
  const sources = input.kind === "text" ? [] : input.kind === "image" ? [input.imageUrl, input.thumbnail] : [input.thumbnail];
  for (const source of sources) {
    if (!source) continue;
    const image = await rasterPreview(source);
    if (image) return { caption: previewCaption(input), image };
  }
  return { caption: input.kind === "text" ? "Text-only item: the content is recorded in the findings."
    : "A visual preview is not available for this file in the current session." };
}
