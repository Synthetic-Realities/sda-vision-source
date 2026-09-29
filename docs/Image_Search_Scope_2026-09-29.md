# Google Lens: image-only availability

Display revision: **image-search-2026-09-29.1**. Analysis methods and saved reports retain their existing versions and contents.

Google Lens is offered when the selected original item is an **image**. PDFs, presentations, audio/podcasts, videos, transcripts and unrecognised files have no Lens link or image-search disclosure. An image thumbnail, podcast cover, rendered slide or sampled video frame does not change the original item's media type.

This rule applies to the Community Workshop Evidence box, Reflect activity and image-search follow-up controls. Developer does not inherit the workshop's Lens controls when switching views. The Research/installed, Conference, public saved-results and workshop builds share the same eligibility rule.

Original-file downloads remain available for permitted examples, including when Lens is unavailable. Lens opens Google's image-search page in a separate tab; the user chooses any image to send there. Following the link does not upload the item automatically.

Google's [computer image-search guidance](https://support.google.com/websearch/answer/1325808?co=GENIE.Platform%3DDesktop&hl=en) describes searching with an image. This app-level rule concerns the original item selected in SDA Vision; it does not make a broader claim about every Google camera or search product.

## Verification

- TypeScript and production builds: Research, Conference, public saved-results and workshop profiles.
- Component regressions: image, PDF, PPTX, audio, video, text and unknown-file states, including non-image reports with image thumbnails. The saved report remains unchanged.
- Browser regressions at 1440px and 390px: image → PDF → podcast → presentation → video → image. Check and Reflect retain Lens only for images; original downloads remain available; switching to Developer leaves no hidden workshop Lens links.
- Research tests use local file selection. Conference tests use the approved-example path. All live API requests are intercepted with saved fixtures; provider calls and external media uploads are zero.
- The clean public installation source is built and checked separately from the private development checkout.

The checks use desktop browser automation with a phone-sized viewport. Physical phone and Amazon Silk checks are for researcher confirmation after deployment.

## Release scope

The maintained source and newly built installation candidate include this display correction. The original software 0.1.0 Zenodo archive remains a frozen published record; a subsequent version in the same software DOI series can carry the correction. The facilitator guide and its separate DOI series retain their published files.
