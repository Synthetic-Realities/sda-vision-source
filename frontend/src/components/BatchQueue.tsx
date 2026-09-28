import { developerExampleLabel } from "../workshopExamples";
import { SHOWCASE, EXAMPLES_ONLY } from "../showcase";
import type { ExampleEntry } from "../types";
import { useRef, useState } from "react";
import { extOf, IMG_EXT } from "../lib";

export interface QueueItem {
  id: string;
  file: File;
  url: string;
  selected: boolean;
  run?: boolean;
}

interface Props {
  queue: QueueItem[];
  examples: ExampleEntry[];
  onExamples: (names: string[]) => Promise<string[]>;
  onClear: () => void;
  onAdd: (files: File[]) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRun: () => void;
  busy: boolean;
  running: boolean;
}

const MAX_SELECT = 5;

export default function BatchQueue(p: Props) {
  const [choices, setChoices] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const selected = p.queue.filter((q) => q.selected).length;

  const available = p.examples.filter(e => !p.queue.some(q => q.file.name === e.name));
  const pending = choices.filter(name => available.some(e => e.name === name));
  const room = Math.max(10 - p.queue.length, 0);

  async function addChosen() {
    if (p.busy || !pending.length) return;
    const failed = await p.onExamples(pending.slice(0, room));
    setChoices(failed);
  }

  return (
    <details className="panel batch-queue">
      <summary className="batch-queue-summary">
        <strong>Batch queue</strong> <span className="dev-badge">DEV</span>
        <span className="muted small"> · {p.queue.length}/10 files · {selected} selected{p.running ? " · Processing…" : ""}</span>
      </summary>
      <div className="batch-queue-content">
      <p className="muted small">
        {SHOWCASE ? "Queue up to 10 bundled examples and select up to 5 to open their saved results." : EXAMPLES_ONLY ? "Queue up to 10 prepared examples and select up to 5 for fresh analysis. Provider charges apply." : "Stage up to 10 files and select up to 5 to process. API charges vary with the selected files, sampled frames and enabled checks."}
      </p>

      {!EXAMPLES_ONLY && <input
        ref={ref}
        type="file"
        hidden
        multiple
        accept="image/*,application/pdf,.pptx,video/*,audio/*,.txt,.srt,.vtt,.md,.m4a"
        onChange={(e) => { p.onAdd(Array.from(e.target.files ?? [])); if (ref.current) ref.current.value = ""; }}
      />}
      {EXAMPLES_ONLY && <fieldset className="batch-example-picker" disabled={p.busy}>
        <legend>Choose examples for your batch</legend>
        <div className="batch-example-choices">
          {p.examples.map(e => {
            const queued = p.queue.some(q => q.file.name === e.name);
            const checked = pending.includes(e.name);
            return <label key={e.name} className={queued ? "already-queued" : ""}>
              <input type="checkbox" checked={queued || checked} disabled={queued || (!checked && pending.length >= room)}
                onChange={() => setChoices(checked ? pending.filter(name => name !== e.name) : [...pending, e.name])} />
              <span>{developerExampleLabel(e.name)}{queued && <small> — in queue</small>}</span>
            </label>;
          })}
        </div>
        <p className="muted small" aria-live="polite">{pending.length} chosen · {p.queue.length}/10 in queue. Review your selection, then add it below.</p>
        <div className="queue-actions">
          <button className="ghost" disabled={!pending.length} onClick={addChosen}>Add selected examples ({pending.length})</button>
          <button className="ghost small-btn" disabled={!pending.length} onClick={() => setChoices([])}>Untick example choices</button>
        </div>
      </fieldset>}
      <div className="queue-actions">
        {p.queue.length > 0 && <button className="ghost" disabled={p.busy} onClick={p.onClear}>Clear queue and results</button>}
        {!EXAMPLES_ONLY && <button className="ghost" disabled={p.busy || p.queue.length >= 10} onClick={() => ref.current?.click()}>
          Add files ({p.queue.length}/10)
        </button>}
        {p.queue.some((q) => !q.run) && (
          <>
            <button className="ghost small-btn" disabled={p.busy} onClick={p.onSelectAll}>Select up to 5</button>
            <button className="ghost small-btn" onClick={p.onDeselectAll} disabled={p.busy || selected === 0}>Deselect queued files</button>
          </>
        )}
      </div>

      {p.queue.length > 0 && (
        <ul className="queue-list">
          {p.queue.map((it) => {
            const isImg = IMG_EXT.includes(extOf(it.file.name));
            const disabled = p.busy || it.run || (!it.selected && selected >= MAX_SELECT);
            return (
              <li key={it.id} className={`qrow ${disabled ? "disabled" : ""} ${it.selected ? "on" : ""} ${it.run ? "run" : ""}`}>
                <input type="checkbox" aria-label={`Select ${it.file.name}`} checked={it.selected} disabled={disabled} onChange={() => p.onToggle(it.id)} />
                {isImg
                  ? <img className="qthumb" src={it.url} alt="" />
                  : <span className="qthumb qtype">{extOf(it.file.name).toUpperCase()}</span>}
                <span className="qname" title={it.file.name}>{it.file.name}</span>
                {it.run && <span className="qrun">{SHOWCASE ? "opened" : "run"}</span>}
                <button className="qremove" disabled={p.busy} onClick={() => p.onRemove(it.id)} aria-label={`Remove ${it.file.name}`}>&times;</button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="queue-foot">
        <span className="muted small">{selected}/{MAX_SELECT} selected</span>
        <button className="primary" disabled={selected === 0 || p.busy} onClick={p.onRun}>
          {p.running ? (SHOWCASE ? "Opening saved results…" : "Analysing…") : SHOWCASE ? `Open saved batch (${selected})` : `Run batch (${selected})`}
        </button>
      </div>
      </div>
    </details>
  );
}
