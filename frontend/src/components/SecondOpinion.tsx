import { useId, useState } from "react";
import { Copy, ExternalLink, ScanSearch } from "lucide-react";
import { secondOpinionPrompt } from "../lib";
import { SHOWCASE, EXAMPLES_ONLY } from "../showcase";

interface ScoreMeta { score: number | null; read: string; loading: boolean }

interface Props {
  community?: boolean;
  filename: string;
  originalUrl?: string;
  // Input kind (image|pdf|pptx|video) and the analysed frame labels, so the
  // guidance can be honest about what SynthID checkers accept: directly
  // attached media only, never a PDF/PPTX container.
  kind?: string;
  frameLabels?: string[];
  // True when the frame chips above offer the one-click frame download.
  frameDownloads?: boolean;
  // One pasted note per LLM, controlled by the parent (Results), so each is
  // tagged clearly in the display and exports.
  gemini?: string;
  chatgpt?: string;
  onGemini?: (v: string) => void;
  onChatgpt?: (v: string) => void;
  onScoreGemini?: () => void;
  onScoreChatgpt?: () => void;
  geminiMeta?: ScoreMeta | null;
  chatgptMeta?: ScoreMeta | null;
  // Tri-state fresh-session attestation per note: true = attested fresh,
  // false = researcher states the session was not fresh, undefined = not
  // attested. Absence is recorded as "not attested" and is never evidence
  // either way (same rule as unexamined frames and absent credentials).
  geminiFresh?: boolean;
  chatgptFresh?: boolean;
  onGeminiFresh?: (v: boolean | undefined) => void;
  onChatgptFresh?: (v: boolean | undefined) => void;
}

// A checkbox cannot honestly express the declined state: without a reachable
// "no", absence would silently conflate "didn't say" with "said no". The
// three-option select is what makes "not attested" mean something.
function AttestSelect(
  { value, onChange, freshLabel, disabled = false, community = false }:
    { value?: boolean; onChange?: (v: boolean | undefined) => void; freshLabel: string;
      disabled?: boolean; community?: boolean },
) {
  if (!onChange) return null;
  return (
    <span className="so-attest">
      <select
        aria-label={community ? "How this reply was obtained" : "Fresh-session attestation"}
        disabled={disabled}
        title={disabled
          ? community ? "Paste a reply before recording how you obtained it." : "Paste the reply first - the attestation describes a pasted note."
          : undefined}
        value={value === true ? "yes" : value === false ? "no" : ""}
        onChange={(e) =>
          onChange(e.target.value === "yes" ? true : e.target.value === "no" ? false : undefined)}
      >
        <option value="">{community ? "Chat or check: not stated" : "Session: not stated"}</option>
        <option value="yes">{freshLabel}</option>
        <option value="no">Existing chat</option>
      </select>
    </span>
  );
}

function ScoreLine({ meta }: { meta?: ScoreMeta | null }) {
  if (!meta) return null;
  if (meta.loading) return <small className="muted so-score">Scoring the note...</small>;
  if (!meta.read && meta.score == null) return null;
  return (
    <small className="so-score">
      <strong>Read:</strong> {meta.read || "(no clear view)"}
      {meta.score != null && <> &middot; synthetic score ~{meta.score}/100</>}
    </small>
  );
}

// Copy in the click gesture, before opening another tab can take focus.
// execCommand is a compatibility path; if unavailable, show the prompt rather
// than automatically invoking the permission-based async Clipboard API.
function copyText(text: string): boolean {
  const previousFocus = document.activeElement;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.readOnly = true;
  ta.tabIndex = -1;
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  try {
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    ta.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }
}

// Opens a vendor assistant for an independent look. In this local BYOK build we
// never publish the user's image to a public URL: the prompt is copied to the
// clipboard and the user attaches their own image manually.
export default function SecondOpinion(
  { filename, originalUrl, kind = "image", frameLabels = [], frameDownloads = false, gemini, chatgpt,
    onGemini, onChatgpt, onScoreGemini, onScoreChatgpt, geminiMeta, chatgptMeta,
    geminiFresh, chatgptFresh, onGeminiFresh, onChatgptFresh, community = false }: Props,
) {
  const [toast, setToast] = useState("");
  const replyId = useId();
  // Strict one-frame-at-a-time flow applies to documents; Gemini's SynthID
  // accepts video/audio files directly, so video keeps the default flow.
  const docLike = kind === "pdf" || kind === "pptx";
  // The guidance must only reference controls that actually exist in this
  // view: frame-download chips and the available paste editors.
  const hasPaste = Boolean(onGemini);
  const prompt = secondOpinionPrompt(filename, kind, frameLabels);

  // Only the Gemini (chat) button uses open(); the hygiene sentence belongs on
  // chat surfaces and must not be reused for a toast about the stateless
  // Verify page.
  function open(url: string, label: string) {
    const copied = copyText(prompt);
    window.open(url, "_blank", "noopener,noreferrer");
    setToast(copied
      ? (docLike
          ? `Prompt copied. In ${label}, start a fresh chat for this document and attach one downloaded frame per message.`
          : SHOWCASE
            ? `Prompt copied. Paste it into a fresh ${label} chat and attach the original from the example's download button.`
            : `Prompt copied. Paste it into a fresh ${label} chat and attach your file.`)
      : `Automatic copying was unavailable. The ${community ? "checking question" : "prompt"} is shown below for you to copy into ${label}.`);
  }

  function copyOnly() {
    const copied = copyText(prompt);
    // Doc flow re-copies the prompt per frame INSIDE one chat, so its toast
    // must not imply a new chat per paste (one chat per document, one message
    // per frame); the single-item flow keeps the plain new-chat rule.
    setToast(copied
      ? (docLike
          ? "Prompt copied to your clipboard. Use a new chat per document, then a new message per frame of this one."
          : "Prompt copied to your clipboard. Paste it into a fresh chat for this item.")
      : `Automatic copying was unavailable. The ${community ? "checking question" : "prompt"} is shown below for you to copy.`);
  }

  function openOpenAI() {
    window.open("https://openai.com/research/verify/", "_blank", "noopener,noreferrer");
    setToast(hasPaste
      ? "OpenAI Verify opened. Attach your image there, review the check's coverage and details, then record the response below."
      : "OpenAI Verify opened. Attach your image there and review the check's coverage and details.");
  }

  const promptBackup = <div className="so-prompt-backup">
    <div className="so-prompt-heading"><label htmlFor={`${replyId}-prompt`}>Gemini checking prompt</label>
      <button className={community ? "cw-button" : "ghost small-btn"} onClick={copyOnly}><Copy size={17} aria-hidden="true" />Copy prompt</button>
    </div>
    <textarea id={`${replyId}-prompt`} rows={5} readOnly value={prompt} onFocus={e => e.currentTarget.select()} />
  </div>;

  if (community) return <div className="community-opinion-tools">
    <div className="community-opinion-intro-row"><p className="community-opinion-intro">Get a second opinion: {kind === "image" || docLike
      ? "look for signs that an image was made or edited with Google AI or ChatGPT / OpenAI."
      : kind === "video" || kind === "audio" ? "ask Gemini to check your media for a Google SynthID watermark." : "these origin tools work with images and other supported media."}</p>
      {originalUrl && <a className="cw-text community-original-download" href={originalUrl} download={filename}>Download original file</a>}
    </div>
    <div className="community-opinion-actions">
      <div><button className="cw-button community-gemini" disabled={!["image", "video", "audio", "pdf", "pptx"].includes(kind)}
        onClick={() => open("https://gemini.google.com/app", "Gemini")}><ScanSearch size={20} /><span>Gemini SynthID check</span><ExternalLink size={16} /></button>
        <p className="community-small"><strong>Opens Gemini and copies a question. Ask for a SynthID check on {docLike ? "one frame image at a time" : "your permitted file"}.</strong></p></div>
      <div><button className="cw-button community-openai" disabled={kind !== "image"} onClick={openOpenAI}>
        <ScanSearch size={20} /><span>OpenAI images check</span><ExternalLink size={16} /></button>
        <p className="community-small"><strong>{kind === "image" ? "Opens OpenAI's image checker. Upload your chosen image there." : "This SDA shortcut is for image inputs. Check a saved frame as an image separately."}</strong></p></div>
    </div>
    <p className="community-small">You choose any upload on the external site. Its account settings and terms apply, separately from SDA's API settings.</p>
    <p className="community-small">Keep the stated check result and its coverage with the reply. A general visual opinion covers appearance; a no-match result leaves the origin open.</p>
    {promptBackup}
    <details className="community-opinion-guidance"><summary>Tips for this check</summary>
      <p>Use a fresh chat for each item. For documents, use one chat with a separate message and image for each frame. Keep each reply with its frame name.</p>
      {docLike && <p>{frameDownloads ? "Frame images can be saved from the tools below." : "Save the relevant figure as a separate image from the original document."} The extracted image and the original document have different credential histories.</p>}
    </details>
    {toast && <p className="community-small" role="status">{toast}</p>}
    <div className="community-opinion-replies">
      {[
        { key: "gemini", label: "Gemini", value: gemini, change: onGemini, score: onScoreGemini, meta: geminiMeta, fresh: geminiFresh, attest: onGeminiFresh, freshLabel: "New chat" },
        { key: "openai", label: "OpenAI", value: chatgpt, change: onChatgpt, score: onScoreChatgpt, meta: chatgptMeta, fresh: chatgptFresh, attest: onChatgptFresh, freshLabel: "Fresh check" },
      ].map(reply => <details key={reply.key} className="community-opinion-reply">
        <summary>{reply.label} reply{reply.value?.trim() ? " (added)" : " (optional)"}</summary>
        {reply.change ? <>
          <div className="so-paste"><label htmlFor={`${replyId}-${reply.key}`}>{reply.label} reply (paste result)</label>
            <textarea id={`${replyId}-${reply.key}`} rows={4} value={reply.value ?? ""} onChange={e => reply.change?.(e.target.value)} />
          </div>
          <p className="community-small">{SHOWCASE ? "Kept in this browser session. Download session notes before changing example, starting a new session or reloading/closing the page. The saved assessment stays unchanged." : "Kept with this analysis and its research exports, separately from workshop impressions and the combined assessment."}</p>
          <label className="community-small">How did you get this reply?
            <AttestSelect community value={reply.fresh} onChange={reply.attest} freshLabel={reply.freshLabel} disabled={!reply.value?.trim()} />
          </label>
          {reply.score && <details className="community-note-score"><summary>Optional note score</summary>
            <p className="community-small">Add note to scoring sends the first 4,000 characters to Anthropic using your API key. Provider retention terms and charges apply. The note score stays separate from SDA's combined assessment.</p>
            <button className="cw-button" disabled={!reply.value?.trim() || reply.meta?.loading} onClick={reply.score}>Add note to scoring</button>
            <ScoreLine meta={reply.meta} />
          </details>}
        </> : <p className="community-small">{reply.value || "No reply recorded in this example."}</p>}
      </details>)}
    </div>
  </div>;

  return (
    <div className="second-opinion">
      <h3>Second opinions</h3>
      <div className="so-buttons">
        <div className="so-col">
          <button className="so-btn" onClick={() => open("https://gemini.google.com/app", "Gemini")}>
            <strong>Ask Gemini SynthID for a second opinion</strong>
            <small>{docLike
              ? "Opens Gemini with a copied checking prompt. Attach one frame image per message and record the check status with the reply."
              : `Opens Gemini with a copied checking prompt. Attach your file there, review the checker's stated coverage and record its reply.${SHOWCASE ? " The example's download button provides the file." : ""}`}</small>
          </button>
          {/* Balances the OpenAI column's visible verifier link. Deliberately
              worded to keep the BUTTON as the primary path: this bare link opens
              Gemini without copying the prompt, so anyone taking the link alone
              would arrive with an empty clipboard. */}
          <p className="so-verify">
            Gemini:{" "}
            <a href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer">
              gemini.google.com/app
            </a>{" "}
            (opens a new chat; the button above also copies the prompt for you).
          </p>
        </div>
        <div className="so-col">
          <button
            className="so-btn"
            disabled={kind !== "image"}
            onClick={openOpenAI}
          >
            <strong>Verify with OpenAI (images only)</strong>
            <small>{kind === "image"
              ? "OpenAI's external image check. Attach your image on that page, review its stated coverage and result details, and record the response below."
              : docLike
                ? frameDownloads
                  ? "For a document, use a frame image saved with the download buttons above and review the checker's coverage on its page."
                  : "For a document, save the figure as an image and review the checker's coverage on its page."
                : "This option is available for image inputs."}</small>
          </button>
          <p className="so-verify">
            OpenAI&apos;s verifier:{" "}
            <a href="https://openai.com/research/verify/" target="_blank" rel="noopener noreferrer">
              openai.com/research/verify
            </a>
          </p>
        </div>
      </div>
      {promptBackup}
      <p className="so-shared">
        Use a fresh chat for each item to keep its check separate from earlier files.
        Record the answer with its source and check status, then review it alongside the other findings.
        A watermark result and a visual opinion cover different questions; record which was returned.
      </p>
      {docLike && (
        <div className="so-steps">
          <p className="so-steps-head"><strong>Attach one frame per message.</strong> This checks the
            extracted image; credentials in the original document are covered by SDA&apos;s original-file check.</p>
          <ol>
            <li>Use one chat for this document, with a separate message for each frame.</li>
            {frameDownloads ? (
              <li>Download a frame with its <strong>&quot;Download this frame as an image for
                Gemini&quot;</strong> button above. Attach the saved image with its original filename
                so the reply can be matched to the frame.</li>
            ) : SHOWCASE ? (
              <li>Use the <strong>↓ button beside the
                example in the input panel</strong> to download the original document. Save the
                analysed figure from it as a single image file, and name it after the frame
                (for example &quot;figure p6&quot;).</li>
            ) : (
              <li>Save the analysed figure from the original document as a single image file,
                named after its frame (for example &quot;figure p6&quot;).</li>
            )}
            <li>In Gemini, paste the copied prompt into the message box, then use the plus (+) or
              paperclip button to attach the frame image.</li>
            <li>For each further frame, click <strong>Copy prompt</strong> again first - copying a
              reply replaces the prompt on your clipboard - then start a new Gemini message, paste,
              and attach the next frame.{frameLabels.length > 0 && (
                <> This analysis sampled {frameLabels.join(", ")}.</>
              )}</li>
            {hasPaste ? (
              <li>Copy Gemini&apos;s full reply and paste it into the &quot;Gemini SynthID&quot; box
                below, starting each pasted reply with its frame name (for example &quot;figure p6:&quot;).
                Replies entered here are saved with the analysis, including checks of individual frames.</li>
            ) : (
              <li>Keep Gemini&apos;s full reply with your notes, labelled with its frame name (for
                example &quot;figure p6:&quot;). The full research tool also supports recording
                these replies with the analysis.</li>
            )}
          </ol>
          <p className="so-steps-note">A tool error means the check was not completed. For a
            multiple-image error, try one frame per message. Record the failed check separately
            from any visual opinion. You can retain a visual opinion as a separate research note
            and record that the watermark check was unavailable.</p>
        </div>
      )}
      {toast && <p className="toast" role="status">{toast}</p>}

      {(onGemini || onChatgpt) && (
        <div className="so-pastes">
          <p className="small muted">{SHOWCASE ? "Replies are kept in this browser session, separately from the original recorded notes and assessment. Download the session with your notes before changing example, starting a new session or reloading/closing the page." : EXAMPLES_ONLY ? "Pasted replies are kept with this analysis and its downloads, separately from the combined assessment." : "Pasted notes are kept with this analysis. Choosing Add note to scoring sends the first 4,000 characters to Anthropic using your API key; provider retention terms and charges apply. The returned score describes the note and remains separate from the combined assessment."}</p>
          {(onGeminiFresh || onChatgptFresh) && <p className="small muted">Session details are
            recorded by the researcher and kept with the audit record, separately from automated scoring.</p>}
          {onGemini && (
            <label className="so-paste">
              <span>Gemini SynthID (paste result, optional)</span>
              <textarea
                rows={3}
                placeholder={SHOWCASE ? "Paste the full Gemini reply here. Use the session download to retain it." : "Paste the full Gemini reply here. It is included in the research exports."}
                value={gemini ?? ""}
                onChange={(e) => onGemini(e.target.value)}
              />
              {onScoreGemini && <button type="button" className="ghost small-btn"
                disabled={!gemini?.trim() || geminiMeta?.loading}
                onClick={onScoreGemini}>Add note to scoring</button>}
              <ScoreLine meta={geminiMeta} />
              <AttestSelect value={geminiFresh} onChange={onGeminiFresh} freshLabel="New chat"
                disabled={!(gemini ?? "").trim()} />
            </label>
          )}
          {onChatgpt && (
            <label className="so-paste">
              <span>OpenAI check (paste result, optional)</span>
              <textarea
                rows={3}
                placeholder={SHOWCASE ? "Paste the full OpenAI reply here. Use the session download to retain it." : "Paste the full OpenAI reply here. It is included in the research exports."}
                value={chatgpt ?? ""}
                onChange={(e) => onChatgpt(e.target.value)}
              />
              {onScoreChatgpt && <button type="button" className="ghost small-btn"
                disabled={!chatgpt?.trim() || chatgptMeta?.loading}
                onClick={onScoreChatgpt}>Add note to scoring</button>}
              <ScoreLine meta={chatgptMeta} />
              <AttestSelect value={chatgptFresh} onChange={onChatgptFresh} freshLabel="Fresh check"
                disabled={!(chatgpt ?? "").trim()} />
            </label>
          )}
          {((gemini ?? "").trim() || (chatgpt ?? "").trim()) && (
            <small className="muted">{SHOWCASE ? "Included by source in session downloads; original recorded-report downloads remain unchanged." : "Kept with this analysis and tagged by source in JSON, Markdown, CSV, PPTX and PDF exports."}</small>
          )}
        </div>
      )}
    </div>
  );
}
