import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, X, Presentation } from "lucide-react";

import { PREPARED_SLIDES, type PreviewSlide } from "../useSlidePreview";

// Presentation-only slide renders. Browsing preserves the separate analysis sampling.
export default function PreparedSlideshow({slides=PREPARED_SLIDES,compact=false,initiallyExpanded=false}:{slides?:PreviewSlide[];compact?:boolean;initiallyExpanded?:boolean}) {
  const SLIDE_COUNT=slides.length;
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState("");
  const [failed, setFailed] = useState("");
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener=useRef<HTMLButtonElement>(null);
  const originalSrc=slides[index]?.src ?? "";
  const src=originalSrc.startsWith("data:") ? originalSrc : `${originalSrc}${attempt ? `?retry=${attempt}` : ""}`;
  const move = (next: number) => setIndex(Math.max(0, Math.min(SLIDE_COUNT - 1, next)));
  useEffect(() => {
    if (expanded && !dialog.current?.open) dialog.current?.showModal();
    else if (!expanded && dialog.current?.open) dialog.current.close();
  }, [expanded]);

  const viewer = (large: boolean) => <>
    <div className="slide-image">
      <img key={`${index}-${attempt}`} src={src} alt={`Presentation: slide ${index + 1} of ${SLIDE_COUNT}`} width={slides[index]?.width} height={slides[index]?.height}
        onLoad={() => setLoaded(src)} onError={() => setFailed(src)} />
      {loaded !== src && failed !== src && <div className="slide-loading" role="status">Loading slide {index + 1}…</div>}
      {failed === src && <div className="slide-error" role="alert">This slide could not be loaded.
        <button className="cw-button" onClick={() => { setLoaded(""); setFailed(""); setAttempt(n => n + 1); }}>Retry slide</button></div>}
    </div>
    <div className="slide-controls" aria-label={large ? "Enlarged slideshow controls" : "Slideshow controls"}>
      <button className="cw-button" disabled={index === 0} onClick={() => move(index - 1)}><ChevronLeft size={18} aria-hidden="true" />Previous</button>
      <label className="slide-picker"><span className="sr-only">Choose slide</span>
        <select aria-label={large ? "Choose enlarged slide" : "Choose slide"} value={index} onChange={e => move(Number(e.target.value))}>
          {Array.from({ length: SLIDE_COUNT }, (_, n) => <option key={n} value={n}>Slide {n + 1} of {SLIDE_COUNT}</option>)}
        </select>
      </label>
      <button className="cw-button" disabled={index === SLIDE_COUNT - 1} onClick={() => move(index + 1)}>Next<ChevronRight size={18} aria-hidden="true" /></button>
      {!large && <button ref={opener} className="cw-icon" aria-label="Enlarge slideshow" title="Enlarge slideshow" onClick={() => setExpanded(true)}><ZoomIn size={20} /></button>}
    </div>
  </>;

  return <div className="prepared-slideshow" role="region" aria-label="Presentation slideshow" onKeyDown={e => {
    if ((e.target as HTMLElement).tagName === "SELECT") return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    move(e.key === "Home" ? 0 : e.key === "End" ? SLIDE_COUNT - 1 : index + (e.key === "ArrowRight" ? 1 : -1));
  }}>
    {compact ? <button ref={opener} type="button" className="cw-button" onClick={()=>setExpanded(true)}><Presentation size={20} aria-hidden="true"/>Preview slides</button> : viewer(false)}
    {!compact&&<p className="community-small">Explore the presentation with Previous and Next, or choose a slide.</p>}
    <dialog ref={dialog} className="slideshow-dialog" aria-label="Enlarged presentation" onClose={() => { setExpanded(false); opener.current?.focus(); }}>
      <button className="cw-icon slide-close" aria-label="Close slideshow" onClick={() => setExpanded(false)}><X size={22} /></button>
      {expanded && <>{viewer(true)}<p className="community-small">Static slide preview. Animations and embedded playback remain in the original PowerPoint.</p></>}
    </dialog>
  </div>;
}
