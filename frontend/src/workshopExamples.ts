/** Workshop labels are presentation copy; original filenames and saved records stay intact. */
export const STARTER_LABEL = "Community table scene (practice example)";
export const STARTER_SOURCE = "Project source record: this illustration was created with AI using Codex’s image-generation tool. The exact model was not recorded. The people shown are fictional.";
const labels: Record<string, string> = {
  "animal-portrait.jpg": "Cat in a hat",
  "earth-image.jpg": "Earth from space",
  "illustration-2.png": "Illustration 1",
  "animated-video.mov": "Animated video",
  "infographic.pdf": "Infographic",
  "journal-diagram.png": "Journal diagram",
  "journal-image.png": "Journal image",
  "podcast.m4a": "Podcast",
  "presentation.pptx": "Presentation slides",
  "social-media-image.png": "Social media image",
};
export function workshopExampleLabel(name: string, index?: number): string {
  return labels[name] ?? (index === undefined ? name : `Example ${index + 1}`);
}

export function developerExampleLabel(name: string): string {
  return name === "animated-video.mov" ? "Animated video" : name;
}
