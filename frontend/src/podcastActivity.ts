import podcastCover from "./assets/podcast-cover.png";
import type { WorkshopStep } from "./community";

export const PODCAST_SHA256 = "58663a6a9e4b634bdb703ead0aaa7cd6dce7fbf97e70c3c1cc61b3311b94c0b4";
export const PODCAST_PAPER_URL = "https://doi.org/10.1016/j.vaccine.2021.10.031";
export const PODCAST_SEARCH_URL = "https://www.google.com/search?q=" + encodeURIComponent('"Martin" "Vanderslott" "mask" "vaccine"');
export const PODCAST_CITATION = 'Martin, S. and Vanderslott, S. (2022) “Any idea how fast ‘It’s just a mask!’ can turn into ‘It’s just a vaccine!’”: From mask mandates to vaccine mandates during the COVID-19 pandemic. Vaccine, 40(51), pp. 7488–7499. DOI: 10.1016/j.vaccine.2021.10.031.';
export const PODCAST_PROMPTS: Record<WorkshopStep, string> = {
  notice: "Listen to a short section. What shapes your first impression of how this podcast was made?",
  discuss: "Take a closer look at the cover image. Which names, dates or references could help you trace its source?",
  check: "Search for a distinctive phrase from the title or the authors’ names. Can you find the publication? Choose one statement from the podcast and compare it with the paper.",
  reflect: "What have you learned about the research and about the podcast’s production? How would you describe both when sharing it?",
};
export const PODCAST_SOURCE_NOTE = "Project source record, supplied by Dr Sam Martin: she created this podcast using Google NotebookLM, drawing on research she co-authored with Samantha Vanderslott in Vaccine. The recorded model findings concern the transcript’s wording and presentation.";
export const PODCAST_COMPARISON = "Finding the publication establishes a source connection. Comparing individual statements helps us assess how the podcast summarises, simplifies or extends that research.";

// Match the approved file or its hash-matched artwork, not an arbitrary filename.
export function isPodcastExample(hash?: string, artwork?: string): boolean {
  return hash === PODCAST_SHA256 || artwork === podcastCover;
}

export function podcastActivitySummary(revealed: boolean): string {
  return "\n## Podcast source exploration\nTeaching prompts; separate from model findings and participant responses.\n"
    + Object.entries(PODCAST_PROMPTS).map(([step, prompt]) => `${step[0].toUpperCase() + step.slice(1)}: ${prompt}`).join("\n")
    + `\nGoogle search: ${PODCAST_SEARCH_URL}\n`
    + (revealed ? `Source reveal: ${PODCAST_SOURCE_NOTE}\nComparison: ${PODCAST_COMPARISON}\nPublication: ${PODCAST_CITATION}\nRead the paper: ${PODCAST_PAPER_URL}\n`
      : "Source reveal: not opened in this session. Follow the citation on the cover to explore the publication.\n");
}
