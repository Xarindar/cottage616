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

    let offset = 0;
    let loopWidth = 0;
    let lastAutoplayTime = 0;

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

    const setupLoop = () => {
      measureLoop();
      offset = loopWidth * 0.28;
      renderLoop();
    };

    const driftLoop = () => {
      if (!isAutoplaying || loopWidth <= 0) {
        return;
      }

      const now = window.performance.now();
      const elapsed = lastAutoplayTime === 0 ? 32 : now - lastAutoplayTime;
      lastAutoplayTime = now;
      offset += elapsed * 0.035;
      renderLoop();
    };

    setupLoop();
    requestAnimationFrame(setupLoop);
    window.setTimeout(setupLoop, 250);
    window.addEventListener("load", setupLoop, { once: true });
    window.addEventListener("resize", setupLoop);

    prevButton.addEventListener("click", () => {
      showPhotos();
      offset -= getCardAdvance();
      renderLoop();
    });

    nextButton.addEventListener("click", () => {
      showPhotos();
      offset += getCardAdvance();
      renderLoop();
    });

    if (isAutoplaying) {
      window.setInterval(driftLoop, 32);
    }

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
