import { useEffect, useId, useRef, useState } from "react";
import { Download, ExternalLink, ShieldCheck } from "lucide-react";
import type { Report } from "../types";
import { EXAMPLES_ONLY, SHOWCASE } from "../showcase";
import { detectorMaterials, prepareDetectorMaterial, fileIdentity, acceptsDetectorFile, DETECTOR_ACCEPT } from "../detectorMaterial";
import { externalCheckRows, externalStatus, EXTERNAL_CHECK_SCOPE, updateDemoDetectorReplies, type DemoDetectorReply, type ExternalCheck, type ExternalCheckStatus } from "../externalChecks";
import "../externalChecks.css";

interface Props {
  report: Report; originalUrl?: string; sourceFile?: File; community?: boolean;
  checks: ExternalCheck[]; onChange: (checks: ExternalCheck[]) => void;
  replies?: DemoDetectorReply[]; onReplyChange?: (replies: DemoDetectorReply[]) => void;
}
interface Prepared {
  filename: string; sha256: string; bytes: number;
  label: string; relationship: ExternalCheck["relationship"];
}

export default function ExternalWatermarkCheck({ report, originalUrl, sourceFile, checks, onChange, community, replies = [], onReplyChange }: Props) {
  const id = useId();
  const materials = detectorMaterials(report, originalUrl, sourceFile);
  const [selection, setSelection] = useState(materials[0]?.id ?? "");
  const selected = materials.find(item => item.id === selection);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<ExternalCheckStatus>("not_checked");
  const [response, setResponse] = useState("");
  const [origin, setOrigin] = useState("");
  const [scope, setScope] = useState("");
  const [operator, setOperator] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [attested, setAttested] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const doc = ["pdf", "pptx"].includes(report.meta.kind);
  const complete = prepared && attested && date && (status === "not_checked" || response.trim()) && checks.length < 30 && !busy;

  function resetMaterial() {
    generation.current++;
    setPrepared(null); setBusy(false); setMessage(""); setAttested(false);
    setStatus("not_checked"); setResponse(""); setOrigin(""); setScope("");
  }
  async function download() {
    if (!selected) return;
    resetMaterial(); setBusy(true);
    const request = generation.current;
    try {
      const { file, identity } = await prepareDetectorMaterial(selected, EXAMPLES_ONLY ? undefined : sourceFile);
      if (request !== generation.current) return;
      setPrepared({ ...identity, label: selected.label, relationship: selected.relationship });
      const url = URL.createObjectURL(file), link = document.createElement("a");
      link.href = url; link.download = file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage(SHOWCASE ? "Download started. Choose this file on SynthID, then paste its reply below." : "Download started. Choose this file on SynthID, then record its reply below.");
    } catch (error) {
      if (request === generation.current) setMessage(error instanceof Error ? error.message : "The file could not be prepared.");
    } finally { if (request === generation.current) setBusy(false); }
  }
  async function chooseFile(file?: File) {
    resetMaterial();
    if (!file) return;
    if (!acceptsDetectorFile(file.name)) { setMessage("Choose an image, audio or video format listed by SynthID. PDF and PPTX containers are not offered."); return; }
    setBusy(true);
    const request = generation.current;
    try {
      const identity = await fileIdentity(file);
      if (request !== generation.current) return;
      const original = Boolean(report.meta.input_sha256) && identity.sha256 === report.meta.input_sha256;
      setPrepared({ ...identity, label: original ? `Complete original ${report.meta.kind}: ${file.name}` : "",
        relationship: original ? "original" : "participant_selected" });
      setMessage("File identity recorded in this page. Use the description below to identify the part you checked.");
    } catch { if (request === generation.current) setMessage("The file identity could not be read. Please try again."); }
    finally { if (request === generation.current) setBusy(false); }
  }
  function save() {
    if (!complete || !prepared?.label.trim()) return;
    const time = new Date(`${date}Z`);
    if (!Number.isFinite(time.getTime())) { setMessage("Choose a valid check date and time (UTC)."); return; }
    onChange([...checks, {
      schema_version: "external-check-v1", id: crypto.randomUUID(), service: "SynthID Detector", service_url: "https://synthid.com/",
      entry_method: "manual", status, checked_at: time.toISOString(), recorded_at: new Date().toISOString(), operator,
      source_filename: report.meta.filename, source_sha256: report.meta.input_sha256 ?? "",
      checked_filename: prepared.filename, checked_sha256: prepared.sha256, checked_bytes: prepared.bytes,
      relationship: prepared.relationship, material_label: prepared.label,
      reported_scope: scope, reported_origin: origin, response,
    }]);
    resetMaterial();
    setMessage("External check saved in this session. Download your notes to keep a copy.");
  }

  return <section className={`external-check ${community ? "external-check-community" : ""}`} aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}><ShieldCheck size={22} aria-hidden="true" />External watermark check</h3>
    <p>Use SynthID Detector to look for a supported AI watermark, then bring its reply into your discussion.</p>
    {doc && <p>For this document, check a selected page or slide image. Keep the complete document alongside it for source and context review.</p>}
    <div className="external-check-actions">
      {materials.length > 0 && <div>
        {SHOWCASE && materials.length === 1 ? <p><strong>Example for this check:</strong> {selected?.label}</p> : <>
        <label htmlFor={`${id}-material`}>Material to check</label>
        <select id={`${id}-material`} value={selection} disabled={busy} onChange={event => { resetMaterial(); setSelection(event.target.value); }}>
          {materials.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select></>}
        <button type="button" className="ghost" onClick={download} disabled={busy || !selected}>
          <Download size={18} aria-hidden="true" />{busy ? "Preparing file…" : doc ? "Download selected image" : "Download original for checking"}
        </button>
      </div>}
      <div><a className="external-check-link" href="https://synthid.com/" target="_blank" rel="noopener noreferrer">
        Check with SynthID Detector <ExternalLink size={17} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
      </a></div>
    </div>
    <p className="external-check-small">Google receives the file you choose to upload there{doc ? ", including any metadata retained in the rendered image" : ", including its metadata"}. Its account settings and current terms apply, separately from SDA’s API accounts. Opening this link sends no media.</p>
    <details className="external-check-help"><summary>Coverage and file guidance</summary>
      <p>SynthID checks supported watermarked images, audio and video. PDF and PPTX are not offered in its upload format list (checked 11 October 2026). Check the service for its current file limits.</p>
      <p>A finding belongs to the file submitted and any coverage the service reports. It adds production evidence to your source review. A watermark not detected leaves origin unresolved by this check.</p>
      {doc && <p>A rendered page or slide has its own file identity and credential history. Its result does not establish the origin of every part of the document.</p>}
      {!EXAMPLES_ONLY && doc && <p>Local image extraction uses the configured SDA server and makes no model call.</p>}
    </details>
    {SHOWCASE ? <div className="external-check-demo-reply">
      <label htmlFor={`${id}-demo-response`}>SynthID Detector reply (paste result)</label>
      <textarea id={`${id}-demo-response`} rows={4} maxLength={20000} disabled={!selected || !onReplyChange}
        aria-describedby={`${id}-demo-scope`} placeholder="Paste the full reply or error message here."
        value={replies.find(reply => reply.material_id === selection)?.response ?? ""}
        onChange={event => { if (selected) onReplyChange?.(updateDemoDetectorReplies(replies, report, selected, event.target.value)); }} />
      <p id={`${id}-demo-scope`} className="external-check-small">{selected ? "Linked to the prepared example shown above. " : "This example has no prepared media for this check. "}
        Pasted replies stay separate from the recorded findings. Kept in this browser session; download your session notes before changing example or closing the page.</p>
    </div> : <details className="external-check-editor"><summary>Record the external result</summary>
      <p className="external-check-small">Use the downloaded file above, or select the exact file you checked. Selecting it here reads its identity locally in your browser.</p>
      <label htmlFor={`${id}-file`}>Select the file you checked (optional alternative)</label>
      <input id={`${id}-file`} type="file" accept={DETECTOR_ACCEPT} disabled={busy} onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
      {prepared ? <div className="external-check-file">
        <strong>{prepared.filename}</strong> · {prepared.bytes.toLocaleString("en-GB")} bytes
        <label htmlFor={`${id}-label`}>Checked material / page or slide</label>
        <input id={`${id}-label`} value={prepared.label} maxLength={500} onChange={event => { setPrepared({ ...prepared, label: event.target.value }); setAttested(false); }} />
        <details><summary>File identity</summary><code>SHA-256: {prepared.sha256}</code></details>
      </div> : <p className="external-check-small">Prepare or select a file before saving a record.</p>}
      <div className="external-check-fields">
        <label>Result<select value={status} onChange={event => { setStatus(event.target.value as ExternalCheckStatus); setAttested(false); setOrigin(""); }}>
          {Object.entries(externalStatus).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select></label>
        <label>{status === "not_checked" ? "Record" : "Check"} date and time (UTC)<input type="datetime-local" value={date} onChange={event => setDate(event.target.value)} /></label>
        <label>Recorded by (optional name or initials)<input value={operator} maxLength={200} onChange={event => setOperator(event.target.value)} /></label>
        {status === "detected" && <label>Origin named by the service (if given)<input value={origin} maxLength={500} onChange={event => { setOrigin(event.target.value); setAttested(false); }} /></label>}
      </div>
      <label htmlFor={`${id}-scope`}>Coverage reported by the service (optional)</label>
      <input id={`${id}-scope`} placeholder="For example, the image or a reported audio time range" value={scope} maxLength={2000} onChange={event => { setScope(event.target.value); setAttested(false); }} />
      <label htmlFor={`${id}-response`}>Exact reply or error message (up to 20,000 characters)</label>
      <textarea id={`${id}-response`} rows={4} maxLength={20000} value={response} onChange={event => { setResponse(event.target.value); setAttested(false); }} />
      <label className="external-check-attest"><input type="checkbox" checked={attested} disabled={!prepared} onChange={event => setAttested(event.target.checked)} />
        {status === "not_checked" ? "This record identifies the material I have not checked." : "This reply and result describe the exact file identified above."}</label>
      <p className="external-check-small">{SHOWCASE ? "Kept in this browser session. Download session notes before changing item, starting a new session or closing the page." : "Kept with this browser-held analysis and included in its downloads. Save an export to retain this manual entry; earlier files on disk remain unchanged."}</p>
      <button type="button" className="primary" disabled={!complete || !prepared?.label.trim()} onClick={save}>Save external check</button>
      {checks.length >= 30 && <p>Download these records before starting a new session. This session holds up to 30 external checks per item.</p>}
    </details>}
    {message && <p className="external-check-message" role="status">{message}</p>}
    {checks.length > 0 && <div className="external-check-records">
      <h4>Recorded external checks</h4><p className="external-check-small">{EXTERNAL_CHECK_SCOPE}</p>
      {checks.map((check, index) => <details key={check.id}>
        <summary>{externalStatus[check.status]} · {check.material_label}</summary>
        <dl>{externalCheckRows(check).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
        <button type="button" className="ghost small-btn" onClick={() => onChange(checks.filter((_, i) => i !== index))}>Remove this session entry</button>
      </details>)}
    </div>}
  </section>;
}
