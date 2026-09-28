import { useEffect, useRef, useState } from "react";
import { CONFERENCE, SHOWCASE } from "./showcase";
import { preparedDocumentArtwork } from "./exampleArtwork";
import { corpusFileUrl } from "./api";

export interface PreviewSlide { src: string; width: number; height: number }
export interface SlidePreviewState {
  slides: PreviewSlide[] | null; loading: boolean; error: string; prepare: () => Promise<void>;
}
export const PREPARED_SLIDES: PreviewSlide[] = Array.from({length:14},(_,i)=>({
  src:`./slides/presentation/slide-${String(i+1).padStart(2,"0")}.jpg`,width:3200,height:1800,
}));

export function useSlidePreview(file: File | null, corpusPath: string | null, name: string, thumbnail: string | null): SlidePreviewState {
  const key = file ?? corpusPath;
  const isDeck = name.toLowerCase().endsWith(".pptx");
  const prepared = isDeck && ((SHOWCASE && name === "presentation.pptx") || thumbnail === preparedDocumentArtwork("presentation.pptx"));
  const [state, setState] = useState<{key: File | string | null; slides: PreviewSlide[] | null; loading: boolean; error: string}>({key:null,slides:null,loading:false,error:""});
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    abort.current?.abort();
    setState({key,slides:null,loading:false,error:""});
    return () => { generation.current += 1; abort.current?.abort(); };
  }, [key]);

  async function prepare() {
    if (!isDeck || prepared || SHOWCASE || !key || (state.key === key && state.loading)) return;
    const request = ++generation.current;
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    setState({key,slides:null,loading:true,error:""});
    try {
      let response: Response;
      if (CONFERENCE) {
        response = await fetch(`/api/examples/slides?name=${encodeURIComponent(name)}`,{signal:controller.signal});
      } else {
        let original = file;
        if (!original && corpusPath) {
          const source = await fetch(corpusFileUrl(corpusPath),{signal:controller.signal});
          if (!source.ok) throw new Error("The selected presentation could not be opened.");
          original = new File([await source.blob()],name);
        }
        if (!original) throw new Error("Choose a PowerPoint file first.");
        const form = new FormData(); form.append("file",original);
        response = await fetch("/api/preview/slides",{method:"POST",body:form,signal:controller.signal});
      }
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The slide preview could not be prepared.");
      if (!Array.isArray(data.slides) || !data.slides.length || data.slides.some((s:PreviewSlide)=>!s.src?.startsWith("data:image/jpeg;base64,"))) throw new Error("The slide preview returned no readable images.");
      if (request === generation.current) setState({key,slides:data.slides,loading:false,error:""});
    } catch (error) {
      if (request === generation.current && !controller.signal.aborted) setState({key,slides:null,loading:false,error:error instanceof Error ? error.message : "The slide preview could not be prepared."});
    }
  }
  return {slides:prepared ? PREPARED_SLIDES : state.key === key ? state.slides : null,
    loading:state.key === key && state.loading,error:state.key === key ? state.error : "",prepare};
}
