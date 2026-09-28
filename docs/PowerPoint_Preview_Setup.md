# PowerPoint slide previews and installation

The public demo includes prepared slides for `presentation.pptx`. **Preview slides** in Developer opens an enlarged viewer with Previous, Next and a slide selector. Community Workshop shows the same presentation inline, with an enlarge control.

## Uploaded presentations

In the installed **Research** app, choose a `.pptx` file in either Developer or Community Workshop and select **Preview slides**. A magenta loading strip marks preparation. The slides remain available when switching between those views; choosing another file resets the preview. Rendering is separate from analysis, provider consent and model calls. The Conference profile can preview its reviewed examples through its existing access controls.

## Optional installation: LibreOffice

Install [LibreOffice from its official download page](https://www.libreoffice.org/download/) on the computer running SDA Vision's backend to render uploaded PowerPoint slides. The public website's prepared slides and the rest of the app can be used without this dependency. `setup.sh` installs the app's Python and JavaScript dependencies; install LibreOffice separately.

On macOS, place LibreOffice in **Applications**. SDA Vision looks for `/Applications/LibreOffice.app/Contents/MacOS/soffice`, then for `soffice` or `libreoffice` on the process PATH. On Linux, install the LibreOffice Impress component and make its command available on PATH. Apple Silicon macOS is the tested installation platform; other platforms require their own installation checks.

After installation, retry **Preview slides**. If the app was started before changing PATH, restart it. A missing or unavailable installation produces a message beside the preview button. [LibreOffice's command-line documentation](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html) describes its headless conversion interface.

## Preview scope and storage

The viewer renders each slide as a static image, up to 200 slides per presentation and within the app's upload and rendering limits. Animations, transitions and embedded audio/video playback remain in the original PowerPoint. Layout may depend on the fonts installed on the rendering computer; check your own deck before a session. Decks with externally linked media need a copy with the media embedded.

Rendering writes the chosen deck, an intermediate PDF and a temporary LibreOffice profile into a temporary local directory. The app removes that directory when conversion ends or reports a handled error. An interrupted process may leave temporary files for normal system cleanup. Preview images are returned to the browser session. Preview rendering does not add model votes or change the media sampling used for analysis.

## Release packaging

This guidance accompanies the GitHub source candidate and Zenodo preparation packs. LibreOffice is installed separately under its own licence; its binaries are not bundled. SDA Vision's code retains the agreed MIT licence. The editable facilitator PowerPoint is a separate local conference resource; the downloadable guide packs contain the PDF.
