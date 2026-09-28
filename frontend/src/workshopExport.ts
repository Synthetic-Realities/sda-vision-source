import brandLogoUrl from "./assets/sda-vision-logo.png?url";
import { Lexer, type Token, type Tokens } from "marked";
import fontUrl from "./assets/fonts/NotoSans-Regular.ttf?url";
import mathFontUrl from "./assets/fonts/NotoSansMath-Regular.ttf?url";
import type { ExportPreview } from "./exportPreview";

export type SummaryFormat = "pdf" | "pptx" | "csv";
export interface SummarySection { heading: string; lines: string[]; rows?: string[][] }

function plain(tokens: Token[]): string {
  return tokens.map(token => {
    if (token.type === "space" || token.type === "br") return "\n";
    if (token.type === "list") return "\n" + (token as Tokens.List).items.map(item => plain(item.tokens)).join("\n") + "\n";
    if ("tokens" in token && token.tokens) return plain(token.tokens);
    return "text" in token ? String(token.text) : "";
  }).join("");
}

// Read the app's escaped Markdown as data: no HTML rendering or link requests.
export function summarySections(summary: string): SummarySection[] {
  const sections: SummarySection[] = [{ heading: "Session record", lines: [] }];
  for (const token of Lexer.lex(summary, { gfm: false })) {
    if (token.type === "heading") {
      if (token.depth > 1) sections.push({ heading: plain(token.tokens ?? []), lines: [] });
    } else sections.at(-1)!.lines.push(...plain([token]).split("\n").filter(line => line.trim()));
  }
  const [record, ...content] = sections;
  return [...content, record].filter(section => section.lines.length);
}

export function summaryRows(section: SummarySection): string[][] {
  if (section.rows) return section.rows;
  return section.lines.map((line, index) => {
    const split = line.match(/^([^:]{1,64}):\s+(.+)$/);
    const label = section.heading === "Coverage" ? "Scope" : section.heading === "What the checks suggest" ? "Finding"
      : section.heading.includes("opinion") ? "Recorded note" : "Observation";
    return split ? [split[1], split[2]] : [`${label} ${index + 1}`, line];
  });
}

export function summaryCsv(sections: SummarySection[]): string {
  const cell = (text: string) => {
    const safe = /^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [["Section", "Field", "Detail"], ...sections.flatMap(section =>
    summaryRows(section).map(row => [section.heading, ...row]))]
    .map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

const fontData = new Map<string, Promise<string>>();
function loadFont(url = fontUrl): Promise<string> {
  let loaded = fontData.get(url);
  if (!loaded) { loaded = fetch(url).then(async response => {
    if (!response.ok) throw new Error("A local export asset could not be loaded. Please retry.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    return btoa(chunks.join(""));
  }).catch(error => { fontData.delete(url); throw error; });
  fontData.set(url, loaded); }
  return loaded;
}

export async function buildSummaryFile(summary: string, format: SummaryFormat, media?: ExportPreview, suppliedSections?: SummarySection[]): Promise<Blob> {
  const sections = suppliedSections ?? summarySections(summary);
  if (format === "csv") return new Blob([summaryCsv(sections)], { type: "text/csv;charset=utf-8" });
  if (media && !media.image) sections.unshift({ heading: "Media preview", lines: [media.caption] });
  const logoData = "data:image/png;base64," + await loadFont(brandLogoUrl);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("NotoSans-Regular.ttf", await loadFont());
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans", "normal");
  const allText = sections.map(section => section.heading + summaryRows(section).flat().join("")).join("");
  const covers = () => {
    const metadata = doc.getFont().metadata as { characterToGlyph?: (code: number) => number };
    return [...allText].every(char => /\s/.test(char) || !!metadata.characterToGlyph?.(char.codePointAt(0)!));
  };
  if (!covers()) {
    // A complete-text fallback covers mathematical symbols in saved notes,
    // including the podcast's ≤ limit, without rewriting recorded text.
    doc.addFileToVFS("NotoSansMath-Regular.ttf", await loadFont(mathFontUrl));
    doc.addFont("NotoSansMath-Regular.ttf", "NotoSansMath", "normal");
    doc.setFont("NotoSansMath", "normal");
    if (!covers()) throw new Error("Some characters need a font this export does not include. Choose CSV to keep all original text.");
  }
  if (format === "pptx") {
    const { default: PptxGenJS } = await import("pptxgenjs");
    const deck = new PptxGenJS();
    deck.layout = "LAYOUT_WIDE";
    deck.author = "SDA Community";
    deck.subject = "Workshop findings and selected participant responses";
    deck.title = "SDA Vision: Session summary";
    deck.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
    if (media?.image) {
      const slide = deck.addSlide();
      const scale = Math.min(12.2 / media.image.width, 4.8 / media.image.height);
      const w = media.image.width * scale, h = media.image.height * scale;
      slide.addImage({ data: logoData, x: .5, y: .08, w: 1.95, h: .65, altText: "SDA Vision" });
      slide.addText("Media preview", { x: .55, y: .8, w: 12.2, h: .5, fontSize: 26, bold: true, color: "21243A", margin: 0 });
      slide.addImage({ data: media.image.dataUrl, x: (13.3 - w) / 2, y: 1.5 + (4.8 - h) / 2, w, h, altText: media.caption });
      slide.addText(media.caption, { x: .55, y: 6.45, w: 12.2, h: .42, fontSize: 14, color: "21243A", margin: 0 });
      slide.addText("File details and findings follow. The original media file remains unchanged.", { x: .55, y: 7.03, w: 11.5, h: .25, fontSize: 10, color: "545B6D", margin: 0 });
      slide.slideNumber = { x: 12.2, y: 7.03, w: .5, h: .25, fontSize: 10, color: "545B6D" };
      slide.addNotes(media.caption + "\n" + (sections[0]?.lines.join("\n") ?? ""));
    }
    for (const section of sections) {
      let part = 0;
      const newSlide = () => {
        const slide = deck.addSlide();
        part++;
        slide.background = { color: "FFFFFF" };
        slide.addImage({ data: logoData, x: .5, y: .08, w: 1.95, h: .65, altText: "SDA Vision" });
        slide.addText(section.heading + (part > 1 ? " (continued)" : ""), { x: .55, y: .85, w: 12.2, h: .8, fontSize: 26, bold: true, color: "21243A", margin: 0 });
        slide.addText("Session summary | Findings and participant responses are recorded separately.", { x: .55, y: 7.03, w: 11.5, h: .25, fontSize: 10, color: "545B6D", margin: 0 });
        slide.slideNumber = { x: 12.2, y: 7.03, w: .5, h: .25, fontSize: 10, color: "545B6D" };
        slide.addNotes(section.heading + "\n" + section.lines.join("\n"));
        slide.addTable([[{ text: "Field" }, { text: "Detail" }]], { x: .55, y: 1.85, w: 12.2, h: .4, colW: [3, 9.2], fontFace: "Arial", fontSize: 14, bold: true, color: "FFFFFF", fill: { color: "16787C" }, margin: 6, border: { type: "solid", color: "16787C", pt: .5 }, autoPage: false });
        return slide;
      };
      let slide = newSlide(), y = 2.25;
      doc.setFontSize(16);
      for (const [index, row] of summaryRows(section).entries()) {
        const cells = row.map((value, i) => doc.splitTextToSize(value, (i ? 9.2 : 3) * 72 - 25) as string[]);
        const count = Math.max(...cells.map(cell => cell.length));
        for (let start = 0; start < count;) {
          let available = Math.floor((6.75 - y - .19) / .27);
          if (available < 2) { slide = newSlide(); y = 2.25; available = 15; }
          const take = Math.min(available, count - start);
          const values = cells.map((cell, i) => cell.slice(start, start + take).join("\n") || (i === 0 ? "Continued" : ""));
          const h = take * .27 + .19;
          slide.addTable([values.map(text => ({ text }))], { x: .55, y, w: 12.2, h, colW: [3, 9.2], rowH: h, fontFace: "Arial", fontSize: 16, color: "21243A", fill: { color: index % 2 ? "F3F8F8" : "FFFFFF" }, margin: 6, valign: "top", border: { type: "solid", color: "D1DBDF", pt: .5 }, autoPage: false });
          y += h; start += take;
        }
      }
    }
    const result = await deck.write({ outputType: "blob", compression: true });
    if (!(result instanceof Blob)) throw new Error("The presentation could not be created.");
    return result;
  }

  doc.setProperties({ title: "SDA Vision: Session summary", author: "SDA Community" });
  const height = doc.internal.pageSize.getHeight(), width = doc.internal.pageSize.getWidth();
  const col = [135, width - 84 - 135];
  let y = 90, sectionTitle = "";
  function header() {
    doc.addImage(logoData, "PNG", 38, 10, 138, 46);
    doc.setFontSize(10); doc.setTextColor("#545B6D"); doc.text("SDA Community / Session summary", 192, 38);
    doc.text(`Findings and participant responses are recorded separately. | ${doc.getNumberOfPages()}`, 42, height - 25);
  }
  function tableHeading(continued = false) {
    doc.setFontSize(14); doc.setTextColor("#126E73");
    const lines = doc.splitTextToSize(sectionTitle + (continued ? " (continued)" : ""), width - 84);
    doc.text(lines, 42, y); y += lines.length * 19 + 8;
    doc.setFillColor("#16787C"); doc.rect(42, y, width - 84, 25, "F");
    doc.setFontSize(10); doc.setTextColor("#FFFFFF");
    doc.text("Field", 50, y + 17); doc.text("Detail", 50 + col[0], y + 17); y += 25;
  }
  function page() { doc.addPage(); y = 90; header(); tableHeading(true); }
  header();
  if (media?.image) {
    doc.setFontSize(14); doc.setTextColor("#126E73"); doc.text("Media preview", 42, y);
    y += 16;
    const scale = Math.min((width - 84) / media.image.width, 270 / media.image.height);
    const w = media.image.width * scale, h = media.image.height * scale;
    doc.addImage(media.image.dataUrl, "PNG", (width - w) / 2, y, w, h);
    y += h + 18;
    doc.setFontSize(10); doc.setTextColor("#545B6D");
    const caption = doc.splitTextToSize(media.caption, width - 84) as string[];
    doc.text(caption, 42, y); y += caption.length * 14 + 20;
  }
  for (const section of sections) {
    sectionTitle = section.heading;
    if (y > height - 180) { doc.addPage(); y = 90; header(); }
    tableHeading();
    for (const [index, row] of summaryRows(section).entries()) {
      doc.setFontSize(10);
      const cells = row.map((value, i) => doc.splitTextToSize(value, col[i] - 18) as string[]);
      const count = Math.max(...cells.map(cell => cell.length));
      for (let start = 0; start < count;) {
        let available = Math.floor((height - 50 - y - 16) / 15);
        if (available < 2) { page(); available = Math.floor((height - 50 - y - 16) / 15); }
        const take = Math.min(count - start, available), h = take * 15 + 16;
        let x = 42;
        for (let i = 0; i < 2; i++) {
          doc.setFillColor(index % 2 ? "#F3F8F8" : "#FFFFFF"); doc.setDrawColor("#D1DBDF");
          doc.rect(x, y, col[i], h, "FD");
          doc.setFontSize(10); doc.setTextColor("#21243A");
          const lines = cells[i].slice(start, start + take);
          if (lines.length || i === 0) doc.text(lines.length ? lines : ["Continued"], x + 9, y + 18, { lineHeightFactor: 1.5 });
          x += col[i];
        }
        start += take; y += h;
      }
    }
    y += 26;
  }
  return doc.output("blob");
}

export async function downloadWorkshopSummary(summary: string, filename: string, format: SummaryFormat, media?: ExportPreview): Promise<void> {
  const blob = await buildSummaryFile(summary, format, media);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sda-community-${(filename || "session").replace(/\W+/g, "_")}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
