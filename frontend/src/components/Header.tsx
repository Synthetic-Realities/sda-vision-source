import { softwareCitationRows } from "../citation";
import packageInfo from "../../package.json";
import brandLogo from "../assets/sda-vision-logo.png";
import { SHOWCASE } from "../showcase";
import PublicDemoNote from "./PublicDemoNote";
import { useEffect, useState } from "react";
import type { ProvidersInfo } from "../types";

// Theme picker + text-size control. The saved choices are applied pre-paint
// by the inline script in index.html; these components keep <html data-theme>
// / <html data-textsize> and localStorage in sync from then on. Works
// identically in the full tool and the static showcase (pure client-side -
// no variant divergence).
const THEMES = [
  ["studio", "Studio bright"],
  ["dark", "Dark"],
  ["light", "Light"],
  ["console", "Console teal"],
  ["pulse", "Magenta pulse"],
  ["ppie", "PPIE report"],
] as const;
type ThemeKey = (typeof THEMES)[number][0];

// Base text sizes, tuned for desk / shared screen / conference projection.
// The whole app is rem-based, so the body base size scales everything.
const SIZES = [
  ["standard", "Aa", "Standard text"],
  ["large", "Aa+", "Large text"],
  ["workshop", "Aa++", "Workshop text (projection size)"],
] as const;
type SizeKey = (typeof SIZES)[number][0];

function ThemeControls() {
  const [theme, setTheme] = useState<ThemeKey>(() => {
    try {
      const t = localStorage.getItem("sda-theme");
      return THEMES.some(([k]) => k === t) ? (t as ThemeKey) : "studio";
    } catch {
      return "studio";
    }
  });
  const [size, setSize] = useState<SizeKey>(() => {
    try {
      const s = localStorage.getItem("sda-textsize");
      return SIZES.some(([k]) => k === s) ? (s as SizeKey) : "standard";
    } catch {
      return "standard";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("sda-theme", theme);
    } catch {
      /* storage unavailable (private mode): theme still applies this session */
    }
  }, [theme]);
  useEffect(() => {
    if (size === "standard") delete document.documentElement.dataset.textsize;
    else document.documentElement.dataset.textsize = size;
    try {
      localStorage.setItem("sda-textsize", size);
    } catch {
      /* storage unavailable: size still applies this session */
    }
  }, [size]);
  const sizeIdx = SIZES.findIndex(([k]) => k === size);
  const nextSize = SIZES[(sizeIdx + 1) % SIZES.length];
  return (
    <>
      <label className="theme-control">Theme <select
        className="theme-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeKey)}
        aria-label="Colour theme"
        title="Colour theme"
      >
        {THEMES.map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select></label>
      <button
        className="theme-btn"
        onClick={() => setSize(nextSize[0])}
        title={`Text size: ${SIZES[sizeIdx][2]}. Click for ${nextSize[2].toLowerCase()}.`}
        aria-label={`Text size: ${SIZES[sizeIdx][2]}. Click for ${nextSize[2].toLowerCase()}.`}
      >
        {SIZES[sizeIdx][1]}
      </button>
    </>
  );
}

// SynthID is intentionally omitted: it is gated/pending and lives in the
// Second-opinions section, not the main analysis.
const CHIPS: [keyof ProvidersInfo, string][] = [
  ["claude", "Claude"],
  ["openai", "OpenAI"],
  ["gemini", "Gemini"],
  ["c2pa", "C2PA"],
  ["local", "Local"],
];

interface HeaderProps {
  providers: ProvidersInfo | null;
  devMode: boolean;
  view: "research" | "public";
  onToggleView: () => void;
}

export default function Header({ providers, devMode, view, onToggleView }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div>
          <h1>
            <img className="sda-brand-logo" src={brandLogo} alt="SDA Vision" width="2172" height="724" />
            <span className="brand-meta"><span className="ver">v{providers?.version ?? packageInfo.version}</span>
            {devMode && <span className="dev-badge">DEV</span>}</span>
          </h1>
          {devMode && (
            <button className="view-toggle" onClick={onToggleView}>
              {view === "research" ? "Layout: Research controls (switch to compact)" : "Layout: Compact (show research controls)"}
            </button>
          )}
        </div>
      </div>
      <div className="chips" aria-label={SHOWCASE ? "Recorded checks and display settings" : "Configured providers and display settings"}>
        <ThemeControls />
        {CHIPS.map(([key, label]) => {
          const state = (providers?.[key] as { state?: string } | undefined)?.state ?? "unconfigured";
          // SynthID is gated, so we label it "check" to point users at the
          // Second-opinion buttons (Gemini SynthID check) rather than "pending".
          const display = key === "synthid" && state === "pending" ? "check" : state;
          return (
            <span key={String(key)} className={`chip ${state}`} title={state === "recorded" ? "Recorded results are available. Individual check statuses appear in each report." : undefined}>
              {label}: {display}
            </span>
          );
        })}
      </div>
      <div className="developer-intro">
        <p className="developer-eyebrow">{SHOWCASE ? "Synthetic-media Discourse Analysis · Developer demo" : "Synthetic-media Discourse Analysis · Developer workspace"}</p>
        <p className="developer-lead">Explore AI-generated and traditional media through visual model assessments, credential findings and supporting observations.</p>
      </div>
      {SHOWCASE && <>
        <PublicDemoNote />
        <div className="developer-resources">
          <p>Download the <a href="https://github.com/Synthetic-Realities/sda-vision-source#start-here" target="_blank" rel="noopener noreferrer">open-source software on GitHub</a> and follow the installation guide to run SDA Vision on your own computer. Bring SDA Vision into teaching and community sessions with the <a href="#facilitator">illustrated facilitator guide</a>.</p>
          <details className="developer-citation">
            <summary>Citation</summary>
            {softwareCitationRows(packageInfo.version).map(([label, text]) => <p key={label}><strong>{label}: </strong>{text}</p>)}
          </details>
        </div>
      </>}
    </header>
  );
}
