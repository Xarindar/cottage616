(function () {
  const api = {
    baseUrl: "https://showrunner-beta-production.up.railway.app/api/public/v1",
    publishableKey: "pk_live_ByKzPoI9HTbxIEIidXD68GhgIyQjQaT8"
  };

  const root = document.querySelector("[data-showrunner-profile]");
  const profile = root?.dataset.showrunnerProfile || (document.body.classList.contains("hive-page") ? "the-hive" : "cottage616");

  if (!root) return;

  loadProfile()
    .then((content) => {
      applyHeader(content?.header || {});
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

  function applyHeader(header) {
    setText("[data-content-header-eyebrow]", header.eyebrow);
    setText("[data-content-header-headline]", header.headline);
    setText("[data-content-header-copy]", header.copy);

    const cta = document.querySelector("[data-content-header-cta]");
    if (cta) {
      if (header.ctaLabel) cta.textContent = header.ctaLabel;
      if (header.ctaHref) cta.setAttribute("href", header.ctaHref);
    }
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
