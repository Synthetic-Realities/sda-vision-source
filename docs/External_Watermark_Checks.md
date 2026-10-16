# External watermark checks

SDA Vision places participant-pasted SynthID Detector replies alongside the
model findings, source information and workshop reflections. The recorded demo
links a reply to its prepared example. The research app also supports a more
detailed, file-identified record.

## In the recorded demo

1. In **Check**, open the recorded findings. **External checks** is visible in
   the Evidence box, with SynthID Detector and the OpenAI image checker side by
   side. On narrow screens they stack. Developer shows the same pair below the
   model evidence.
2. Choose the material and download it. An image, audio or video can use its
   complete original. For PDF and PowerPoint examples, choose a page or slide
   image; keep the complete document open for context.
3. Open [SynthID Detector](https://synthid.com/) in a new tab. Choose the upload
   there. Google receives that file, including retained metadata, under its
   account settings and current terms. Opening SDA's link sends no media.
4. Return and paste the full text into **SynthID results**.
   It is kept immediately in the browser session with the prepared example's
   details. There is no file-selection, date, outcome or confirmation form.
5. Download session notes before changing example or closing the page. For a
   presentation, each selected slide has its own reply box; changing the slide
   keeps any replies already entered for the other slides.

The demo offers prepared media only. It records the filename and available hash
of the offered example or slide, plus the time the reply was entered. Those
details identify SDA's example; they do not establish what was submitted to the
external service. The reply stays verbatim, including an error message, without
being classified automatically as a watermark finding or a model vote.

The adjacent **OpenAI image checker** has its own **OpenAI results** paste box,
also kept immediately in the browser session. Its shortcut is enabled for
image examples; original PDF/PPTX and audio/video inputs keep their existing
scope limits. A reply from a separately checked image can be recorded with its
page or frame name. Uploading there sends the selected image and retained
metadata to OpenAI under that service's account settings and current terms.
Both external services use their own accounts, terms and any charges,
separately from SDA's API accounts.

The recorded demo has one SynthID route: the dedicated Detector. The former
Gemini chat shortcut and extra checker disclosures are removed from this demo.
Historical Gemini replies and the three-model recorded findings are preserved.

## In the research app

The separate research interface retains **Record the external result**. After
preparing material, the researcher can identify the exact file, record the
outcome, date, reply and scope, and confirm the file association. Its optional
file selector reads identity locally in the browser. This form is excluded
from the recorded demo.

For these structured research records, SDA identifies the selected bytes with
SHA-256. A hash links a record to a file;
it does not authenticate a pasted service response. The entry is labelled as
participant-entered throughout the interface and exports.

## Coverage

The portal's offered formats were checked on 11 October 2026. It listed image,
audio and video formats, including M4A. PDF and PPTX containers were absent.
Check its current size, duration and quota limits before uploading. SDA does
not turn a webpage into a bulk API.

A rendered page or slide has a distinct file identity and credential history.
Its result concerns that image and the service's stated scope. The whole
document remains the object of source and discourse analysis. The built-in
checks describe sampled frames, transcript interpretation, excerpt descriptions
and local file information. Built-in audio checks: AI-origin detection from
the sound itself is outside this workflow. External audio watermark findings
have their own file and coverage.

| Structured research result | Meaning |
| --- | --- |
| Watermark detected | The participant records a positive service finding, with any named origin and scope. |
| Watermark not detected | Origin remains unresolved by this check. |
| Inconclusive | The service returned an undecided result. |
| Unsupported by the service | The service reported that it could not check this material. |
| Check failed | The attempt produced an error, with the exact message retained. |
| Not checked | The identified material has no recorded check. |

These records stay outside the combined score and are not additional model
votes. The podcast's source-informed **Mix of human and AI** workshop conclusion
continues to draw on Dr Sam Martin's creation record and comparison with the
published paper. A watermark finding adds evidence about production.

## Downloads and storage

The demo keeps these entries in browser memory, separately from frozen reports.
Session JSON, Markdown, CSV, PDF and PowerPoint include the added records.
Community summaries also include them. Original recorded-report downloads and
cached demo graphs retain the saved analysis.

The installed app holds entries with the current report and includes them in
report downloads and newly built research graphs as unscored observations.
Earlier research-run files on disk are not rewritten by a browser entry.
Shared PDF, slide and graph outputs retain their relevant scope statements.
The optional operator name is part of the exported record.

## Evidence and implementation

The [pilot](SynthID_Pilot_Findings_2026-10-11.md) recorded a Google AI watermark
finding for the first-page PNG from the infographic, and a generic error for
the first-slide PNG from the presentation. It establishes neither whole-file
coverage nor portal-wide reliability. Audio/video live validation is separate.

[Google's announcement](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/synth-id-ai-content/)
describes the dedicated portal's expanded vendor coverage.
[The implementation record](SynthID_Implementation_2026-10-11.md) specifies the
separate manual schema and verification.

[The demo simplification record](SynthID_Demo_Paste_Update_2026-10-15.md) describes
the separate paste-only session notes introduced on 15 October.

[The paired-checker update](SynthID_Demo_Checker_Pair_2026-10-15.md) records the
subsequent visible two-column layout and removal of the duplicate Gemini route.
