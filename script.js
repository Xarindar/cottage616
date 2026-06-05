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

const pricingSection = document.querySelector(".hive-pricing");
const pricingCards = document.querySelector(".hive-pricing-grid");
const canUsePricingMagnet = window.matchMedia("(min-width: 721px) and (pointer: fine)").matches;

if (pricingSection && pricingCards && canUsePricingMagnet && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let lastScrollY = window.scrollY;
  let magnetTimeout = 0;
  let lastMagnetTime = 0;
  let isMagnetScrolling = false;

  const getPricingCardBox = () => {
    const visibleCard = Array.from(pricingCards.querySelectorAll(".hive-price-card")).find((card) => {
      const box = card.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.right > 0 && box.left < window.innerWidth;
    });

    return visibleCard ? visibleCard.getBoundingClientRect() : pricingCards.getBoundingClientRect();
  };

  const getCenteredCardScrollTop = () => {
    const cardBox = getPricingCardBox();
    const headerHeight = siteHeader ? siteHeader.getBoundingClientRect().height : 0;
    const availableHeight = window.innerHeight - headerHeight;
    return window.scrollY + cardBox.top - headerHeight - ((availableHeight - cardBox.height) / 2);
  };

  const maybeCenterPricingCards = () => {
    if (isMagnetScrolling || Date.now() - lastMagnetTime < 1800) {
      return;
    }

    const sectionBox = pricingSection.getBoundingClientRect();
    const cardBox = getPricingCardBox();
    const headerHeight = siteHeader ? siteHeader.getBoundingClientRect().height : 0;
    const scrollingDown = window.scrollY > lastScrollY;
    const cardCenter = cardBox.top + (cardBox.height / 2);
    const viewportCenter = headerHeight + ((window.innerHeight - headerHeight) / 2);
    const cardCenterDistance = Math.abs(cardCenter - viewportCenter);
    const sectionMostlyEntered = sectionBox.top < window.innerHeight * 0.28 && sectionBox.bottom > window.innerHeight * 0.76;
    const cardsCloseEnough = cardBox.top < window.innerHeight * 0.46 && cardBox.bottom > window.innerHeight * 0.58;

    lastScrollY = window.scrollY;

    if (!scrollingDown || !sectionMostlyEntered || !cardsCloseEnough || cardCenterDistance < 38) {
      return;
    }

    isMagnetScrolling = true;
    lastMagnetTime = Date.now();
    window.scrollTo({
      top: getCenteredCardScrollTop(),
      behavior: "smooth",
    });
    window.setTimeout(() => {
      isMagnetScrolling = false;
    }, 650);
  };

  window.addEventListener("scroll", () => {
    window.clearTimeout(magnetTimeout);
    magnetTimeout = window.setTimeout(maybeCenterPricingCards, 90);
  }, { passive: true });
}

const prepareCarouselMedia = (root) => {
  root.querySelectorAll("img").forEach((image) => {
    image.loading = "eager";
    image.decoding = "sync";
    image.fetchPriority = image.fetchPriority || "low";

    if (typeof image.decode === "function" && !image.complete) {
      image.decode().catch(() => {});
    }
  });
};

const cloneCarouselCard = (card) => {
  const clone = card.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  clone.dataset.carouselClone = "true";
  clone.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach((focusable) => {
    focusable.setAttribute("tabindex", "-1");
  });
  prepareCarouselMedia(clone);
  return clone;
};

document.querySelectorAll("[data-carousel]").forEach((carousel) => {
  const track = carousel.querySelector("[data-carousel-track]");
  const prevButton = carousel.querySelector("[data-carousel-prev]");
  const nextButton = carousel.querySelector("[data-carousel-next]");
  const progress = carousel.parentElement?.querySelector("[data-carousel-progress]");
  let browseTimeout;

  if (!track) {
    return;
  }

  const originalCards = Array.from(track.querySelectorAll("[data-carousel-card], .hive-price-card"));
  const isLooping = carousel.hasAttribute("data-carousel-loop") && originalCards.length > 1;
  const isAutoplaying = carousel.hasAttribute("data-carousel-autoplay");

  prepareCarouselMedia(track);

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
      return cloneCarouselCard(card);
    };

    if (isSteppedLoop) {
      const cardCount = originalCards.length;
      const beforeClones = document.createDocumentFragment();
      const afterClones = document.createDocumentFragment();
      originalCards.forEach((card) => {
        beforeClones.appendChild(cloneCard(card));
        afterClones.appendChild(cloneCard(card));
      });
      track.insertBefore(beforeClones, originalCards[0]);
      track.appendChild(afterClones);

      const loopCards = Array.from(track.querySelectorAll("[data-carousel-card], .hive-price-card"));
      let stepSize = 0;
      let activeSlot = cardCount;
      let isAnimating = false;
      let fallbackTimer = 0;
      let dragStartX = 0;
      let dragStartY = 0;
      let dragDeltaX = 0;
      let dragPointerId = null;
      let isDragging = false;
      let hasHorizontalDrag = false;
      let hasInteracted = false;
      let hintTimer = 0;
      let hintReturnTimer = 0;
      let hasPlayedHint = false;
      const moveQueue = [];
      const progressButtons = [];

      const getRealIndex = () => {
        return ((activeSlot - cardCount) % cardCount + cardCount) % cardCount;
      };

      const updateProgress = () => {
        progressButtons.forEach((button, index) => {
          button.setAttribute("aria-current", String(index === getRealIndex()));
        });
      };

      if (progress) {
        progress.textContent = "";
        originalCards.forEach((card, index) => {
          const button = document.createElement("button");
          const title = card.querySelector(".hive-price-card__hero h3")?.textContent?.trim();
          const duration = card.querySelector(".hive-price-card__duration")?.textContent?.trim();
          const price = card.querySelector(".hive-price-card__cost")?.textContent?.trim();
          button.type = "button";
          button.setAttribute("aria-label", `Show ${[title, duration, price].filter(Boolean).join(", ")}`);
          button.addEventListener("click", () => {
            hasInteracted = true;
            window.clearTimeout(hintTimer);
            window.clearTimeout(hintReturnTimer);
            carousel.classList.remove("is-swipe-hinting");
            measureStep();

            if (stepSize <= 0) {
              return;
            }

            const currentIndex = getRealIndex();
            let distance = index - currentIndex;

            if (distance > cardCount / 2) {
              distance -= cardCount;
            } else if (distance < -cardCount / 2) {
              distance += cardCount;
            }

            if (distance === 0) {
              return;
            }

            moveQueue.length = 0;
            moveQueue.push(distance);
            runNextMove();
          });
          progress.appendChild(button);
          progressButtons.push(button);
        });
      }

      const measureStep = () => {
        const styles = window.getComputedStyle(track);
        const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
        stepSize = loopCards[0] ? loopCards[0].getBoundingClientRect().width + gap : 0;
      };

      const setTrackPosition = (step, transition = "none", dragOffset = 0) => {
        track.style.transition = transition;
        track.style.transform = `translate3d(${-step * stepSize + dragOffset}px, 0, 0)`;

        if (transition === "none") {
          track.offsetHeight;
          track.style.transition = "";
        }
      };

      const resetSteppedLoop = () => {
        measureStep();
        setTrackPosition(activeSlot);
      };

      const normalizeLoopSlot = () => {
        if (activeSlot < cardCount) {
          activeSlot += cardCount;
        } else if (activeSlot >= cardCount * 2) {
          activeSlot -= cardCount;
        }

        setTrackPosition(activeSlot);
        updateProgress();
      };

      const runNextMove = () => {
        if (isAnimating || moveQueue.length === 0 || stepSize <= 0) {
          return;
        }

        activeSlot += moveQueue.shift();
        isAnimating = true;
        window.clearTimeout(fallbackTimer);
        setTrackPosition(activeSlot, "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)");
        fallbackTimer = window.setTimeout(finishMove, 520);
      };

      function finishMove() {
        if (!isAnimating) {
          return;
        }

        window.clearTimeout(fallbackTimer);
        isAnimating = false;
        normalizeLoopSlot();
        runNextMove();
      }

      const queueMove = (direction) => {
        hasInteracted = true;
        window.clearTimeout(hintTimer);
        window.clearTimeout(hintReturnTimer);
        carousel.classList.remove("is-swipe-hinting");
        measureStep();
        moveQueue.push(direction);
        runNextMove();
      };

      const playSwipeHint = () => {
        if (
          hasPlayedHint ||
          hasInteracted ||
          isAnimating ||
          isDragging ||
          stepSize <= 0 ||
          !window.matchMedia("(max-width: 720px)").matches ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          return;
        }

        hasPlayedHint = true;
        const hintDistance = Math.min(28, stepSize * 0.08);
        carousel.classList.add("is-swipe-hinting");
        track.style.transition = "transform 520ms ease";
        track.style.transform = `translate3d(${-activeSlot * stepSize - hintDistance}px, 0, 0)`;
        hintReturnTimer = window.setTimeout(() => {
          if (hasInteracted || isAnimating || isDragging) {
            return;
          }

          setTrackPosition(activeSlot, "transform 520ms ease");
          window.setTimeout(() => {
            carousel.classList.remove("is-swipe-hinting");
          }, 560);
        }, 560);
      };

      const endDrag = () => {
        if (!isDragging) {
          return;
        }

        const threshold = Math.min(92, Math.max(44, stepSize * 0.18));
        isDragging = false;
        dragPointerId = null;
        carousel.classList.remove("is-dragging");

        if (hasHorizontalDrag && Math.abs(dragDeltaX) > threshold) {
          queueMove(dragDeltaX < 0 ? 1 : -1);
          return;
        }

        isAnimating = true;
        window.clearTimeout(fallbackTimer);
        setTrackPosition(activeSlot, "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)");
        fallbackTimer = window.setTimeout(finishMove, 320);
      };

      track.addEventListener("pointerdown", (event) => {
        if (isAnimating || event.target.closest("a, button")) {
          return;
        }

        hasInteracted = true;
        window.clearTimeout(hintTimer);
        window.clearTimeout(hintReturnTimer);
        carousel.classList.remove("is-swipe-hinting");
        measureStep();
        isDragging = true;
        hasHorizontalDrag = false;
        dragPointerId = event.pointerId;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        dragDeltaX = 0;
        track.setPointerCapture(event.pointerId);
        carousel.classList.add("is-dragging");
      });

      track.addEventListener("pointermove", (event) => {
        if (!isDragging || event.pointerId !== dragPointerId || stepSize <= 0) {
          return;
        }

        const deltaX = event.clientX - dragStartX;
        const deltaY = event.clientY - dragStartY;

        if (!hasHorizontalDrag && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
          endDrag();
          return;
        }

        if (Math.abs(deltaX) > 8) {
          hasHorizontalDrag = true;
        }

        if (!hasHorizontalDrag) {
          return;
        }

        event.preventDefault();
        dragDeltaX = Math.max(Math.min(deltaX, stepSize * 0.58), -stepSize * 0.58);
        setTrackPosition(activeSlot, "none", dragDeltaX);
      });

      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);

      resetSteppedLoop();
      updateProgress();
      requestAnimationFrame(resetSteppedLoop);
      window.setTimeout(resetSteppedLoop, 250);
      window.addEventListener("load", resetSteppedLoop, { once: true });
      window.addEventListener("resize", resetSteppedLoop);
      if ("IntersectionObserver" in window) {
        const hintObserver = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            window.clearTimeout(hintTimer);
            hintTimer = window.setTimeout(playSwipeHint, 520);
            hintObserver.disconnect();
          }
        }, {
          threshold: 0.42,
        });

        hintObserver.observe(carousel);
      } else {
        hintTimer = window.setTimeout(playSwipeHint, 950);
      }
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
  let scrollEndTimeout = 0;
  let isProgrammaticScroll = false;

  if (shouldVisuallyWrap && cards.length > 1) {
    const beforeClones = document.createDocumentFragment();
    const afterClones = document.createDocumentFragment();

    cards.forEach((card) => {
      const beforeClone = cloneCarouselCard(card);
      const afterClone = cloneCarouselCard(card);

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

  scrollToMiddle();
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

  if (shouldVisuallyWrap) {
    const settleScroll = () => {
      if (!isProgrammaticScroll) {
        normalizeVisualWrap();
      }
    };

    if ("onscrollend" in track) {
      track.addEventListener("scrollend", settleScroll);
    } else {
      track.addEventListener("scroll", () => {
        window.clearTimeout(scrollEndTimeout);
        scrollEndTimeout = window.setTimeout(settleScroll, 140);
      }, { passive: true });
    }
  }
});
