import { useRef, useState } from "react";
import { ExternalLink, Gamepad2, CodeXml, Play } from "lucide-react";
import "../game.css";

export const HARBOUR_URL = "https://synthetic-realities.github.io/hearsay-harbour/";
export const HARBOUR_REPOSITORY = "https://github.com/Synthetic-Realities/hearsay-harbour#hearsay-harbour";
export const HARBOUR_ARCADE_URL = `${HARBOUR_URL}?arcade`;
export const HARBOUR_DOI = "https://doi.org/10.5281/zenodo.23243671";
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
    <p className="harbour-player-note">Choose <strong>Play</strong> for your own island adventure, or <strong>Run a workshop</strong> for group prompts and voting. The welcome guide explains the controls. For remote or controller navigation, switch on <strong>Arcade / TV remote mode</strong> on the title screen. Progress and any keeper or group name you enter are saved in this browser; a separate tab may have its own save.</p>
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
          <p>Play on your own, explore together with younger learners, or bring a group into Workshop mode. Arcade / TV remote mode supports directional navigation with a remote, keyboard or gamepad. Each picture connects first impressions with source information and a final reflection.</p>
          {!launched && <div className="harbour-actions"><button className="harbour-button" type="button" onClick={launch}><Play size={19} aria-hidden="true" />Play here</button><a href={HARBOUR_URL} target="_blank" rel="noopener noreferrer">Open game in a new tab<ExternalLink size={16} aria-hidden="true" /></a></div>}
        </div>
        {!launched && <img className="harbour-island" src="./game/island-v1.3.png" alt="Hearsay Harbour’s island, with a village noticeboard, villagers and three places to check a picture." width="1440" height="1000" />}
      </div>
      <div ref={playerSection} className="harbour-play-area">{launched && <GamePlayer />}</div>
      <ol className="harbour-steps" aria-label="Four ways to explore a picture">
        <li><span>1 · Notice</span><p>Place your hunch pebbles on details that catch your eye.</p></li>
        <li><span>2 · Discuss</span><p>Ask the villagers and compare their different explanations.</p></li>
        <li><span>3 · Check</span><p>Explore source-search, credential and file-detail activities.</p></li>
        <li><span>4 · Reflect</span><p>Revisit your first impression and choose how to describe the picture.</p></li>
      </ol>
      <div className="harbour-context"><h2>Bring the island into your session</h2><p>Workshop mode adds facilitator prompts and before-and-after group votes. At the end, use the recap, keepsakes and certificate to discuss what changed people’s minds. Enter a keeper’s name for individual play, or a group or class name for a workshop: it appears on the certificate and final findings recap, including saved images, PDFs and CSV data.</p><p>The name is optional and is saved with the game’s progress in this browser. A nickname or session label works too. For downloadable findings, open the game in its own tab; the embedded view offers an image preview.</p><p><strong>About the checks:</strong> the game uses prepared picture packs and scripted findings for teaching. Use the reveal and source notes to explore how each example was made. Facilitators can preview the pack and choose examples for their group.</p></div>
      <section className="harbour-arcade" aria-labelledby="harbour-arcade-title">
        <div><h2 id="harbour-arcade-title">Play on a big screen</h2><p>Choose <strong>Arcade / TV remote mode</strong> on the game’s title screen, or use the link below to open it switched on. Large <strong>Back</strong> and <strong>Continue</strong> zones sit beside each activity window for TV pointer controls.</p>
          <ul><li><strong>Arrows, joystick or D-pad:</strong> move the highlight; scroll at the ends of a long window.</li><li><strong>OK, Enter or A:</strong> choose the highlighted control.</li><li><strong>Back, Escape or B:</strong> close the current window.</li></ul>
          <div className="harbour-actions"><a className="harbour-button" href={HARBOUR_ARCADE_URL} target="_blank" rel="noopener noreferrer">Open Arcade / TV mode<ExternalLink size={17} aria-hidden="true" /></a></div>
        </div>
        <Preview file="arcade-2026-10-09.png" alt="Hearsay Harbour title screen with Arcade / TV remote mode on and a bright highlight around the selected control." caption="Remote and controller navigation on the live game" />
      </section>
      <div className="harbour-gallery">
        <Preview file="notice-v1.3.png" alt="A picture in the Notice activity, with hunch pebbles and first-impression choices." caption="Start with what catches your eye" />
        <Preview file="reveal.png" alt="The game’s reveal places source information alongside the player’s observations." caption="Compare your ideas with the source record" />
      </div>
    </section> : <section aria-label="Game developer resources">
      <div className="harbour-dev-intro"><p className="harbour-kicker">Create · Adapt · Explore</p><h2>Make an island for your questions.</h2><p className="harbour-lead">Use the local Dev Studio to build picture packs for teaching, workshops and research into how people interpret images.</p><p>Record each picture’s source and creation details, write or review the villagers’ responses, then choose which examples appear in the game. Developmental psychologists and other researchers can use the prompts and group-vote exports when designing their own studies.</p><div className="harbour-actions"><a className="harbour-button" href={HARBOUR_REPOSITORY} target="_blank" rel="noopener noreferrer">Set up the local Dev Studio<ExternalLink size={17} aria-hidden="true" /></a><a href={HARBOUR_DOI} target="_blank" rel="noopener noreferrer">Download from Zenodo<ExternalLink size={16} aria-hidden="true" /></a></div></div>
      <div className="harbour-dev-grid">
        <article><h3>1. Start locally</h3><p>Get the current source from GitHub, or a published release from Zenodo. On macOS, use <strong>Start Hearsay Harbour.command</strong>. For the terminal route, the repository recommends Node.js 22 or newer:</p><pre><code>npm install{"\n"}npm run dev</code></pre><p>Open the address printed in the terminal, then choose <strong>Dev Studio: add pictures</strong> on the title screen.</p></article>
        <article><h3>2. Prepare and review</h3><p>Add a picture and its source record, choose a level, then review the caption, villagers’ dialogue, clues and final explanation. Use <strong>Play it</strong> to try a picture before making it visible to players. Try your pack with the controls your group will use, including <strong>Arcade / TV remote mode</strong> for remotes and controllers.</p><p><strong>Dev Studio runs on your computer.</strong> This web tab introduces its tools and links to the setup instructions.</p></article>
        <article><h3>3. Choose your workflow</h3><p>Playing and editing packs by hand work without an AI account. Optional AI assist uses your configured provider and account; picture requests are subject to that provider’s terms and charges. Follow the repository’s setup guide before enabling it.</p><p>The recap exports first and final votes alongside the optional keeper or group name. Names also appear on the certificate and saved findings. Choose nicknames or session labels where appropriate, and include these exports in your study’s consent and data-handling arrangements.</p></article>
      </div>
      <div className="harbour-gallery">
        <Preview file="studio-add.png" alt="Dev Studio’s Add a picture form, with source information and an optional AI-assist switch." caption="Add a picture and its creation record" />
        <Preview file="studio-pictures.png" alt="Dev Studio lists pictures and levels with controls to edit, preview and set their visibility." caption="Review your pack before sharing it" />
      </div><p className="harbour-small">Dev Studio screenshots come from the game repository; their AI suggestions are illustrative examples.</p>
    </section>}
    <section className="harbour-resources" aria-labelledby="harbour-resources-title"><h2 id="harbour-resources-title">Take Hearsay Harbour further</h2><div className="harbour-actions"><a href={HARBOUR_REPOSITORY} target="_blank" rel="noopener noreferrer">Explore the game on GitHub<ExternalLink size={16} aria-hidden="true" /></a><a href={HARBOUR_DOI} target="_blank" rel="noopener noreferrer">Game downloads and DOI on Zenodo<ExternalLink size={16} aria-hidden="true" /></a></div>
      <p className="harbour-small">The live game and GitHub source include current development updates. Zenodo provides published, versioned releases.</p>
      <details><summary>Cite the game and view credits</summary><p>Martin, S. (2026) <em>Hearsay Harbour: a cosy game for spotting AI-generated misinformation images</em> [Computer software]. Zenodo. <a href={HARBOUR_DOI} target="_blank" rel="noopener noreferrer">doi:10.5281/zenodo.23243671</a>. This Concept DOI links to the latest published version; the record supplies version-specific citations.</p><p>An academic research project of <strong>Synthetic Realities</strong>, led by <strong>Dr Sam Martin</strong>, Smart Data Research UK (UKRI) Fellow (Grant number UKRI4010), Manchester Metropolitan University (MMU). <a href="https://orcid.org/0000-0002-4466-8374" target="_blank" rel="noopener noreferrer">ORCID: 0000-0002-4466-8374</a>.</p><p>The game’s visual style and selected helpers are adapted from <a href="https://github.com/zernonia/hivebound" target="_blank" rel="noopener noreferrer">Hivebound by zernonia</a>. Code is MIT licensed; example pictures retain their listed credits. <a href={HARBOUR_REPOSITORY} target="_blank" rel="noopener noreferrer">Full game credits</a> · <a href="./game/LICENSE.txt" target="_blank" rel="noopener noreferrer">Bundled screenshot acknowledgements and licence</a>.</p></details>
    </section>
  </main>;
}
