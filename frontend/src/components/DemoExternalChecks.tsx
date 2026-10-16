import { useEffect, useId, useRef, useState } from "react";
import { Download, ExternalLink, ScanSearch, ShieldCheck } from "lucide-react";
import type { Report } from "../types";
import { detectorMaterials, prepareDetectorMaterial } from "../detectorMaterial";
import { updateDemoDetectorReplies, type DemoDetectorReply } from "../externalChecks";
import "../externalChecks.css";

interface Props {
  report: Report;
  originalUrl?: string;
  replies: DemoDetectorReply[];
  onReplyChange: (replies: DemoDetectorReply[]) => void;
  openai: string;
  onOpenai: (reply: string) => void;
}

export default function DemoExternalChecks({ report, originalUrl, replies, onReplyChange, openai, onOpenai }: Props) {
  const id = useId();
  const materials = detectorMaterials(report, originalUrl);
  const [selection, setSelection] = useState(materials[0]?.id ?? "");
  const selected = materials.find(item => item.id === selection);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const documentLike = ["pdf", "pptx"].includes(report.meta.kind);
  const image = report.meta.kind === "image";

  async function download() {
    if (!selected) return;
    const request = ++generation.current;
    setBusy(true); setMessage("");
    try {
      const { file } = await prepareDetectorMaterial(selected);
      if (request !== generation.current) return;
      const url = URL.createObjectURL(file), link = window.document.createElement("a");
      link.href = url; link.download = file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage("Download started. Choose this prepared file on the external checker.");
    } catch (error) {
      if (request === generation.current) setMessage(error instanceof Error ? error.message : "The file could not be prepared.");
    } finally { if (request === generation.current) setBusy(false); }
  }

  return <section className="demo-external-checks" aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>External checks</h3>
    {selected ? <div className="demo-checker-material">
      <div>{materials.length > 1 ? <>
        <label htmlFor={`${id}-material`}>Material for SynthID</label>
        <select id={`${id}-material`} value={selection} disabled={busy} onChange={event => {
          generation.current++; setSelection(event.target.value); setMessage(""); setBusy(false);
        }}>{materials.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select>
      </> : <p><strong>Prepared example:</strong> {selected.label}</p>}</div>
      <button type="button" className="ghost" onClick={download} disabled={busy}>
        <Download size={18} aria-hidden="true" />{busy ? "Preparing file..." : documentLike ? "Download selected image" : "Download example"}
      </button>
    </div> : <p>This example has no prepared media for these checks.</p>}
    {documentLike && <p className="external-check-small">The SynthID reply is linked to the selected page or slide image. Keep the complete document alongside it for context.</p>}
    {message && <p className="external-check-message" role="status">{message}</p>}

    <div className="demo-checker-pair">
      <section className="demo-checker-column demo-checker-synthid" aria-labelledby={`${id}-synthid-heading`}>
        <h4 id={`${id}-synthid-heading`}><ShieldCheck size={21} aria-hidden="true" />SynthID Detector</h4>
        <a className="external-check-link" href="https://synthid.com/" target="_blank" rel="noopener noreferrer">
          Open SynthID Detector <ExternalLink size={17} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
        </a>
        <p className="external-check-small">Google receives the file you choose to upload there, including retained metadata.</p>
        <div className="demo-checker-paste">
          <label htmlFor={`${id}-synthid-reply`}>SynthID results</label>
          <textarea id={`${id}-synthid-reply`} rows={5} maxLength={20000} disabled={!selected}
            aria-describedby={`${id}-scope`} placeholder="Paste the full reply or error message here."
            value={replies.find(reply => reply.material_id === selection)?.response ?? ""}
            onChange={event => { if (selected) onReplyChange(updateDemoDetectorReplies(replies, report, selected, event.target.value)); }} />
        </div>
      </section>
      <section className="demo-checker-column demo-checker-openai" aria-labelledby={`${id}-openai-heading`}>
        <h4 id={`${id}-openai-heading`}><ScanSearch size={21} aria-hidden="true" />OpenAI image checker</h4>
        {image ? <a className="external-check-link" href="https://openai.com/research/verify/" target="_blank" rel="noopener noreferrer">
          Open OpenAI checker <ExternalLink size={17} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
        </a> : <button type="button" className="external-check-link" disabled>OpenAI checker: images only</button>}
        <p className="external-check-small">{image ? "OpenAI receives the image you choose to upload there, including retained metadata."
          : "This shortcut is for image examples. A reply from a separately checked image can be kept below with its page or frame name."}</p>
        <div className="demo-checker-paste">
          <label htmlFor={`${id}-openai-reply`}>OpenAI results</label>
          <textarea id={`${id}-openai-reply`} rows={5} maxLength={20000} aria-describedby={`${id}-scope`}
            placeholder="Paste the full reply or error message here." value={openai} onChange={event => onOpenai(event.target.value)} />
        </div>
      </section>
    </div>
    <p className="external-check-small">External checks use your account with each service and its current terms and any charges, separately from SDA's API accounts. Opening a link sends no media.</p>
    <p id={`${id}-scope`} className="external-check-small">Replies are kept in this browser session and included in session downloads, separately from the recorded findings. Download your notes before changing example or closing the page.</p>
  </section>;
}
