import { ArrowUp } from "lucide-react";
import type { Report } from "../types";
import { creationHistory } from "../community";
import { FOLLOW_UP_QUESTIONS } from "../workshop";

/** Source questions sit with supporting evidence, apart from the main checks. */
export default function CreationHistory({ report, kind, onSourceSearch }: {
  report: Report; kind: string; onSourceSearch?: () => void;
}) {
  const history = creationHistory(report, kind);
  return <details className="community-history">
    <summary>{history.label}</summary>
    <p><strong>{history.finding}</strong></p>
    <p>{history.detail}</p>
    <dl className="workshop-history-answers">{history.answers?.map(({ question, label, answer }) => <div key={question}>
      <dt>{label}</dt><dd>{answer}
        {onSourceSearch && question === FOLLOW_UP_QUESTIONS[0] && kind === "image" && <button className="cw-text" onClick={onSourceSearch}>Explore image-search evidence<ArrowUp size={16} /></button>}
      </dd>
    </div>)}</dl>
  </details>;
}
