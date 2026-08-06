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

// Reduced motion: posters only — no playback, no pins, no rotation.
if (reducedMotion) {
  document.querySelectorAll("video").forEach((video) => {
    video.removeAttribute("autoplay");
    video.pause();
  });
} else {
  initMedia();
  if (window.gsap && window.ScrollTrigger) {
    initMotion();
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
  const still = document.querySelector(".anywhere-image");
  const anywhere = still.closest(".section");

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
      if (onShow(section, 0.25 * window.innerHeight)) {
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

    // 06 ANYWHERE — slow 8 s scale drift, once per entry.
    if (onShow(anywhere, 0)) {
      still.classList.add("is-drifting");
    } else if (still.classList.contains("is-drifting")) {
      still.style.transition = "none";
      still.classList.remove("is-drifting");
      void still.offsetWidth;
      still.style.transition = "";
    }
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

  // 02 MORNING · 05 GOLDEN HOUR — the 180svh sticky section pins the
  // statement over its own video for ~80vh; a scrubbed fade releases it
  // just before the next section's curtain arrives.
  document.querySelectorAll(".pin-block").forEach((block) => {
    const section = block.closest(".section");

    gsap.from(block.children, {
      opacity: 0,
      ...RISE,
      scrollTrigger: { trigger: section, start: enters(section, 0.6) },
    });

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

  // 03 DAY — the one faster section: the line snaps in, no fade.
  const day = document.querySelector(".day");
  gsap.fromTo(
    ".day-block",
    { autoAlpha: 0 },
    {
      autoAlpha: 1,
      duration: 0.01,
      scrollTrigger: {
        trigger: day,
        start: enters(day, 0.25),
        toggleActions: "play none none reverse",
      },
    }
  );

  // 04 THE YACHT — hull draws in, stats follow with a 120 ms stagger,
  // and the whole model rotates ±12° with scroll progress, damped so it
  // trails the scroll slightly.
  const yacht = document.querySelector(".yacht");
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

  gsap
    .timeline({ scrollTrigger: { trigger: yacht, start: enters(yacht, 0.55) } })
    .to(drawn, { strokeDashoffset: 0, duration: 1.6, ease: EASE, stagger: 0.08 })
    .from(faded, { opacity: 0, duration: 0.8, ease: EASE, stagger: 0.05 }, "-=0.8")
    .from(".stat", { opacity: 0, ...RISE, stagger: 0.12 }, "-=0.2");

  gsap.fromTo(
    ".hull-rotor",
    { rotateY: -12 },
    {
      rotateY: 12,
      ease: "none",
      scrollTrigger: {
        trigger: yacht,
        start: enters(yacht, 1),
        end: covered(yacht),
        scrub: 1,
      },
    }
  );

  // 06 ANYWHERE — supporting line follows the headline in at +200 ms.
  const anywhere = document.querySelector(".anywhere");
  gsap.from(".statement-anywhere", {
    opacity: 0,
    ...RISE,
    scrollTrigger: { trigger: anywhere, start: enters(anywhere, 0.6) },
  });
  gsap.from(".supporting", {
    opacity: 0,
    ...RISE,
    delay: 0.2,
    scrollTrigger: { trigger: anywhere, start: enters(anywhere, 0.6) },
  });

  // 07 THE PROMISE — proof points rise and fade in, staggered.
  const promise = document.querySelector(".promise");
  gsap.from(".proof", {
    opacity: 0,
    ...RISE,
    stagger: 0.12,
    scrollTrigger: { trigger: promise, start: enters(promise, 0.6) },
  });

  // 08 THE TURN — gentle staggered reveal of the close.
  const turn = document.querySelector(".turn");
  gsap.from(".turn > *", {
    opacity: 0,
    ...RISE,
    stagger: 0.12,
    scrollTrigger: { trigger: turn, start: enters(turn, 0.6) },
  });
}
