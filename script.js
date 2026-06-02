const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      nav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

document.querySelectorAll("[data-carousel]").forEach((carousel) => {
  const track = carousel.querySelector("[data-carousel-track]");
  const prevButton = carousel.querySelector("[data-carousel-prev]");
  const nextButton = carousel.querySelector("[data-carousel-next]");
  let browseTimeout;

  if (!track || !prevButton || !nextButton) {
    return;
  }

  const originalCards = Array.from(track.querySelectorAll("[data-carousel-card], .hive-price-card"));
  const isLooping = carousel.hasAttribute("data-carousel-loop") && originalCards.length > 1;
  const isAutoplaying = carousel.hasAttribute("data-carousel-autoplay");

  const showPhotos = () => {
    carousel.classList.add("is-browsing");
    window.clearTimeout(browseTimeout);
    browseTimeout = window.setTimeout(() => {
      carousel.classList.remove("is-browsing");
    }, 1800);
  };

  if (isLooping) {
    originalCards.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.dataset.carouselClone = "true";
      track.appendChild(clone);
    });

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const driftSpeed = 0.032;
    const buttonGlideDuration = 620;
    let offset = 0;
    let loopWidth = 0;
    let lastFrameTime = 0;
    let animationFrame = 0;
    let glideStartTime = 0;
    let glideFrom = 0;
    let glideTo = 0;

    const measureLoop = () => {
      const firstClone = track.querySelector("[data-carousel-clone]");
      loopWidth = firstClone ? firstClone.offsetLeft : track.scrollWidth / 2;
    };

    const normalizeOffset = () => {
      if (loopWidth <= 0) {
        return;
      }

      offset = ((offset % loopWidth) + loopWidth) % loopWidth;
    };

    const renderLoop = () => {
      normalizeOffset();
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    };

    const getCardAdvance = () => {
      const card = originalCards[0];
      const styles = window.getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;

      return card ? card.getBoundingClientRect().width + gap : 260;
    };

    const setupLoop = ({ resetOffset = true } = {}) => {
      measureLoop();
      if (resetOffset) {
        offset = loopWidth * 0.28;
      }
      renderLoop();
    };

    const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);

    const glideBy = (distance) => {
      if (loopWidth <= 0) {
        return;
      }

      glideStartTime = window.performance.now();
      glideFrom = offset;
      glideTo = offset + distance;
    };

    const tickLoop = (now) => {
      if (document.hidden) {
        lastFrameTime = now;
        animationFrame = window.requestAnimationFrame(tickLoop);
        return;
      }

      const elapsed = lastFrameTime === 0 ? 16.7 : Math.min(now - lastFrameTime, 48);
      lastFrameTime = now;

      if (glideStartTime > 0) {
        const progress = Math.min((now - glideStartTime) / buttonGlideDuration, 1);
        offset = glideFrom + (glideTo - glideFrom) * easeOutCubic(progress);

        if (progress === 1) {
          glideStartTime = 0;
        }
      } else if (isAutoplaying && !prefersReducedMotion) {
        offset += elapsed * driftSpeed;
      }

      renderLoop();
      animationFrame = window.requestAnimationFrame(tickLoop);
    };

    const startLoop = () => {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(tickLoop);
      }
    };

    const scheduleMeasure = () => {
      window.requestAnimationFrame(() => setupLoop({ resetOffset: false }));
    };

    setupLoop();
    requestAnimationFrame(setupLoop);
    window.setTimeout(setupLoop, 250);
    window.addEventListener("load", setupLoop, { once: true });
    window.addEventListener("resize", scheduleMeasure);

    prevButton.addEventListener("click", () => {
      showPhotos();
      glideBy(-getCardAdvance());
    });

    nextButton.addEventListener("click", () => {
      showPhotos();
      glideBy(getCardAdvance());
    });

    startLoop();

    return;
  }

  const cards = Array.from(track.querySelectorAll("[data-carousel-card], .hive-price-card"));

  const getScrollAmount = () => {
    const card = cards[0];
    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;

    return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.85;
  };

  const scrollToMiddle = () => {
    if (carousel.dataset.carouselStart !== "middle" || cards.length === 0) {
      return;
    }

    const middleCard = cards[Math.floor(cards.length / 2)];
    const left = middleCard.offsetLeft - (track.clientWidth - middleCard.getBoundingClientRect().width) / 2;
    track.scrollTo({ left, behavior: "auto" });
  };

  requestAnimationFrame(scrollToMiddle);
  window.addEventListener("load", scrollToMiddle, { once: true });
  window.addEventListener("resize", scrollToMiddle);

  prevButton.addEventListener("click", () => {
    showPhotos();
    track.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
  });

  nextButton.addEventListener("click", () => {
    showPhotos();
    track.scrollBy({ left: getScrollAmount(), behavior: "smooth" });
  });
});
