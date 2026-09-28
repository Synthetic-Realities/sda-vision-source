import { HIDE_SECOND_OPINION, SHOWCASE, CONFERENCE } from "../showcase";

export default function Footer({ devMode }: { devMode?: boolean }) {
  return (
    <footer className="foot">
      {!SHOWCASE && <p>Explore the findings alongside the original source, context and your own observations.</p>}
      <div className="footer-links">
      {SHOWCASE && <><a href="./about.html">About, credits and licences</a><a href="https://github.com/Synthetic-Realities/sda-vision-demo">Demo repository</a></>}
      <details className="privacy">
        <summary><a>Privacy and how your data is handled</a></summary>
        <p className="small">
          {SHOWCASE ? "This demo displays bundled reports. Newly pasted replies remain in browser memory until the report is discarded or the page reloads/closes; save them using session downloads. Original recorded-report downloads remain unchanged." : CONFERENCE ? <>Conference analysis processes the server's listed originals through the enabled providers, including Google/OpenAI transcription for audio. Reports are returned to this browser without research-run storage. Conference report and graph exports send the held report to the authenticated server. Provider retention, host access logs, native temporary files and downloaded copies have their separate lifetimes.</> : <>
          Live analysis sends selected media or extracted frames/text and context to configured
          cloud providers. Audio transcription uses Google, with OpenAI as a fallback.
          Video soundtrack inspection is local. Separate consented checks can send a short
          audio excerpt to Google, or the complete original audio/video file to Suno.
          These optional results remain browser-held unless exported or included in a later saved deep pass.
          Provider retention terms apply.
          Keys remain on the local server and are used for provider authentication.
          Audio/video processing can create temporary local files, removed after normal processing; interrupted cleanup may leave files.
          {devMode === true
            ? " Research mode is ON: unencrypted reports, extracted text, filenames and thumbnails are saved locally in dev_runs/ until you delete them. Use an access-controlled machine and follow the project's retention schedule."
            : devMode === false
              ? " Research mode is OFF: the app does not save analysis reports server-side."
              : " Server retention mode is not yet known; check configuration before uploading."}
          </>}
          {" "}No app telemetry, analytics or engagement tracking is collected.
          {/* This build variant has no second-opinion buttons, so the sentence
              describing them is omitted rather than describing absent UI. */}
          {!HIDE_SECOND_OPINION && <> Second Opinion opens the selected external service in your
          browser. You choose and attach material there under its account settings and terms.{" "}
          {SHOWCASE ? "New replies are included in session downloads, separately from the recorded findings." : CONFERENCE ? "Pasted replies remain separate from the combined assessment; note scoring is unavailable in Conference mode." : "Pasted notes are included in exports and any later saved research-mode deep pass. Choosing Add note to scoring sends the first 4,000 characters to Anthropic using the configured API account; provider terms and charges apply."}</>}
        </p>
        {SHOWCASE && <p className="small">GitHub Pages hosts this website and records visitor IP addresses for security. Display preferences are stored in this browser. See <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub’s privacy statement</a>.</p>}
      </details>
      </div>
    </footer>
  );
}
