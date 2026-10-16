import type { Report } from "./types";
import type { ExternalCheck } from "./externalChecks";
import infographicPage from "./assets/infographic-preview.png?url";
import presentationSlide from "./assets/presentation-preview.png?url";
import presentationManifest from "../public/slides/presentation/manifest.json";
import { EXAMPLES_ONLY } from "./showcase";
import { frameImageFile } from "./api";

export interface DetectorMaterial {
  id: string; label: string; filename: string; relationship: ExternalCheck["relationship"];
  url?: string; frame?: string; expectedHash?: string;
}
export const DETECTOR_EXTENSIONS = new Set("jpg jpeg png bmp webp avif heic heif tiff tif gif mp4 mov webm wav mp3 ogg flac aac m4a".split(" "));
export const DETECTOR_ACCEPT = Array.from(DETECTOR_EXTENSIONS, ext => `.${ext}`).join(",");
export const acceptsDetectorFile = (name: string) => DETECTOR_EXTENSIONS.has(name.split(".").pop()?.toLowerCase() ?? "");

export function detectorMaterials(report: Report, originalUrl?: string, file?: File): DetectorMaterial[] {
  const { kind, filename, input_sha256 } = report.meta;
  if (["image", "audio", "video"].includes(kind) && acceptsDetectorFile(filename) && (file || originalUrl)) {
    return [{ id: "original", label: `Complete original ${kind}: ${filename}`, filename, relationship: "original", url: originalUrl, expectedHash: input_sha256 }];
  }
  const materials: DetectorMaterial[] = [];
  if (kind === "pdf" && input_sha256 === "02915f051b6eb2c9ef0c21f5bb20c4229ca21324bf20172f3867c32c299a5924") {
    materials.push({ id: "page-1", label: "PDF page 1 (rendered image)", filename: "infographic-page-1.png", relationship: "derived_image", url: infographicPage,
      expectedHash: "d06c42c3dbe400be9d827dd42ad89b4b2d20df29b99ac8b906e611c459c23e5a" });
  }
  if (kind === "pptx" && input_sha256 === presentationManifest.source_sha256) {
    materials.push({ id: "slide-1", label: "Slide 1 (rendered PNG)", filename: "presentation-slide-1.png", relationship: "derived_image", url: presentationSlide,
      expectedHash: "8973bd61b8b3164470fcbd1ef9875ca789e061bc70c0c73904f8224d9e2f5996" });
    presentationManifest.files.slice(1).forEach((slide, index) => materials.push({
      id: `slide-${index + 2}`, label: `Slide ${index + 2} (rendered JPEG)`, filename: `presentation-${slide.path}`, relationship: "derived_image",
      url: `${import.meta.env.BASE_URL}slides/presentation/${slide.path}`, expectedHash: slide.sha256,
    }));
  }
  if (!EXAMPLES_ONLY && file && ["pdf", "pptx"].includes(kind)) {
    report.frames.forEach(frame => materials.push({ id: `frame-${frame.frame}`, label: `${frame.frame} (local image extraction)`,
      filename: `${filename}-${frame.frame}.jpg`, relationship: "derived_image", frame: frame.frame }));
  }
  return materials;
}

export async function fileIdentity(file: File): Promise<{ filename: string; sha256: string; bytes: number }> {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return { filename: file.name, sha256: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join(""), bytes: file.size };
}

export async function prepareDetectorMaterial(material: DetectorMaterial, sourceFile?: File) {
  let file: File;
  if (material.frame && sourceFile) file = await frameImageFile(sourceFile, material.frame);
  else if (material.relationship === "original" && sourceFile) file = sourceFile;
  else {
    if (!material.url) throw new Error("This file is unavailable. Choose the file you checked below.");
    const response = await fetch(material.url);
    if (!response.ok) throw new Error("The file could not be prepared. Please try again.");
    const blob = await response.blob();
    file = new File([blob], material.filename, { type: blob.type });
  }
  const identity = await fileIdentity(file);
  if (material.expectedHash && identity.sha256 !== material.expectedHash) throw new Error("This download differs from the recorded file. Reopen the item before checking it.");
  return { file, identity };
}
