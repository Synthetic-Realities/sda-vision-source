import { useEffect, useState } from "react";
import { Presentation } from "lucide-react";
import PreparedSlideshow from "./PreparedSlideshow";
import type { SlidePreviewState } from "../useSlidePreview";

export default function PresentationPreview({state,compact=false,cover}:{state:SlidePreviewState;compact?:boolean;cover?:string}) {
  const [openWhenReady,setOpenWhenReady]=useState(false);
  useEffect(()=>{if(state.error)setOpenWhenReady(false);},[state.error]);
  if(state.slides) return <PreparedSlideshow slides={state.slides} compact={compact} initiallyExpanded={compact&&openWhenReady}/>;
  return <div className="presentation-preview-preparation">
    {!compact&&cover&&<img src={cover} alt="Presentation cover"/>}
    <button type="button" className="cw-button" disabled={state.loading} onClick={()=>{setOpenWhenReady(true);void state.prepare();}}>
      <Presentation size={20} aria-hidden="true"/>{state.loading?"Preparing slides…":state.error?"Retry slide preview":"Preview slides"}
    </button>
    {state.loading&&<div className="slide-loading" role="status">Preparing slide previews…</div>}
    {state.error&&<p role="alert">{state.error}</p>}
    {!state.loading&&!state.error&&<p className="community-small">Browse the slides before running the checks.</p>}
  </div>;
}
