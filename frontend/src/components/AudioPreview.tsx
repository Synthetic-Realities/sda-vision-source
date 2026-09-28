import { Headphones } from "lucide-react";
import "./AudioPreview.css";

interface Props {
  url: string;
  name: string;
  artwork?: string | null;
}

export default function AudioPreview({ url, name, artwork }: Props) {
  return <div className="audio-preview">
    <div className="audio-preview-artwork">
      {artwork ? <img src={artwork} alt={`Preview artwork for ${name}`} />
        : <Headphones size={58} aria-hidden="true" />}
    </div>
    <div className="audio-preview-controls">
      <span className="audio-preview-badge"><Headphones size={24} aria-hidden="true" /><span>Listen</span></span>
      <audio key={url} src={url} controls preload="metadata" aria-label={`Audio: ${name}`} />
    </div>
  </div>;
}
