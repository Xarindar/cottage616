(function () {
  const api = {
    baseUrl: "https://showrunner-beta-production.up.railway.app/api/public/v1",
    publishableKey: "pk_live_ByKzPoI9HTbxIEIidXD68GhgIyQjQaT8"
  };

  const GRID_COLUMNS = 30;
  const GRID_ROWS = 18;

  const root = document.querySelector("[data-showrunner-profile]");
  const profile = root?.dataset.showrunnerProfile || (document.body.classList.contains("hive-page") ? "the-hive" : "cottage616");
  let slideshowTimer = null;

  if (!root) return;

  loadProfile()
    .then((content) => {
      applyHeader(content?.header || {});
      applyCanvasHero(content?.hero || null);
      applyTestimonials(content?.testimonials || {});
    })
    .catch((error) => {
      if (window.console?.warn) window.console.warn("Showrunner content could not load.", error);
    });

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
    if (!hero || typeof hero !== "object") return;

    try {
      const screens =
        hero.slideshow && Array.isArray(hero.slideshow.screens) && hero.slideshow.screens.length > 1
          ? hero.slideshow.screens
          : hero.hero
            ? [hero.hero]
            : [];
      const renderable = screens.filter((screen) => screenHasContent(screen));
      if (!renderable.length) return;

      const container = document.createElement("div");
      container.className = "sr-hero-screens";
      renderable.forEach((screen, index) => {
        container.appendChild(buildScreen(screen, index === 0));
      });

      root.querySelector(".sr-hero-screens")?.remove();
      root.appendChild(container);
      root.classList.add("sr-canvas-active");

      if (slideshowTimer) window.clearInterval(slideshowTimer);
      if (renderable.length > 1) {
        const interval = Math.max(2500, Number(hero.slideshow?.autoplayIntervalMs) || 6500);
        let active = 0;
        slideshowTimer = window.setInterval(() => {
          const nodes = container.querySelectorAll(".sr-hero-screen");
          if (!nodes.length) return;
          active = (active + 1) % nodes.length;
          nodes.forEach((node, index) => node.classList.toggle("is-active", index === active));
        }, interval);
      }
    } catch (error) {
      root.classList.remove("sr-canvas-active");
      if (window.console?.warn) window.console.warn("Showrunner hero canvas could not render.", error);
    }
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
      element.className = "sr-hero-layer sr-hero-cta button primary";
      element.textContent = layer.content || "Book now";
      element.setAttribute("href", normalizeHref(layer.link || "booking.html"));
    }

    if (!element || !String(element.textContent || "").trim()) return null;

    const layout = layer.layout || {};
    const colStart = clampNumber(layout.colStart, 1, GRID_COLUMNS);
    const colEnd = clampNumber(layout.colEnd, colStart + 1, GRID_COLUMNS + 1);
    const rowStart = clampNumber(layout.rowStart, 1, GRID_ROWS);
    element.style.left = `${(((colStart - 1) / GRID_COLUMNS) * 100).toFixed(3)}%`;
    element.style.top = `${(((rowStart - 1) / GRID_ROWS) * 100).toFixed(3)}%`;
    element.style.maxWidth = `${(((GRID_COLUMNS - colStart + 1) / GRID_COLUMNS) * 100).toFixed(3)}%`;
    element.style.minWidth = `${(((colEnd - colStart) / GRID_COLUMNS) * 100).toFixed(3)}%`;

    return element;
  }

  // Showrunner normalizes relative links ("booking.html") to "/booking.html";
  // both resolve to the same page on this static site.
  function normalizeHref(value) {
    const href = String(value || "").trim();
    if (!href) return "booking.html";
    return href;
  }

  function clampNumber(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.max(min, Math.min(max, Math.round(parsed)));
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
    const role = testimonial.authorRole || testimonial.serviceName || "";
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
        <p>${escapeHtml(testimonial.quote || "")}</p>
        <div class="profile-testimonial-card__person">
          <span class="profile-testimonial-card__avatar">${image}</span>
          <span>
            <strong>${escapeHtml(name)}</strong>
            ${role ? `<small>${escapeHtml(role)}</small>` : ""}
          </span>
        </div>
      </article>
    `;
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element && value) element.textContent = value;
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
