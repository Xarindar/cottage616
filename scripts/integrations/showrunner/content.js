(function () {
  const api = {
    baseUrl: "https://showrunner-beta-production.up.railway.app/api/public/v1",
    publishableKey: "pk_live_ByKzPoI9HTbxIEIidXD68GhgIyQjQaT8"
  };

  const GRID_COLUMNS = 30;
  const GRID_ROWS = 18;

  const root = document.querySelector("[data-showrunner-profile]");
  const profile = root?.dataset.showrunnerProfile || (document.body.classList.contains("hive-page") ? "the-hive" : "cottage616");
  const pageId = document.body.classList.contains("vendors-page") || /(?:^|\/)vendors\.html$/i.test(location.pathname)
    ? "vendors"
    : document.body.classList.contains("hive-page") || /(?:^|\/)the-hive\.html$/i.test(location.pathname)
      ? "hive"
      : /(?:^|\/)booking\.html$/i.test(location.pathname)
        ? "booking"
        : "home";
  let slideshowTimer = null;
  let originalTestimonials = [];

  if (root) root.classList.add("sr-content-loading");

  const contentReady = Promise.allSettled([
    root ? loadProfile() : Promise.resolve(null),
    loadStudio(pageId)
  ]).then(([profileResult, studioResult]) => {
    if (profileResult.status === "fulfilled" && profileResult.value) {
      const content = profileResult.value;
      originalTestimonials = content?.testimonials?.items || [];
      applyHeader(content?.header || {});
      const canvasRendered = applyCanvasHero(content?.hero || null);
      if (!canvasRendered) root?.classList.add("sr-canvas-unavailable");
      applyTestimonials(content?.testimonials || {});
    } else if (profileResult.status === "rejected") {
      root?.classList.add("sr-canvas-unavailable");
      if (window.console?.warn) window.console.warn("Showrunner profile content could not load.", profileResult.reason);
    }

    if (studioResult.status === "fulfilled") {
      applyStudio(studioResult.value);
      window.dispatchEvent(new CustomEvent("showrunner:content", { detail: studioResult.value }));
    } else if (window.console?.warn) {
      window.console.warn("Showrunner studio content could not load.", studioResult.reason);
    }
    root?.classList.remove("sr-content-loading");
  });

  // The carousel initializer waits for this promise so its loop clones are
  // built from the final Showrunner image list rather than stale static cards.
  window.cottageShowrunnerContentReady = contentReady;
  window.showrunnerContentReady = contentReady;
  window.addEventListener("showrunner:render", event => applyStudio(event.detail));

  async function loadProfile() {
    const url = new URL(`${api.baseUrl.replace(/\/$/, "")}/content/profile`);
    url.searchParams.set("profile", profile);
    const response = await fetch(url.toString(), {
      headers: {
        "X-Showrunner-Key": api.publishableKey
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Content request failed.");
    return payload.data || payload;
  }

  async function loadStudio(page) {
    const url = new URL(`${api.baseUrl.replace(/\/$/, "")}/content/studio`);
    url.searchParams.set("page", page);
    const response = await fetch(url.toString(), {
      headers: {
        "X-Showrunner-Key": api.publishableKey
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Studio content request failed.");
    return payload.data || payload;
  }

  // Text-only fallback: keeps the static hero copy in sync even when the
  // canvas render is unavailable or fails.
  function applyHeader(header) {
    setText("[data-content-header-eyebrow]", header.eyebrow);
    setText("[data-content-header-headline]", header.headline);
    setText("[data-content-header-copy]", header.copy);

    const cta = document.querySelector("[data-content-header-cta]");
    if (cta) {
      if (header.ctaLabel) cta.textContent = header.ctaLabel;
      if (header.ctaHref) cta.setAttribute("href", normalizeHref(header.ctaHref));
    }
  }

  // Graphic hero: renders the Showrunner canvas layout (background image plus
  // positioned headline/caption/CTA layers) over the hero section. The static
  // markup stays in the document as the fallback and is hidden only after the
  // canvas builds successfully.
  function applyCanvasHero(hero) {
    if (!hero || typeof hero !== "object") return false;

    try {
      const screens =
        hero.slideshow && Array.isArray(hero.slideshow.screens) && hero.slideshow.screens.length > 1
          ? hero.slideshow.screens
          : hero.hero
            ? [hero.hero]
            : [];
      const renderable = screens.filter((screen) => screenHasContent(screen));
      if (!renderable.length) return false;

      const container = document.createElement("div");
      container.className = "sr-hero-screens";
      renderable.forEach((screen, index) => {
        container.appendChild(buildScreen(screen, index === 0));
      });

      root.querySelector(".sr-hero-screens")?.remove();
      root.querySelector(".sr-hero-nav")?.remove();
      root.appendChild(container);
      root.classList.add("sr-canvas-active");
      root.classList.remove("sr-canvas-unavailable");

      if (slideshowTimer) window.clearInterval(slideshowTimer);
      slideshowTimer = null;
      if (renderable.length > 1) {
        const interval = Math.max(2500, Number(hero.slideshow?.autoplayIntervalMs) || 6500);
        const nodes = Array.from(container.querySelectorAll(".sr-hero-screen"));
        let active = 0;
        let slideNav = null;

        const setActiveSlide = (index) => {
          if (!nodes.length) return;
          active = (index + nodes.length) % nodes.length;
          nodes.forEach((node, index) => node.classList.toggle("is-active", index === active));
          slideNav?.setActive(active);
        };

        const startAutoplay = () => {
          if (slideshowTimer) window.clearInterval(slideshowTimer);
          slideshowTimer = window.setInterval(() => setActiveSlide(active + 1), interval);
        };

        slideNav = buildSlideNav({
          onSelect: (index) => {
            setActiveSlide(index);
            startAutoplay();
          },
          slideCount: nodes.length
        });
        root.appendChild(slideNav.element);
        slideNav.setActive(active);
        startAutoplay();
      }
      return true;
    } catch (error) {
      root.classList.remove("sr-canvas-active");
      root.querySelector(".sr-hero-nav")?.remove();
      if (window.console?.warn) window.console.warn("Showrunner hero canvas could not render.", error);
      return false;
    }
  }

  function buildSlideNav({ onSelect, slideCount }) {
    const nav = document.createElement("nav");
    nav.className = "sr-hero-nav";
    nav.setAttribute("aria-label", "Choose hero image");

    const dots = Array.from({ length: slideCount }, (_, index) => {
      const dot = document.createElement("button");
      dot.className = "sr-hero-nav-dot";
      dot.type = "button";
      dot.setAttribute("aria-label", `Show hero image ${index + 1} of ${slideCount}`);
      dot.addEventListener("click", () => onSelect(index));
      nav.appendChild(dot);
      return dot;
    });

    return {
      element: nav,
      setActive(index) {
        dots.forEach((dot, dotIndex) => {
          if (dotIndex === index) dot.setAttribute("aria-current", "true");
          else dot.removeAttribute("aria-current");
        });
      }
    };
  }

  // A screen is only canvas-renderable once a real hero image is chosen in
  // the studio. The /hero.svg placeholder means "not configured yet", so the
  // page keeps its static hero photo and the text-only updates instead.
  function screenHasContent(screen) {
    if (!screen || typeof screen !== "object") return false;
    const background = Array.isArray(screen.backgrounds) ? screen.backgrounds.find((entry) => entry?.url) : null;
    if (!background) return false;
    if (/\/hero\.svg(\?|#|$)/i.test(String(background.url))) return false;
    return true;
  }

  function buildScreen(screen, isActive) {
    const node = document.createElement("div");
    node.className = "sr-hero-screen" + (isActive ? " is-active" : "");

    const background = (screen.backgrounds || []).find((entry) => entry?.url);
    if (background) {
      const backdrop = document.createElement("div");
      backdrop.className = "sr-hero-bg";
      backdrop.style.backgroundImage = `url("${String(background.url).replace(/"/g, "%22")}")`;
      if (background.altText) {
        backdrop.setAttribute("role", "img");
        backdrop.setAttribute("aria-label", background.altText);
      }
      node.appendChild(backdrop);
    }

    const layerHost = document.createElement("div");
    layerHost.className = "sr-hero-layers";
    (screen.canvasLayers || []).forEach((layer) => {
      const element = buildLayer(layer);
      if (element) layerHost.appendChild(element);
    });
    node.appendChild(layerHost);

    return node;
  }

  function buildLayer(layer) {
    if (!layer || typeof layer !== "object") return null;

    let element = null;
    if (layer.type === "text" && layer.role === "headline") {
      element = document.createElement("h1");
      element.className = "sr-hero-layer sr-hero-headline";
      element.textContent = layer.content || "";
    } else if (layer.type === "text") {
      element = document.createElement("p");
      element.className = "sr-hero-layer sr-hero-caption hero-text";
      element.textContent = layer.content || "";
    } else if (layer.type === "button") {
      element = document.createElement("a");
      element.className = "sr-hero-layer sr-hero-cta button button--primary";
      element.textContent = layer.content || "Book now";
      element.setAttribute("href", normalizeHref(layer.link || "booking.html"));
    }

    if (!element || !String(element.textContent || "").trim()) return null;

    const layout = layer.layout || {};
    const colStart = clampNumber(layout.colStart, 1, GRID_COLUMNS);
    const colEnd = clampNumber(layout.colEnd, colStart + 1, GRID_COLUMNS + 1);
    const rowStart = clampNumber(layout.rowStart, 1, GRID_ROWS);
    // Text wraps at its editor footprint width so the live layout matches the
    // studio preview; buttons keep their natural width up to the image edge.
    const spanWidth = ((colEnd - colStart) / GRID_COLUMNS) * 100;
    const remainingWidth = ((GRID_COLUMNS - colStart + 1) / GRID_COLUMNS) * 100;
    element.style.left = `${(((colStart - 1) / GRID_COLUMNS) * 100).toFixed(3)}%`;
    element.style.top = `${(((rowStart - 1) / GRID_ROWS) * 100).toFixed(3)}%`;
    element.style.maxWidth = `${(layer.type === "button" ? remainingWidth : spanWidth).toFixed(3)}%`;

    return element;
  }

  // Showrunner normalizes relative links ("booking.html") to "/booking.html";
  // both resolve to the same page on this static site.
  function normalizeHref(value) {
    const href = String(value || "").trim();
    if (!href) return `booking.html?profile=${encodeURIComponent(profile)}`;
    if (/(^|\/)booking\.html(?:[?#]|$)/i.test(href) && !/[?&]profile=/i.test(href)) {
      const hashIndex = href.indexOf("#");
      const path = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
      const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
      const separator = path.includes("?") ? "&" : "?";
      return `${path}${separator}profile=${encodeURIComponent(profile)}${hash}`;
    }
    return href;
  }

  function clampNumber(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.max(min, Math.min(max, Math.round(parsed)));
  }

  function applyStudio(content) {
    const blocks = Array.isArray(content?.blocks) ? content.blocks : [];
    blocks.forEach((block) => {
      if (block?.id === "home-events") applyEventsPanel(block.payload || {});
      if (block?.id === "home-venue-gallery") applyVenueGallery(block.payload || {});
      if (block?.id === "vendors-directory") applyVendorDirectory(block.payload || {});
      if (block?.type === "testimonials") {
        const payload = block.payload || {};
        const section = document.querySelector("[data-showrunner-testimonials]");
        if (section) section.hidden = !payload.items?.length;
        applyTestimonials({ heading: payload.heading, intro: payload.copy, items: (payload.items || []).map(item => ({ ...originalTestimonials.find(original => original.id === item.id), authorName: item.author, authorRole: item.role, quote: item.quote })) });
      }
    });
  }

  function applyEventsPanel(panel) {
    const section = document.querySelector("#events.event-showcase");
    if (!section) return;

    const featureImage = section.querySelector(".event-showcase__feature img");
    if (featureImage && panel.imageUrl) featureImage.src = String(panel.imageUrl);
    if (featureImage && panel.imageAlt) featureImage.alt = String(panel.imageAlt);
    setText("#events .event-showcase__header h2", panel.heading);
    setText("#events .event-showcase__intro", panel.copy);

    const list = section.querySelector(".event-card-grid");
    const items = Array.isArray(panel.items) ? panel.items.slice(0, 3) : [];
    if (!list || !items.length) return;
    list.innerHTML = items.map((item) => `
      <article class="service-card event-card">
        <div class="service-media event-card__media">
          ${item.imageUrl ? `<img class="event-card__image" src="${escapeAttribute(item.imageUrl)}" loading="lazy" decoding="async" alt="${escapeAttribute(item.name || "Cottage 616 event")}">` : ""}
        </div>
        <div class="event-card__body">
          <h3>${escapeHtml(item.name || "Event")}</h3>
          <p>${escapeHtml(item.description || "")}</p>
          <a class="event-card__button button button--secondary button--small" href="booking.html?profile=cottage616" aria-label="Book ${escapeAttribute(item.name || "this event")}">Book now</a>
        </div>
      </article>
    `).join("");
  }

  function applyVenueGallery(gallery) {
    const track = document.querySelector(".venue-strip [data-carousel-track]");
    const images = Array.isArray(gallery.images) ? gallery.images : [];
    if (!track) return;

    track.innerHTML = images.map((image) => `
      <figure class="venue-strip__image" data-carousel-card>
        <img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.alt || "Cottage 616 event inspiration")}">
      </figure>
    `).join("");
    track.dispatchEvent(new Event("carousel:content"));

    const heading = String(gallery.heading || "").trim();
    const copy = document.querySelector(".venue-strip__copy");
    if (copy && heading) {
      const parts = heading.split(/,\s*/);
      const first = copy.querySelector("span:first-child");
      const second = copy.querySelector("span:last-child");
      if (first) first.textContent = parts[0];
      if (second) second.textContent = parts.slice(1).join(", ") || "";
    }
  }

  function applyVendorDirectory(directory) {
    const list = document.querySelector("[data-content-vendor-list]");
    const items = Array.isArray(directory.items) ? directory.items : [];
    if (!list || !items.length) return;

    setText("[data-content-vendor-heading]", directory.heading);
    setText("[data-content-vendor-copy]", directory.copy);
    list.innerHTML = items.map((vendor, index) => vendorCard(vendor, index)).join("");
  }

  function vendorCard(vendor, index) {
    const targetId = `showrunner-vendor-${index + 1}`;
    const name = vendor.name || "Vendor";
    const contacts = [
      contactLink(vendor.phone, displayPhone(vendor.phone)),
      contactLink(vendor.secondaryPhone, displayPhone(vendor.secondaryPhone)),
      contactLink(vendor.email, displayEmail(vendor.email)),
      contactLink(vendor.website, "Website"),
      contactLink(vendor.facebook, "Facebook"),
      contactLink(vendor.addressUrl, "Directions")
    ].filter(Boolean).join("");
    return `
      <article class="vendor-entry">
        <figure class="vendor-entry__image">${vendor.imageUrl ? `<img src="${escapeAttribute(vendor.imageUrl)}" alt="${escapeAttribute(vendor.imageAlt || name)}">` : ""}</figure>
        <div class="vendor-entry__body">
          ${vendor.category ? `<p class="eyebrow">${escapeHtml(vendor.category)}</p>` : ""}
          <h3>${escapeHtml(name)}</h3>
          ${vendor.offer ? `<p class="vendor-entry__offer">${escapeHtml(vendor.offer)}</p>` : ""}
          ${vendor.description ? `<p>${escapeHtml(vendor.description)}</p>` : ""}
          ${contacts ? `<button class="vendor-entry__link button button--secondary button--small" type="button" data-contact-modal="${escapeAttribute(name)}" data-contact-target="${targetId}">${escapeHtml(vendor.ctaLabel || "Get in touch")} <span aria-hidden="true">→</span></button>` : ""}
          <div id="${targetId}" class="vendor-contact-data" hidden>${contacts}</div>
        </div>
      </article>
    `;
  }

  function contactLink(href, label) {
    if (!href || !label) return "";
    return `<a class="button button--secondary" href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
  }

  function displayPhone(value) {
    const digits = String(value || "").replace(/^tel:/i, "").replace(/\D/g, "");
    const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : String(value || "").replace(/^tel:/i, "");
  }

  function displayEmail(value) {
    return String(value || "").replace(/^mailto:/i, "");
  }

  function applyTestimonials(testimonials) {
    const section = document.querySelector("[data-showrunner-testimonials]");
    const list = document.querySelector("[data-content-testimonial-list]");
    const items = Array.isArray(testimonials.items) ? testimonials.items : [];
    if (!section || !list || !items.length) return;

    setText("[data-content-testimonial-heading]", testimonials.heading);
    setText("[data-content-testimonial-intro]", testimonials.intro);
    list.innerHTML = items.map(testimonialCard).join("");
    section.hidden = false;
  }

  function testimonialCard(testimonial) {
    const name = testimonial.authorName || "Guest";
    const numericRating = Number(testimonial.rating || 5);
    const rating = Number.isFinite(numericRating) ? Math.max(1, Math.min(5, numericRating)) : 5;
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
    const image = testimonial.imageUrl
      ? `<img src="${escapeAttribute(testimonial.imageUrl)}" alt="${escapeAttribute(name)}" loading="lazy" decoding="async">`
      : `<span>${escapeHtml(initials || "C")}</span>`;
    return `
      <article class="profile-testimonial-card">
        <div class="profile-testimonial-card__stars" aria-label="${rating} out of 5 stars">${"★".repeat(rating)}</div>
        <span class="profile-testimonial-card__quote-mark" aria-hidden="true">“</span>
        <blockquote class="profile-testimonial-card__quote">
          <p>${escapeHtml(testimonial.quote || "")}</p>
        </blockquote>
        <footer class="profile-testimonial-card__person">
          <span class="profile-testimonial-card__avatar">${image}</span>
          <span class="profile-testimonial-card__identity">
            <strong>${escapeHtml(name)}</strong>
          </span>
        </footer>
      </article>
    `;
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element && typeof value === "string") element.textContent = value;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
