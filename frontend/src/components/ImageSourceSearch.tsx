import { useId } from "react";
import { ArrowDownToLine, ExternalLink } from "lucide-react";

export default function ImageSourceSearch({ kind, originalUrl, originalName }: { kind: string; originalUrl?: string | null; originalName?: string }) {
  const id = useId();
  // Eligibility follows the original item, not its cover, page or frame preview.
  if (kind !== "image") return null;
  return <div className="workshop-image-search">
    <div className="workshop-source-actions"><a className="cw-text" href="https://images.google.com/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-describedby={id}>
      Google Lens / image search<ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
    </a>
    {originalUrl && <a className="cw-text" href={originalUrl} download={originalName}><ArrowDownToLine size={18} aria-hidden="true" />Download original file</a>}</div>
    <p id={id}>Choose workshop-approved material to share with Google. Its account settings and terms apply separately from SDA's API settings. SDA opens the search page; you choose and attach any image there.</p>
    <details><summary>What to look for</summary>
      <p>Look for matching images on other pages, then compare dates, credits and captions. Earlier matches are leads to follow up; the earliest search result may be a repost.</p>
      <p>Where available, Google's <a href="https://support.google.com/websearch/answer/14177408?hl=en" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">About this image<span className="sr-only"> (opens in a new tab)</span></a> offers more context. A date Google first saw an image can differ from when it was created.</p>
      <a className="cw-text" href="https://support.google.com/websearch/answer/1325808?hl=en" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Google's image-search guide<ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
    </details>
  </div>;
}
