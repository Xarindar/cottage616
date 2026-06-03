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
    const isSteppedLoop = prevButton && nextButton && !isAutoplaying;
    const cloneCard = (card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.dataset.carouselClone = "true";
      clone.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach((focusable) => {
        focusable.setAttribute("tabindex", "-1");
      });
      return clone;
    };

    if (isSteppedLoop) {
      let stepSize = 0;
      let currentIndex = 0;
      let isMoving = false;
      let activeDirection = 0;
      let fallbackTimer = 0;
      const moveQueue = [];

      const measureStep = () => {
        const styles = window.getComputedStyle(track);
        const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
        stepSize = originalCards[0] ? originalCards[0].getBoundingClientRect().width + gap : 0;
      };

      const setTrackPosition = (step, transition = "none") => {
        track.style.transition = transition;
        track.style.transform = `translate3d(${-step * stepSize}px, 0, 0)`;

        if (transition === "none") {
          track.offsetHeight;
          track.style.transition = "";
        }
      };

      const rebuildEdgeClones = () => {
        track.querySelectorAll("[data-carousel-clone]").forEach((clone) => clone.remove());

        const previousIndex = (currentIndex - 1 + originalCards.length) % originalCards.length;
        const nextIndex = (currentIndex + 1) % originalCards.length;

        track.insertBefore(cloneCard(originalCards[previousIndex]), originalCards[0]);
        track.appendChild(cloneCard(originalCards[nextIndex]));
      };

      const resetSteppedLoop = () => {
        measureStep();
        rebuildEdgeClones();
        setTrackPosition(currentIndex + 1);
      };

      const runNextMove = () => {
        if (isMoving || moveQueue.length === 0 || stepSize <= 0) {
          return;
        }

        activeDirection = moveQueue.shift();
        isMoving = true;
        rebuildEdgeClones();

        const targetStep = activeDirection > 0
          ? currentIndex === originalCards.length - 1 ? originalCards.length + 1 : currentIndex + 2
          : currentIndex === 0 ? 0 : currentIndex;

        window.clearTimeout(fallbackTimer);
        setTrackPosition(targetStep, "transform 360ms ease");
        fallbackTimer = window.setTimeout(finishMove, 430);
      };

      function finishMove() {
        if (!isMoving) {
          return;
        }

        window.clearTimeout(fallbackTimer);
        currentIndex = (currentIndex + activeDirection + originalCards.length) % originalCards.length;
        isMoving = false;
        activeDirection = 0;
        resetSteppedLoop();
        runNextMove();
      }

      const queueMove = (direction) => {
        measureStep();
        moveQueue.push(direction);
        runNextMove();
      };

      resetSteppedLoop();
      requestAnimationFrame(resetSteppedLoop);
      window.setTimeout(resetSteppedLoop, 250);
      window.addEventListener("load", resetSteppedLoop, { once: true });
      window.addEventListener("resize", resetSteppedLoop);
      track.addEventListener("transitionend", (event) => {
        if (event.propertyName === "transform") {
          finishMove();
        }
      });

      prevButton.addEventListener("click", () => {
        showPhotos();
        queueMove(-1);
      });

      nextButton.addEventListener("click", () => {
        showPhotos();
        queueMove(1);
      });

      return;
    }

    originalCards.forEach((card) => {
      track.appendChild(cloneCard(card));
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
  const realCardCount = cards.length;
  let firstRealIndex = 0;
  let lastRealIndex = cards.length - 1;
  let snapTimeout = 0;
  let isProgrammaticScroll = false;

  if (shouldVisuallyWrap && cards.length > 1) {
    const beforeClones = document.createDocumentFragment();
    const afterClones = document.createDocumentFragment();

    cards.forEach((card) => {
      const beforeClone = card.cloneNode(true);
      const afterClone = card.cloneNode(true);

      [beforeClone, afterClone].forEach((clone) => {
        clone.setAttribute("aria-hidden", "true");
        clone.dataset.carouselClone = "true";
        clone.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach((focusable) => {
          focusable.setAttribute("tabindex", "-1");
        });
      });

      beforeClones.appendChild(beforeClone);
      afterClones.appendChild(afterClone);
    });

    track.insertBefore(beforeClones, cards[0]);
    track.appendChild(afterClones);

    cards = Array.from(track.querySelectorAll("[data-carousel-card], .hive-price-card"));
    firstRealIndex = realCardCount;
    lastRealIndex = (realCardCount * 2) - 1;
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

  const getNormalizedRealIndex = (index) => {
    if (!shouldVisuallyWrap || realCardCount === 0) {
      return index;
    }

    const realOffset = ((index - firstRealIndex) % realCardCount + realCardCount) % realCardCount;
    return firstRealIndex + realOffset;
  };

  const jumpToCard = (index) => {
    const card = cards[index];

    if (!card) {
      return;
    }

    track.scrollTo({ left: getCardLeft(card), behavior: "auto" });
  };

  const getNextVisualIndex = (direction) => {
    if (!shouldVisuallyWrap || realCardCount === 0) {
      return getCurrentCardIndex() + direction;
    }

    const currentRealIndex = getNormalizedRealIndex(getCurrentCardIndex());

    if (direction > 0 && currentRealIndex === lastRealIndex) {
      return lastRealIndex + 1;
    }

    if (direction < 0 && currentRealIndex === firstRealIndex) {
      return firstRealIndex - 1;
    }

    return currentRealIndex + direction;
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
    const normalizedIndex = getNormalizedRealIndex(currentIndex);

    if (normalizedIndex !== currentIndex) {
      jumpToCard(normalizedIndex);
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
      scrollToCard(getNextVisualIndex(-1));
      return;
    }

    track.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
  });

  nextButton.addEventListener("click", () => {
    showPhotos();
    if (shouldSnapToCards) {
      scrollToCard(getNextVisualIndex(1));
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
