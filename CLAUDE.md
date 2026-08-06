# Ocean Independence — Charter Landing Page

Single-page cinematic scroll site (plain HTML/CSS/JS, GSAP ScrollTrigger from CDN).
Built to the design handoff in the client's zip: eight sections, mobile-first at
390px, desktop adaptation at 1440px. British English, no exclamation marks.

## Testing gotchas — read before debugging "broken" reports

- **Remote desktops trigger reduced-motion mode.** Windows remote desktop
  sessions disable OS animation effects, so Chrome reports
  `prefers-reduced-motion: reduce` and the page deliberately shows poster
  frames with no autoplay, no curtain scroll, no pins and no hull rotation
  (as the handoff specifies). This looks identical to "nothing works". It is
  by design. Confirmed with the client on 06 August 2026: their page was
  "broken" only inside their remote desktop and fine outside it.
- **The sandbox Chromium here has no h264 decoder.** Videos never play in
  local headless tests. To test playback logic, transcode clips to VP9 and
  serve them for the mp4 URLs via Playwright request interception (see the
  session's playtest approach).
- **Client hosting is Sirv** (their CDN, cdn.oceanindependence.com). It
  serves mp4 with correct types, byte ranges and open CORS, and supports
  static sites with JS on paid accounts. Cache is ~7 days: after re-upload,
  hard refresh or purge in the Sirv panel, or stale files mix with fresh ones.

## Workflow notes

- PRs on this repo get merged by the client almost immediately; a merged PR
  is finished — restart the working branch from origin/main for follow-ups.
- Source masters live on the client's CDN (URL-encoded paths with spaces),
  67-71MB each, gitignored locally as master.mp4 / fetched to scratchpad.
  Both new masters (vertical reel + horizontal) are the same 39.5s edit,
  so one set of scene-cut timestamps serves both crops.
- Clips are cut with ffmpeg trim+concat filter graphs (scene cuts every
  1-2s make single-window cuts incoherent); target under 2-3MB per loop,
  crf 26, maxrate 2600k, faststart, audio stripped.

## Architecture decisions

- Every `.section` is `position: sticky; top: 0` — the curtain reveal.
  Covered sections still report viewport-sized rects, so visibility for
  play/pause and ScrollTriggers is computed from flow layout offsets
  (see `measureFlow` in main.js), never from IntersectionObserver alone.
- Tall sections (opening 180svh, experiences 260svh) pin via a STICKY
  100svh `.frame` inside the section, not via the section's own
  stickiness — a sticky section cannot shift past the bottom of `main`,
  so late-page tall sections release early (celebration broke this way).
  Corollary: `.section` must NOT have `overflow: hidden` (an overflow
  ancestor becomes the sticky frame's scrollport and kills it); clipping
  lives on `.frame`.
- Experiences are two-beat: clean video while the frame pins, then a
  `#03060B` panel rises over it (GSAP-scrubbed yPercent 100→0; the CSS
  translateY(100%) fallback must be cancelled with y: 0 in the tween or
  the transforms stack), then the lockup fades in, reversing on scroll
  back. Videos pause once their panel has covered them.
- Videos: per-viewport sources (`data-mobile`/`data-desktop`) selected at
  load; hero keeps a real `src` in HTML so it plays even without JS;
  playback retries on first gesture for battery-saver modes.
- Easing everywhere is `cubic-bezier(0.16, 1, 0.3, 1)` (CustomEase "oi"),
  except section 3 which snaps by design.
