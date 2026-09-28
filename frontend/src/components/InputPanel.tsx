import { developerExampleLabel } from "../workshopExamples";
import { SHOWCASE, CONFERENCE, EXAMPLES_ONLY } from "../showcase";
import { useEffect, useId, useRef, useState } from "react";
import { Search, Upload, X, ZoomIn } from "lucide-react";
import type { CorpusInfo, ExampleEntry } from "../types";
import { AUD_EXT, extOf, IMG_EXT, VID_EXT } from "../lib";
import PresentationPreview from "./PresentationPreview";
import type { SlidePreviewState } from "../useSlidePreview";
import AudioPreview from "./AudioPreview";

interface Props {
  mode: "general" | "vaccine";
  setMode: (m: "general" | "vaccine") => void;
  vaccineEnabled: boolean;
  onSelectFile: (f: File | null) => void;
  onSelectCorpus: (path: string, name: string) => void;
  previewUrl: string | null;
  previewName: string;
  caption: string;
  setCaption: (s: string) => void;
  onAnalyse: () => void;
  busy: boolean;
  running: boolean;
  status: string;
  corpus: CorpusInfo | null;
  examples: ExampleEntry[];
  onSelectExample: (name: string) => void;
  hasInput: boolean;
  // Only a frozen showcase disallows uploads; normal BYOK mode permits them.
  allowUpload: boolean;
  // The analysed item's visual from the report (first page/slide, cover art or
  // waveform), so documents and audio show what was analysed, not a glyph.
  reportThumb?: string;
  // True when reportThumb is a pre-run preview rather than a frame from a
  // finished report, so the caption does not claim more than it should.
  thumbIsPreview?: boolean;
  slidePreview?: SlidePreviewState;
}

const MODE_HELP: Record<string, string> = {
  general: "General synthetic-media and provenance analysis.",
  vaccine:
    "Optional research lens: suggests vaccine and health framing codes for qualitative review alongside the source and wider evidence.",
};

export default function InputPanel(p: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const [enlarged, setEnlarged] = useState(false);
  const mediaArea = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const enlargeButton = useRef<HTMLButtonElement>(null);
  const previewHeading = useId();
  const extension = extOf(p.previewName);
  const isAudio = AUD_EXT.includes(extension);
  const isVideo = VID_EXT.includes(extension);
  const canEnlarge = Boolean(!(extension === "pptx" && p.slidePreview) && p.previewUrl && (IMG_EXT.includes(extension) || isAudio || isVideo || p.reportThumb));
  useEffect(() => { setEnlarged(false); }, [p.previewUrl]);
  useEffect(() => { if (enlarged) dialog.current?.showModal(); }, [enlarged]);

  function openLarger() {
    mediaArea.current?.querySelectorAll("audio, video").forEach(media => (media as HTMLMediaElement).pause());
    setEnlarged(true);
  }

  function onFiles(list: FileList | null) {
    if (p.busy) return;
    p.onSelectFile(list && list.length ? list[0] : null);
  }

  function preview() {
    if (!p.previewUrl) {
      return p.allowUpload ? (
        <div className="drop-empty">
          <strong>Drop a file</strong>
          <span>or click to choose. Image, PDF, PPTX, video, audio, transcript</span>
        </div>
      ) : (
        <div className="drop-empty">
          <strong>Demo mode</strong>
          <span>{SHOWCASE ? "Choose a bundled example to open its recorded findings." : "Choose a prepared example for live analysis."}</span>
        </div>
      );
    }
    const ext = extOf(p.previewName);
    if (IMG_EXT.includes(ext)) return <img className="preview" alt="" src={p.previewUrl} />;
    if (VID_EXT.includes(ext)) return <video className="preview" controls preload="metadata" src={p.previewUrl} aria-label={`Video: ${p.previewName}`} />;
    if (AUD_EXT.includes(ext)) {
      return <AudioPreview url={p.previewUrl} name={p.previewName} artwork={p.reportThumb} />;
    }
    // Documents: show the first page/slide instead of a bare kind glyph - as a
    // preview on selection, then as the actual analysed frame after a run.
    if (p.reportThumb) {
      return (
        <div className="preview-stack">
          <img className="preview" alt="" src={p.reportThumb} />
          {/* Before a run the image needs no caption: the filename already sits
              directly under the dropzone. After a run the caption earns its place
              by naming WHICH frame of the document was analysed. */}
          {!p.thumbIsPreview && (
            <small className="muted">{p.previewName} (first analysed frame)</small>
          )}
        </div>
      );
    }
    const kind =
      ext === "pdf" ? "PDF document"
      : ext === "pptx" ? "Slide deck"
      : ["txt", "srt", "vtt", "md"].includes(ext) ? "Transcript / text"
      : "File";
    return (
      <div className="preview-doc">
        <strong>{ext.toUpperCase()}</strong>
        <span>{kind}</span>
        <small>{p.previewName}</small>
      </div>
    );
  }

  return (
    <section className="panel input-panel">
      {p.vaccineEnabled && (
        <div className="mode-toggle" role="tablist">
          <button disabled={p.busy} className={`mode ${p.mode === "general" ? "active" : ""}`} onClick={() => p.setMode("general")}>
            General
          </button>
          <button disabled={p.busy} className={`mode ${p.mode === "vaccine" ? "active" : ""}`} onClick={() => p.setMode("vaccine")}>
            Vaccine lens (research)
          </button>
        </div>
      )}
      <p className="muted small">{MODE_HELP[p.mode]}</p>

      {p.allowUpload && <button type="button" className="ghost" disabled={p.busy}
        onClick={() => inputRef.current?.click()}><Upload size={18} aria-hidden="true" />Upload single file</button>}

      {p.previewUrl && (isAudio || isVideo) && <div className="media-play-prompt">
        <h3>{isAudio ? "Listen to the recording" : "Watch the video"}</h3>
        <p className="muted small">Use the player to {isAudio ? "listen" : "watch"} before exploring the findings.</p>
      </div>}
      <div ref={mediaArea}>
      {p.allowUpload ? (
        <label
          className={`dropzone ${dragging ? "drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
        >
          <input
            ref={inputRef}
            type="file"
            aria-label="Upload single file"
            disabled={p.busy}
            hidden
            accept="image/*,application/pdf,.pptx,video/*,audio/*,.txt,.srt,.vtt,.md,.m4a"
            onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }}
          />
          {preview()}
        </label>
      ) : (
        <div className="dropzone demo">{preview()}</div>
      )}
      </div>
      <div className="developer-media-meta">
        {p.previewName && <p className="muted small preview-name">{developerExampleLabel(p.previewName)}</p>}
        {canEnlarge && <button ref={enlargeButton} type="button" className="ghost media-enlarge" title="View larger" aria-label="View larger" onClick={openLarger}><ZoomIn size={21} aria-hidden="true" /></button>}
      </div>
      {extension === "pptx" && p.slidePreview && <PresentationPreview key={p.previewUrl} state={p.slidePreview} compact/>}
      {enlarged && <dialog ref={dialog} className="developer-media-dialog" aria-labelledby={previewHeading}
        onClose={() => { setEnlarged(false); enlargeButton.current?.focus(); }}>
        <h2 id={previewHeading}>{developerExampleLabel(p.previewName)}</h2>
        <button type="button" className="ghost media-dialog-close" aria-label="Close larger view" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></button>
        {preview()}
      </dialog>}

      {p.examples.length > 0 && (
        <div className="examples">
          <span className="muted small">Try an example:</span>
          <div className="example-buttons">
            {p.examples.map((e) => (
              <div key={e.name} className="example-row">
                <button disabled={p.busy} className={`example-btn${p.previewName === e.name ? " selected-example" : ""}`} aria-pressed={p.previewName === e.name} onClick={() => p.onSelectExample(e.name)}>
                  {developerExampleLabel(e.name)}
                </button>
                {e.downloadUrl ? (
                  <a
                    className="example-dl"
                    href={e.downloadUrl}
                    download={e.name}
                    title={`Download the original ${developerExampleLabel(e.name)} - for example, to attach in your own second-opinion checks. Original bytes, so provenance credentials and watermarks stay intact.`}
                    aria-label={`Download ${developerExampleLabel(e.name)}`}
                  >
                    ↓
                  </a>
                ) : (
                  <span className="example-dl off" title={e.downloadNote} aria-label={e.downloadNote} role="note">
                    ↓
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {p.corpus?.available && (
        <details className="corpus">
          <summary>Or pick from the labelled corpus</summary>
          <div className="corpus-browser">
            {p.corpus.labels.map((l) => (
              <div key={l.label}>
                <div className="corpus-label">{l.label.replace(/_/g, " ")} ({l.count})</div>
                {l.files.map((f) => (
                  <button disabled={p.busy} key={f.path} className="corpus-file" onClick={() => p.onSelectCorpus(f.path, f.name)}>
                    {f.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}

      {!EXAMPLES_ONLY && <label className="field">
        <span>Caption / context (optional)</span>
        <textarea
          rows={3}
          disabled={p.busy}
          placeholder="Paste the post caption or any context for the researcher's note."
          value={p.caption}
          onChange={(e) => p.setCaption(e.target.value)}
        />
      </label>}

      <button className="primary" disabled={!p.hasInput || p.busy} onClick={p.onAnalyse}>
        <Search size={18} aria-hidden="true" />
        {p.running ? (SHOWCASE ? "Opening saved results…" : "Analysing…") : (SHOWCASE ? "Open saved results" : CONFERENCE ? "Run live analysis" : "Run analysis")}
      </button>
      {p.status && <p className="muted small">{p.status}</p>}
    </section>
  );
}
