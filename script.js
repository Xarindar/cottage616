const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const siteHeader = document.querySelector(".site-header");

if (siteHeader) {
  const updateHeaderState = () => {
    siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  updateHeaderState();
  window.addEventListener("scroll", updateHeaderState, { passive: true });
}

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

  if (!track) {
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
    let offset = 0;
    let loopWidth = 0;
    let lastFrameTime = 0;
    let animationFrame = 0;

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

    const setupLoop = ({ resetOffset = true } = {}) => {
      measureLoop();
      if (resetOffset) {
        offset = loopWidth * 0.28;
      }
      renderLoop();
    };

    const tickLoop = (now) => {
      if (document.hidden) {
        lastFrameTime = now;
        animationFrame = window.requestAnimationFrame(tickLoop);
        return;
      }

      const elapsed = lastFrameTime === 0 ? 16.7 : Math.min(now - lastFrameTime, 48);
      lastFrameTime = now;

      if (isAutoplaying && !prefersReducedMotion) {
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

    startLoop();

    return;
  }

  if (!prevButton || !nextButton) {
    return;
  }

  const shouldSnapToCards = carousel.hasAttribute("data-carousel-snap");
  const shouldWrapCards = carousel.hasAttribute("data-carousel-wrap");
  const shouldVisuallyWrap = shouldSnapToCards && shouldWrapCards;
  let cards = Array.from(track.querySelectorAll("[data-carousel-card], .hive-price-card"));
  let firstRealIndex = 0;
  let lastRealIndex = cards.length - 1;
  let snapTimeout = 0;
  let isProgrammaticScroll = false;

  if (shouldVisuallyWrap && cards.length > 1) {
    const firstClone = cards[0].cloneNode(true);
    const lastClone = cards[cards.length - 1].cloneNode(true);

    firstClone.setAttribute("aria-hidden", "true");
    firstClone.dataset.carouselClone = "first";
    lastClone.setAttribute("aria-hidden", "true");
    lastClone.dataset.carouselClone = "last";
    track.insertBefore(lastClone, cards[0]);
    track.appendChild(firstClone);

    cards = Array.from(track.querySelectorAll("[data-carousel-card], .hive-price-card"));
    firstRealIndex = 1;
    lastRealIndex = cards.length - 2;
  }

  const getScrollAmount = () => {
    const card = cards[0];
    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;

    return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.85;
  };

  const getCardLeft = (card) => {
    const trackBox = track.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const cardOffset = cardBox.left - trackBox.left + track.scrollLeft;

    return cardOffset - (track.clientWidth - cardBox.width) / 2;
  };

  const getCurrentCardIndex = () => {
    if (cards.length === 0) {
      return 0;
    }

    return cards.reduce((closestIndex, card, index) => {
      const closestDistance = Math.abs(getCardLeft(cards[closestIndex]) - track.scrollLeft);
      const distance = Math.abs(getCardLeft(card) - track.scrollLeft);

      return distance < closestDistance ? index : closestIndex;
    }, 0);
  };

  const scrollToCard = (index, behavior = "smooth") => {
    const nextIndex = shouldWrapCards && !shouldVisuallyWrap && cards.length > 0
      ? ((index % cards.length) + cards.length) % cards.length
      : Math.min(Math.max(index, 0), cards.length - 1);
    const card = cards[nextIndex];

    if (!card) {
      return;
    }

    isProgrammaticScroll = true;
    track.scrollTo({ left: getCardLeft(card), behavior });
    window.setTimeout(() => {
      isProgrammaticScroll = false;
      normalizeVisualWrap();
    }, behavior === "smooth" ? 620 : 0);
  };

  const normalizeVisualWrap = () => {
    if (!shouldVisuallyWrap || cards.length < 3) {
      return;
    }

    const currentIndex = getCurrentCardIndex();

    if (currentIndex === 0) {
      scrollToCard(lastRealIndex, "auto");
    } else if (currentIndex === cards.length - 1) {
      scrollToCard(firstRealIndex, "auto");
    }
  };

  const snapToNearestCard = () => {
    if (!shouldSnapToCards || isProgrammaticScroll || cards.length === 0) {
      return;
    }

    scrollToCard(getCurrentCardIndex());
  };

  const scrollToMiddle = () => {
    if (carousel.dataset.carouselStart !== "middle" || cards.length === 0) {
      if (shouldVisuallyWrap) {
        scrollToCard(firstRealIndex, "auto");
      }
      return;
    }

    const middleCard = cards[Math.floor(cards.length / 2)];
    const left = shouldSnapToCards
      ? getCardLeft(middleCard)
      : middleCard.offsetLeft - (track.clientWidth - middleCard.getBoundingClientRect().width) / 2;
    track.scrollTo({ left, behavior: "auto" });
  };

  requestAnimationFrame(scrollToMiddle);
  window.addEventListener("load", scrollToMiddle, { once: true });
  window.addEventListener("resize", scrollToMiddle);

  prevButton.addEventListener("click", () => {
    showPhotos();
    if (shouldSnapToCards) {
      scrollToCard(getCurrentCardIndex() - 1);
      return;
    }

    track.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
  });

  nextButton.addEventListener("click", () => {
    showPhotos();
    if (shouldSnapToCards) {
      scrollToCard(getCurrentCardIndex() + 1);
      return;
    }

    track.scrollBy({ left: getScrollAmount(), behavior: "smooth" });
  });

  if (shouldSnapToCards) {
    track.addEventListener("scroll", () => {
      window.clearTimeout(snapTimeout);
      snapTimeout = window.setTimeout(() => {
        snapToNearestCard();
        window.setTimeout(normalizeVisualWrap, 680);
      }, 150);
    }, { passive: true });
  }
});
