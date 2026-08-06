const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Sections are position: sticky, so a covered section still reports a
// viewport-sized rect. Anything that depends on "is this section really
// on show" works from flow positions (layout offsets) instead.
const sections = Array.from(document.querySelectorAll(".section"));
const flowTop = new Map();

function measureFlow() {
  let y = 0;
  sections.forEach((section) => {
    flowTop.set(section, y);
    y += section.offsetHeight;
  });
}

measureFlow();
selectSources();

// Reduced motion: posters only — no playback, no pins, no rotation,
// no sequenced reveals. The panel text still enters, but as a fade
// only, with no movement: a class arms the CSS transition and an
// observer plays it once per lockup as it comes into view.
if (reducedMotion) {
  document.querySelectorAll("video").forEach((video) => {
    video.removeAttribute("autoplay");
    video.pause();
  });
  document.documentElement.classList.add("rm-fade");
  const fadeIn = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.4 }
  );
  document.querySelectorAll(".lockup").forEach((lockup) => fadeIn.observe(lockup));
} else {
  initMedia();
  if (window.gsap && window.ScrollTrigger) {
    initMotion();
  } else {
    // Without GSAP the panels would stay translated off screen; stack
    // the experience beats statically instead so the text stays readable.
    document.documentElement.classList.add("no-motion");
  }
}

// Each video carries a vertical cut (data-mobile) and a horizontal cut
// (data-desktop); pick per viewport. Under reduced motion only the
// posters are swapped and no video source is ever attached.
function selectSources() {
  const desktop = window.matchMedia("(min-width: 900px)").matches;
  document.querySelectorAll("video.media").forEach((video) => {
    if (desktop && video.dataset.posterDesktop) {
      video.poster = video.dataset.posterDesktop;
    }
    if (reducedMotion) {
      video.removeAttribute("src");
      return;
    }
    const file = desktop ? video.dataset.desktop : video.dataset.mobile;
    if (!file) return;
    if (video.hasAttribute("data-eager")) {
      if (video.getAttribute("src") !== file) video.src = file;
      video.preload = "auto";
      video.load();
      video.play().catch(() => {});
    } else {
      video.dataset.src = file;
    }
  });
}

// A section is on show from one viewport before its flow slot until the
// next section's curtain has fully covered it.
function onShow(section, lead) {
  const top = flowTop.get(section);
  const bottom = top + section.offsetHeight;
  const y = window.scrollY;
  return y < bottom && y + window.innerHeight > top - lead;
}

function initMedia() {
  const videos = Array.from(document.querySelectorAll("video.media"));

  // Lazy-load videos beyond the hero, one viewport ahead of arrival.
  const loader = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const video = entry.target;
        if (video.dataset.src) {
          video.src = video.dataset.src;
          video.removeAttribute("data-src");
          video.load();
        }
        observer.unobserve(video);
      });
    },
    { rootMargin: "100% 0px" }
  );
  videos.forEach((video) => {
    if (video.dataset.src) loader.observe(video);
  });

  // Play only the section on show (plus a small lead as the next curtain
  // arrives); pause everything covered or not yet reached. Retries on
  // every pass, which also recovers from blocked autoplay (battery-saver
  // and data-saver modes allow playback after the first gesture).
  function updatePlayback() {
    videos.forEach((video) => {
      const section = video.closest(".section");
      // Once an experience's black panel has fully covered its video
      // (one viewport plus the panel window into the section), it can
      // pause — no point decoding behind the panel.
      const panelDone =
        section.querySelector(".panel") &&
        window.scrollY > flowTop.get(section) + 1.15 * window.innerHeight;
      if (!panelDone && onShow(section, 0.25 * window.innerHeight)) {
        if (!video.src && video.dataset.src) {
          video.src = video.dataset.src;
          video.removeAttribute("data-src");
          video.load();
        }
        if (video.src && video.paused) video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  }

  window.addEventListener("scroll", updatePlayback, { passive: true });
  window.addEventListener("resize", () => {
    measureFlow();
    updatePlayback();
  });
  ["touchstart", "click"].forEach((type) =>
    window.addEventListener(type, updatePlayback, { once: true, passive: true })
  );
  updatePlayback();
}

function initMotion() {
  gsap.registerPlugin(ScrollTrigger);

  // The handoff's global easing curve, exact via CustomEase, with a
  // close approximation as fallback if the plugin fails to load.
  let EASE = "expo.out";
  if (window.CustomEase) {
    gsap.registerPlugin(CustomEase);
    EASE = CustomEase.create("oi", "0.16, 1, 0.3, 1");
  }
  const RISE = { y: 12, duration: 0.48, ease: EASE };

  // Sticky sections report stuck rects on refresh, so every trigger uses
  // numeric scroll positions derived from flow layout instead of
  // element-relative keywords.
  ScrollTrigger.addEventListener("refreshInit", measureFlow);
  const vh = () => window.innerHeight;
  const enters = (section, at) => () => flowTop.get(section) - at * vh();
  const covered = (section) => () => flowTop.get(section) + section.offsetHeight;

  // 02 OPENING — the 180svh sticky section pins the statement over its
  // own video for ~80vh; a scrubbed fade releases it just before the
  // next section's curtain arrives.
  document.querySelectorAll(".pin-block").forEach((block) => {
    const section = block.closest(".section");

    // The mint rule draws in horizontally first, then the statement
    // fades and rises, with the subline following at +200 ms.
    gsap
      .timeline({
        scrollTrigger: { trigger: section, start: enters(section, 0.6), once: true },
      })
      .from(block.querySelector(".rule"), {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 0.4,
        ease: EASE,
      })
      .from(
        block.querySelector(".statement"),
        { autoAlpha: 0, y: 14, duration: 0.7, ease: EASE },
        ">"
      )
      .from(
        block.querySelector(".subline"),
        { autoAlpha: 0, y: 14, duration: 0.7, ease: EASE },
        "<0.2"
      );

    gsap.fromTo(
      block,
      { opacity: 1 },
      {
        opacity: 0,
        ease: "none",
        immediateRender: false,
        scrollTrigger: {
          trigger: section,
          start: () => covered(section)() - 1.15 * vh(),
          end: () => covered(section)() - vh(),
          scrub: true,
        },
      }
    );
  });

  // 03–06 THE EXPERIENCES — two beats, scrubbed so the guest sets the
  // pace and scrolling back reverses cleanly. The video plays clean
  // while the frame pins; after ~60vh the black panel rises over it
  // across ~40vh of scroll (about 600 ms at a natural pace); once
  // covered, the headline fades in and the subheadline follows 200 ms
  // later, both rising as they fade.
  document.querySelectorAll(".experience").forEach((section) => {
    const panel = section.querySelector(".panel");

    // y: 0 cancels the CSS translateY(100%) fallback (GSAP parses it as
    // a pixel offset), leaving yPercent as the single source of truth.
    gsap.fromTo(
      panel,
      { yPercent: 100, y: 0 },
      {
        yPercent: 0,
        y: 0,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: () => flowTop.get(section) + 0.6 * vh(),
          end: () => flowTop.get(section) + 1.0 * vh(),
          scrub: true,
        },
      }
    );

    // Text enters once, when the panel settles: 700 ms, opacity and
    // transform only (compositor-friendly), headline first, subheadline
    // at +200 ms. Never scrubbed, never replayed on scroll back.
    gsap
      .timeline({
        scrollTrigger: {
          trigger: section,
          start: () => flowTop.get(section) + 1.0 * vh(),
          once: true,
        },
      })
      .from(section.querySelector(".lockup-headline"), {
        autoAlpha: 0,
        y: 14,
        duration: 0.7,
        ease: EASE,
      })
      .from(
        section.querySelector(".lockup-sub"),
        { autoAlpha: 0, y: 14, duration: 0.7, ease: EASE },
        0.2
      );
  });

  // 07 THE CHARTER EXPERIENCE — hull draws in, then the six lines build
  // in strict sequence: the rule draws out of the hull toward the text
  // (~400 ms), the text rises and fades in (~300 ms), a ~120 ms beat,
  // then the next line. Mobile runs in on-screen order; desktop zigzags
  // left to right. Plays once, never replays.
  const fleet = document.querySelector(".fleet");
  const hull = document.querySelector(".hull");
  const drawn = [];
  const faded = [];
  hull.querySelectorAll("path, line, ellipse").forEach((el) => {
    if (el.hasAttribute("stroke-dasharray") || el.tagName === "ellipse") {
      faded.push(el);
    } else {
      const length = el.getTotalLength();
      el.style.strokeDasharray = length;
      el.style.strokeDashoffset = length;
      drawn.push(el);
    }
  });

  const desktop = window.matchMedia("(min-width: 900px)").matches;
  const above = Array.from(fleet.querySelectorAll(".lines-above .stat-line"));
  const below = Array.from(fleet.querySelectorAll(".lines-below .stat-line"));
  const order = desktop
    ? [above[0], below[0], above[1], below[1], above[2], below[2]]
    : [...above, ...below];

  const sequence = gsap.timeline({
    scrollTrigger: { trigger: fleet, start: enters(fleet, 0.55), once: true },
  });
  sequence
    .to(drawn, { strokeDashoffset: 0, duration: 1.6, ease: EASE, stagger: 0.08 })
    .from(faded, { opacity: 0, duration: 0.8, ease: EASE, stagger: 0.05 }, "-=0.8");
  order.forEach((line) => {
    sequence
      .from(line.querySelector(".stat-rule"), { scaleY: 0, duration: 0.4, ease: EASE }, ">")
      .from(line.querySelector(".stat-label"), { opacity: 0, y: 10, duration: 0.3, ease: EASE }, ">")
      .to({}, { duration: 0.12 });
  });
  sequence.from(".cta-wrap", { opacity: 0, ...RISE }, ">");

  gsap.fromTo(
    ".hull-rotor",
    { rotateY: -12 },
    {
      rotateY: 12,
      ease: "none",
      scrollTrigger: {
        trigger: fleet,
        start: enters(fleet, 1),
        end: covered(fleet),
        scrub: 1,
      },
    }
  );
}
