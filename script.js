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
  let isSettingInitialPosition = false;

  if (!track || !prevButton || !nextButton) {
    return;
  }

  const cards = Array.from(track.querySelectorAll("[data-carousel-card], .hive-price-card"));

  const getScrollAmount = () => {
    const card = cards[0];
    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;

    return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.85;
  };

  const showPhotos = () => {
    carousel.classList.add("is-browsing");
    window.clearTimeout(browseTimeout);
    browseTimeout = window.setTimeout(() => {
      carousel.classList.remove("is-browsing");
    }, 1800);
  };

  const scrollToMiddle = () => {
    if (carousel.dataset.carouselStart !== "middle" || cards.length === 0) {
      return;
    }

    const middleCard = cards[Math.floor(cards.length / 2)];
    const left = middleCard.offsetLeft - (track.clientWidth - middleCard.getBoundingClientRect().width) / 2;
    isSettingInitialPosition = true;
    track.scrollTo({ left, behavior: "auto" });
    window.setTimeout(() => {
      isSettingInitialPosition = false;
    }, 120);
  };

  requestAnimationFrame(scrollToMiddle);
  window.addEventListener("load", scrollToMiddle, { once: true });

  prevButton.addEventListener("click", () => {
    showPhotos();
    track.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
  });

  nextButton.addEventListener("click", () => {
    showPhotos();
    track.scrollBy({ left: getScrollAmount(), behavior: "smooth" });
  });

  track.addEventListener("scroll", () => {
    if (!isSettingInitialPosition) {
      showPhotos();
    }
  }, { passive: true });
});
