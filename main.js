// Lazy-load videos that carry a data-src (clips three onwards),
// one viewport ahead of arrival.
const lazyVideos = document.querySelectorAll("video[data-src]");

const loader = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const video = entry.target;
      video.src = video.dataset.src;
      video.removeAttribute("data-src");
      video.load();
      observer.unobserve(video);
    });
  },
  { rootMargin: "100% 0px" }
);

lazyVideos.forEach((video) => loader.observe(video));

// Play only the videos near the viewport, pause the rest.
const player = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        if (video.src) video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  },
  { rootMargin: "25% 0px" }
);

document.querySelectorAll(".scene-video").forEach((video) => player.observe(video));

// Scroll animations. Guarded so the videos still load and play
// if the CDN is unreachable; the copy simply stays visible.
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  // Pin each line of copy briefly while its section scrolls,
  // fading it in and out with a slow, smooth ease.
  document.querySelectorAll(".scene").forEach((scene) => {
    const copy = scene.querySelector(".scene-copy");
    const heading = scene.querySelector("h2");

    ScrollTrigger.create({
      trigger: scene,
      start: "top top",
      end: "bottom top",
      pin: copy,
      pinSpacing: false,
    });

    gsap
      .timeline({
        scrollTrigger: {
          trigger: scene,
          start: "top 80%",
          end: "bottom 20%",
          scrub: 1.2,
        },
      })
      .fromTo(
        heading,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 2, ease: "power2.inOut" }
      )
      .to(heading, { opacity: 1, duration: 1.5 })
      .to(heading, { opacity: 0, y: -28, duration: 2, ease: "power2.inOut" });
  });

  // Gentle reveal for the closing section.
  gsap.from(".finale > *", {
    opacity: 0,
    y: 24,
    duration: 1.6,
    ease: "power2.out",
    stagger: 0.2,
    scrollTrigger: {
      trigger: ".finale",
      start: "top 70%",
    },
  });
} else {
  document.querySelectorAll(".scene-copy h2").forEach((heading) => {
    heading.style.opacity = "1";
  });
}
