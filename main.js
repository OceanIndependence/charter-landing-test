const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

function initMedia() {
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
  document.querySelectorAll("video[data-src]").forEach((video) => loader.observe(video));

  // Play only the videos near the viewport, pause the rest. If a lazy
  // video is reached before its loader has fired, attach the source here.
  const player = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          if (!video.src && video.dataset.src) {
            video.src = video.dataset.src;
            video.removeAttribute("data-src");
            video.load();
          }
          if (video.src) video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { rootMargin: "25% 0px" }
  );
  document.querySelectorAll("video.media").forEach((video) => player.observe(video));

  // Autoplay can be blocked (battery-saver modes, data saver). The first
  // gesture is allowed to start playback, so retry the videos in view.
  const resumeVisible = () => {
    const vh = window.innerHeight;
    document.querySelectorAll("video.media").forEach((video) => {
      if (!video.src || !video.paused) return;
      const box = video.getBoundingClientRect();
      if (box.bottom > -0.25 * vh && box.top < 1.25 * vh) {
        video.play().catch(() => {});
      }
    });
  };
  ["touchstart", "scroll", "click"].forEach((type) =>
    window.addEventListener(type, resumeVisible, { once: true, passive: true })
  );

  // 06 ANYWHERE — slow 8 s scale drift, once per entry.
  const still = document.querySelector(".anywhere-image");
  const drifter = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        still.classList.add("is-drifting");
      } else {
        still.style.transition = "none";
        still.classList.remove("is-drifting");
        void still.offsetWidth;
        still.style.transition = "";
      }
    });
  });
  drifter.observe(still);
}

function initMotion() {
  gsap.registerPlugin(ScrollTrigger);

  // Closest GSAP equivalent of the global cubic-bezier(0.16, 1, 0.3, 1).
  const EASE = "expo.out";
  const RISE = { y: 12, duration: 0.48, ease: EASE };

  // 02 MORNING · 05 GOLDEN HOUR — statement pins ~80vh while the video
  // scrolls behind, then releases and fades.
  document.querySelectorAll(".pin-block").forEach((block) => {
    const section = block.closest(".section");

    gsap.from(block.children, {
      opacity: 0,
      ...RISE,
      scrollTrigger: { trigger: section, start: "top 55%" },
    });

    ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "+=80%",
      pin: block,
      pinSpacing: false,
    });

    gsap.fromTo(
      block,
      { opacity: 1 },
      {
        opacity: 0,
        ease: "none",
        immediateRender: false,
        scrollTrigger: { trigger: section, start: "top -35%", end: "top -65%", scrub: true },
      }
    );
  });

  // 03 DAY — the one faster section: the line snaps in, no fade.
  gsap.fromTo(
    ".day-block",
    { autoAlpha: 0 },
    {
      autoAlpha: 1,
      duration: 0.01,
      scrollTrigger: { trigger: ".day", start: "top 25%", toggleActions: "play none none reverse" },
    }
  );

  // 04 THE YACHT — hull draws in, stats follow with a 120 ms stagger,
  // and the whole model rotates ±12° with scroll progress.
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
    .timeline({ scrollTrigger: { trigger: ".yacht", start: "top 55%" } })
    .to(drawn, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut", stagger: 0.08 })
    .from(faded, { opacity: 0, duration: 0.8, ease: EASE, stagger: 0.05 }, "-=0.8")
    .from(".stat", { opacity: 0, ...RISE, stagger: 0.12 }, "-=0.2");

  gsap.fromTo(
    ".hull-rotor",
    { rotateY: -12 },
    {
      rotateY: 12,
      ease: "none",
      scrollTrigger: { trigger: ".yacht", start: "top bottom", end: "bottom top", scrub: 1 },
    }
  );

  // 06 ANYWHERE — supporting line follows the headline in at +200 ms.
  gsap.from(".statement-anywhere", {
    opacity: 0,
    ...RISE,
    scrollTrigger: { trigger: ".anywhere", start: "top 55%" },
  });
  gsap.from(".supporting", {
    opacity: 0,
    ...RISE,
    delay: 0.2,
    scrollTrigger: { trigger: ".anywhere", start: "top 55%" },
  });

  // 07 THE PROMISE — proof points rise and fade in, staggered.
  gsap.from(".proof", {
    opacity: 0,
    ...RISE,
    stagger: 0.12,
    scrollTrigger: { trigger: ".promise", start: "top 60%" },
  });

  // 08 THE TURN — gentle staggered reveal of the close.
  gsap.from(".turn > *", {
    opacity: 0,
    ...RISE,
    stagger: 0.12,
    scrollTrigger: { trigger: ".turn", start: "top 60%" },
  });
}
