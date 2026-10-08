import { useRef, useState } from "react";
import { ExternalLink, Gamepad2, CodeXml, Play } from "lucide-react";
import "../game.css";

export const HARBOUR_URL = "https://synthetic-realities.github.io/hearsay-harbour/";
export const HARBOUR_REPOSITORY = "https://github.com/Synthetic-Realities/hearsay-harbour";
export const HARBOUR_DOI = "https://doi.org/10.5281/zenodo.23237554";
export type GameMode = "demo" | "dev";

function GamePlayer() {
  const [loaded, setLoaded] = useState(false);
  return <div className="harbour-player">
    <div className="harbour-player-toolbar">
      <strong>Hearsay Harbour · Play or run a workshop</strong>
      <a href={HARBOUR_URL} target="_blank" rel="noopener noreferrer">Open game in a new tab<ExternalLink size={16} aria-hidden="true" /></a>
    </div>
    {!loaded && <p role="status" className="harbour-loading">Opening Hearsay Harbour…</p>}
    <iframe src={HARBOUR_URL} title="Hearsay Harbour playable game" className="harbour-frame"
      allow="fullscreen" allowFullScreen referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox"
      onLoad={() => setLoaded(true)} />
    <p className="harbour-player-note">Choose <strong>Play</strong> for your own island adventure, or <strong>Run a workshop</strong> for group prompts and voting. The welcome guide explains the controls. Progress is saved in this browser; a separate tab may have its own save.</p>
  </div>;
}

function Preview({ file, alt, caption }: { file: string; alt: string; caption: string }) {
  return <figure className="harbour-preview"><a href={`./game/${file}`} target="_blank" rel="noopener noreferrer" aria-label={`${caption} — open full-size screenshot in a new tab`}>
    <img src={`./game/${file}`} alt={alt} loading="lazy" width="1440" height="1000" />
  </a><figcaption>{caption}</figcaption></figure>;
}

export default function GameView({ mode, onMode }: { mode: GameMode; onMode: (mode: GameMode) => void }) {
  const [launched, setLaunched] = useState(false);
  const playerSection = useRef<HTMLDivElement>(null);
  function launch() {
    setLaunched(true);
    requestAnimationFrame(() => playerSection.current?.scrollIntoView({ block: "start", behavior: "auto" }));
  }
  return <main className="harbour-page">
    <header className="harbour-heading">
      <img src="./branding/sda-vision-logo.png" alt="SDA Vision" width="240" height="80" />
      <div><p className="harbour-kicker">An SDA Vision community game</p><h1>Hearsay Harbour</h1></div>
    </header>
    <fieldset className="harbour-modes"><legend className="sr-only">Game section</legend>
      <label className={mode === "demo" ? "selected" : ""}><input type="radio" name="harbour-mode" value="demo" checked={mode === "demo"} onChange={() => onMode("demo")} /><Gamepad2 size={18} aria-hidden="true" />Demo</label>
      <label className={mode === "dev" ? "selected" : ""}><input type="radio" name="harbour-mode" value="dev" checked={mode === "dev"} onChange={() => onMode("dev")} /><CodeXml size={18} aria-hidden="true" />Dev mode</label>
    </fieldset>
    {mode === "demo" ? <section aria-label="Game demo">
      <div className={`harbour-hero${launched ? " is-playing" : ""}`}>
        <div><p className="harbour-kicker">Notice · Discuss · Check · Reflect</p><h2>A little island of big questions.</h2>
          <p className="harbour-lead">Become the puffin keeper of a village noticeboard. Pictures arrive by gull, bottle and ferry. Follow the clues, hear different views and decide what you would share.</p>
          <p>Play on your own, explore together with younger learners, or bring a group into Workshop mode. Each picture connects first impressions with source information and a final reflection.</p>
          {!launched && <div className="harbour-actions"><button className="harbour-button" type="button" onClick={launch}><Play size={19} aria-hidden="true" />Play here</button><a href={HARBOUR_URL} target="_blank" rel="noopener noreferrer">Open game in a new tab<ExternalLink size={16} aria-hidden="true" /></a></div>}
        </div>
        {!launched && <img className="harbour-island" src="./game/island.png" alt="Hearsay Harbour’s island, with a village noticeboard, villagers and three places to check a picture." width="1440" height="900" />}
      </div>
      <div ref={playerSection} className="harbour-play-area">{launched && <GamePlayer />}</div>
      <ol className="harbour-steps" aria-label="Four ways to explore a picture">
        <li><span>1 · Notice</span><p>Place your hunch pebbles on details that catch your eye.</p></li>
        <li><span>2 · Discuss</span><p>Ask the villagers and compare their different explanations.</p></li>
        <li><span>3 · Check</span><p>Explore source-search, credential and file-detail activities.</p></li>
        <li><span>4 · Reflect</span><p>Revisit your first impression and choose how to describe the picture.</p></li>
      </ol>
      <div className="harbour-context"><h2>Bring the island into your session</h2><p>Workshop mode adds facilitator prompts and before-and-after group votes. At the end, use the recap, keepsakes and certificate to discuss what changed people’s minds. Findings can be saved as an image or PDF, with group voting data available as CSV.</p><p><strong>About the checks:</strong> the game uses prepared picture packs and scripted findings for teaching. Use the reveal and source notes to explore how each example was made. Facilitators can preview the pack and choose examples for their group.</p></div>
      <div className="harbour-gallery">
        <Preview file="notice.png" alt="A picture in the Notice activity, with hunch pebbles and first-impression choices." caption="Start with what catches your eye" />
        <Preview file="reveal.png" alt="The game’s reveal places source information alongside the player’s observations." caption="Compare your ideas with the source record" />
      </div>
    </section> : <section aria-label="Game developer resources">
      <div className="harbour-dev-intro"><p className="harbour-kicker">Create · Adapt · Explore</p><h2>Make an island for your questions.</h2><p className="harbour-lead">Use the local Dev Studio to build picture packs for teaching, workshops and research into how people interpret images.</p><p>Record each picture’s source and creation details, write or review the villagers’ responses, then choose which examples appear in the game. Developmental psychologists and other researchers can use the prompts and group-vote exports when designing their own studies.</p><div className="harbour-actions"><a className="harbour-button" href={`${HARBOUR_REPOSITORY}#running-it-locally`} target="_blank" rel="noopener noreferrer">Set up the local Dev Studio<ExternalLink size={17} aria-hidden="true" /></a><a href={HARBOUR_DOI} target="_blank" rel="noopener noreferrer">Download from Zenodo<ExternalLink size={16} aria-hidden="true" /></a></div></div>
      <div className="harbour-dev-grid">
        <article><h3>1. Start locally</h3><p>Download the game from GitHub or Zenodo. On macOS, use <strong>Start Hearsay Harbour.command</strong>. For the terminal route, the repository recommends Node.js 22 or newer:</p><pre><code>npm install{"\n"}npm run dev</code></pre><p>Open the address printed in the terminal, then choose <strong>Dev Studio: add pictures</strong> on the title screen.</p></article>
        <article><h3>2. Prepare and review</h3><p>Add a picture and its source record, choose a level, then review the caption, villagers’ dialogue, clues and final explanation. Use <strong>Play it</strong> to try a picture before making it visible to players.</p><p><strong>Dev Studio runs on your computer.</strong> This web tab introduces its tools and links to the setup instructions.</p></article>
        <article><h3>3. Choose your workflow</h3><p>Playing and editing packs by hand work without an AI account. Optional AI assist uses your configured provider and account; picture requests are subject to that provider’s terms and charges. Follow the repository’s setup guide before enabling it.</p><p>For group research, the recap can export the room’s first and final votes. Keep your study’s participant information, consent and data-handling arrangements alongside your chosen activities.</p></article>
      </div>
      <div className="harbour-gallery">
        <Preview file="studio-add.png" alt="Dev Studio’s Add a picture form, with source information and an optional AI-assist switch." caption="Add a picture and its creation record" />
        <Preview file="studio-pictures.png" alt="Dev Studio lists pictures and levels with controls to edit, preview and set their visibility." caption="Review your pack before sharing it" />
      </div><p className="harbour-small">Dev Studio screenshots come from the game repository; their AI suggestions are illustrative examples.</p>
    </section>}
    <section className="harbour-resources" aria-labelledby="harbour-resources-title"><h2 id="harbour-resources-title">Take Hearsay Harbour further</h2><div className="harbour-actions"><a href={HARBOUR_REPOSITORY} target="_blank" rel="noopener noreferrer">Explore the game on GitHub<ExternalLink size={16} aria-hidden="true" /></a><a href={HARBOUR_DOI} target="_blank" rel="noopener noreferrer">Game downloads and DOI on Zenodo<ExternalLink size={16} aria-hidden="true" /></a></div>
      <details><summary>Cite the game and view credits</summary><p>Martin, S. (2026) <em>Hearsay Harbour: a cozy game for spotting AI-generated misinformation images</em> [Computer software]. Zenodo. <a href={HARBOUR_DOI} target="_blank" rel="noopener noreferrer">doi:10.5281/zenodo.23237554</a>. This Concept DOI links to the latest published version; the record supplies version-specific citations.</p><p>An academic research project of <strong>Synthetic Realities</strong>, led by <strong>Dr Sam Martin</strong>, Smart Data Research UK (UKRI) Fellow (Grant number UKRI4010), Manchester Metropolitan University (MMU). <a href="https://orcid.org/0000-0002-4466-8374" target="_blank" rel="noopener noreferrer">ORCID: 0000-0002-4466-8374</a>.</p><p>The game’s visual style and selected helpers are adapted from <a href="https://github.com/zernonia/hivebound" target="_blank" rel="noopener noreferrer">Hivebound by zernonia</a>. Code is MIT licensed; example pictures retain their listed credits. <a href={`${HARBOUR_REPOSITORY}#credits`} target="_blank" rel="noopener noreferrer">Full game credits</a> · <a href="./game/LICENSE.txt" target="_blank" rel="noopener noreferrer">Bundled screenshot acknowledgements and licence</a>.</p></details>
    </section>
  </main>;
}
