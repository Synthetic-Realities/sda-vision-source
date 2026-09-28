import type { WorkshopStep } from "./community";

export interface WorkshopResponses {
  impression: string[];
  impressionAfterChecks: boolean;
  noticeNote: string;
  clues: string[];
  discussionNote: string;
  questions: string[];
  sourceSearchNote: string;
  laterImpression: string[];
  nextActions: string[];
  reflectionNote: string;
}

export function emptyWorkshopResponses(): WorkshopResponses {
  return { impression: [], impressionAfterChecks: false, noticeNote: "", clues: [], discussionNote: "", questions: [], sourceSearchNote: "", laterImpression: [], nextActions: [], reflectionNote: "" };
}

export function impressionOptions(kind: string): string[] {
  if (kind === "image") return ["Photo", "Drawn or painted by a person", "Made with AI", "Mix of human and AI", "Not sure yet"];
  const captured = kind === "video" ? ["Filmed"] : [];
  const visual = ["image", "video", "pdf", "pptx"].includes(kind);
  return [...captured, ...(visual ? ["Illustrated / hand-drawn"] : []), "Human-made", "Made with AI", "Mix of human and AI", "Not sure yet"];
}

export function toggleImpression(selected: string[], option: string): string[] {
  if (selected.includes(option)) return selected.filter(value => value !== option);
  if (option === "Not sure yet") return [option];
  return [...selected.filter(value => value !== "Not sure yet"), option];
}

export function sameImpression(first: string[], later: string[]): boolean {
  return first.length === later.length && first.every(value => later.includes(value));
}

export function discussionPrompt(selections: string[]): string {
  if (selections.length > 1) return "How do your choices fit together?";
  const impression = selections[0];
  if (impression === "Illustrated / hand-drawn" || impression === "Drawn or painted by a person") return "What suggests drawing or illustration to you?";
  if (impression === "Human-made") return "What suggests a human creator to you?";
  if (impression === "Photographed" || impression === "Photo") return "What makes you think it was photographed?";
  if (impression === "Filmed") return "What makes you think it was filmed?";
  if (impression === "Made with AI") return "What led you towards AI-made?";
  if (impression === "A mix of both" || impression === "Mix of human and AI") return "Which parts seem different from each other?";
  if (!impression || impression === "Not sure yet") return "What would help you decide?";
  return "What makes it feel human-made?";
}

export function discussionClues(kind: string): string[] {
  if (kind === "audio") return ["The voices", "The music or background sound", "Pauses or edits", "The words and claims", "Something I cannot place"];
  if (kind === "text") return ["The wording", "The claims or references", "The named author", "The date and context", "Something I cannot place"];
  return ["Small visual details", "Light, shadows or textures", ...(kind === "video" ? ["Movement or sound"] : []), "Words, labels or claims", "Something I cannot place"];
}

export const FOLLOW_UP_QUESTIONS = ["Who made or first shared it?", "When and where was it made?", "Does the file record how it was made?", "What evidence supports its claim?"];
export const FOLLOW_UP_LABELS: Record<string, string> = Object.fromEntries(FOLLOW_UP_QUESTIONS.map((question, index) =>
  [question, ["Creator or first sharer", "Creation date and place", "How the file was made", "Evidence behind the claim"][index]]));
export const NEXT_ACTIONS = ["Find the original source", "Compare with other evidence", "Ask someone with relevant expertise", "Pause before sharing"];

export function workshopHeading(step: WorkshopStep, kind: string): string {
  if (step === "notice") return kind === "audio" ? "What can you hear?" : kind === "text" ? "What stands out in the words?" : "What catches your eye?";
  return { discuss: "What helped you form that view?", check: "What can we find out together?", reflect: "What will you take away?" }[step];
}

export const FACILITATOR_QUESTIONS: Record<WorkshopStep, string[]> = {
  notice: ["Did different details catch people's attention?", "Would anyone like more time to look or listen?", "Which first impressions would you like to explore together?"],
  discuss: ["Did someone notice something different?", "Can the same detail have more than one explanation?", "What question would help the group move forward?"],
  check: ["What did each check cover?", "Which findings come from a file record, a model or a person's observation?", "Where could the group look for the missing evidence?"],
  reflect: ["What changed people's views, and what stayed uncertain?", "Which next step feels practical in everyday life?", "How would you explain the findings to someone else?"],
};
