# SynthID update: SDA Vision capability review

Reviewed 10 October 2026; authorised pilot added 11 October 2026. No app,
scoring, provider prompt or published release changed. The original review
involved no uploads. The subsequent pilot submitted two approved page/slide
images through the normal SynthID website interface in Chrome; see the
[pilot findings](SynthID_Pilot_Findings_2026-10-11.md).

## Confirmed change

Google's [7 October announcement](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/synth-id-ai-content/)
opens the SynthID Detector globally in English for images, audio and video,
covering supported watermarked media from Google, OpenAI, NVIDIA and Kakao,
with Apple described as forthcoming. This does not establish coverage of every
model, output date or modality from each vendor.

The dedicated portal and Gemini have different documented coverage.
[Gemini Apps Help](https://support.google.com/gemini/answer/16722517?hl=en-se)
currently describes Google-only SynthID recognition. Its file limits and quotas
should not be presented as the dedicated portal's limits.

The [portal's first-use terms](https://synthid.com/) prohibit treating its
frontend as an automated API for bulk verification. No documented public
image/audio/video detector API was established by this review. On 11 October,
Dr Sam Martin reported accepting the portal's requests and authorised the
named pilot files. The pilot confirmed the offered file extensions and two
response states. Size, duration and quota limits remain unconfirmed.

## Current implementation

- `frontend/src/components/SecondOpinion.tsx` opens Gemini, copies a checking
  prompt and retains manually pasted replies. PDF/PPTX guidance refers to
  extracted images. It has no dedicated SynthID Detector result record.
- `app/providers/synthid.py` contains an optional endpoint/token adapter with
  legacy waitlist wording and assumed probability response fields. It is not a
  validated adapter for the newly public portal.
- `app/aggregate.py` can use that adapter's numeric rating as a watermark
  override. A new external-check record must not enter this route implicitly.
- Export and graph surfaces include service-specific reply labels. Historical
  Gemini replies must retain their actual source.

## Recommended first implementation

1. Add **Check with SynthID Detector** beside **Download original file** in
   Community and Developer. Users choose the upload on Google's site; explain
   the recipient and applicable external service terms beside the action.
   Keep Gemini available with its own coverage label.
2. Provide format-specific instructions: the original image, audio or video
   where supported. For PDF/PPTX, investigate whole-file acceptance and reported
   coverage first, using selected extracted images as a fallback or comparison.
   Keep the complete artefact as the unit of discourse analysis, and identify
   the scope of each check. Direct PDF/PPTX detection remains unconfirmed.
3. Add a separately labelled external-check record: service, checked file/hash,
   original or derivative, operator, date, exact response, stated origin and
   scope. Capture regions, timestamps or tracks only when reported. Distinguish
   detected, not detected, inconclusive, unsupported, failed and not checked.
4. Show these findings alongside model assessments, source evidence and workshop
   reflections. Retain raw replies and the existing saved analyses. A negative
   detection result leaves origin unresolved within the check's coverage.
   Detector findings are not another visual-model vote or an invented percentage.
5. Carry the source and scope into session notes, PDF/CSV exports, Developer
   records, facilitator guidance and release documentation. Any later automated
   scoring change needs a separately reviewed method change and a documented API.

## Next-session list: whole-document pilot

Added following Dr Sam Martin's review on 10 October 2026. Progress recorded
11 October after explicit authorisation for the two named originals if
supported, plus one rendered page/slide image from each.

- [x] Confirm offered file extensions and signed-in access: images, audio and
      video; PDF and PPTX are absent from the normal upload format list.
- [ ] Establish portal-specific size, duration and quota limits.
- [x] Obtain explicit authorisation for `infographic.pdf`, `presentation.pptx`
      if supported, and one existing first-page/first-slide PNG from each.
- [x] Assess original-format support: neither document format was offered, so
      neither original was submitted. This is not an observed server rejection.
- [x] Record image scope and exact replies. The first PDF-page PNG returned a
      Google AI watermark finding; the first slide PNG returned a generic error.
      The portal provided no numeric score or finer content-region attribution.
- [x] Save hashes, raw visible responses and screenshots for both image checks.
      Whole-file versus component detection could not be compared, and the
      failed slide check provides no watermark finding.
- [ ] Use the observations to refine the Community, Developer, conference and
      installed-app workflow, then the exports and facilitator guidance.

The research question is how whole-file and component checks can inform
Synthetic-media Discourse Analysis. Watermark findings contribute production
evidence; the wording, imagery, citations, narrative and human/AI contributions
remain part of the wider document interpretation. Keep these analytical layers
visible rather than assuming the detector itself performs discourse analysis.

## Podcast teaching opportunity

[DeepMind's overview](https://deepmind.google/models/synthid/) names NotebookLM
podcast generation among its audio-watermark applications. That makes the
existing podcast a useful candidate for an authorised check, without assuming
this particular file will return a positive result.

A detected audio watermark would add production evidence. The paper citation
and comparison activity address the research source and adaptation. Together
they support discussion of the source-informed **Mix of human and AI** workshop
conclusion. The detector does not assess the truth of the paper or the fidelity
of the podcast. Keep transcript interpretation and audio excerpt descriptions
separate from a recorded watermark check.

## Verification before release

- Agree an explicit upload scope for a small pilot of approved examples.
- Record actual portal results and coverage, including an inconclusive or
  unavailable path; do not manufacture expected successes.
- Use mocked results for UI/export tests, including empty, failed, unsupported,
  negative and partial-scope records, and check scoring isolation.
- Check mobile layout, original downloads and media-specific instructions in
  the demo, conference and installed app builds.
- Update the audio scope sentence to identify what SDA's automated analysis
  covers when a separate external watermark result is displayed.

This proposal extends the vendor-neutral external-check approach in
[Platform Provenance: Conference And Research Scope](Platform_Provenance_Scope_2026-09-24.md).
