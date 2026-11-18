import { bookingTermsValues, renderBookingTerms, renderTermsText } from "./booking-terms.js";
(function () {
  const config = window.BookingClientConfig || {};
  const assets = window.BookingAssets || {};
  const bookingProfile = resolveBookingProfile();

  const state = {
    activeStep: "categories",
    packageFields: ["locations", "outfitChanges", "finalPhotos"],
    categories: [],
    services: [],
    categoryId: null,
    categoryFocusId: "",
    serviceId: null,
    tierId: null,
    addOnIds: [],
    addOnQuantities: {},
    earliestRequested: false,
    selectedDate: dateKey(initialSelectedDate()),
    dateRailStart: null,
    selectedSlot: null,
    staffId: "",
    termsFromContact: false,
    lastBooking: null
  };

  const els = {};
  let availabilityRequest = 0;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    applyBookingProfile();
    cacheElements();
    applyBusinessCopy();
    applyProfileNavigation();
    bindEvents();
    setStatus("Loading services...");

    try {
      const catalog = await loadServices();
      state.packageFields = Array.isArray(catalog.packageFields) ? catalog.packageFields : state.packageFields;
      state.services = catalog.services;
      state.categories = normalizeCategories(
        [...(catalog.categories || []), ...filterCategoriesForProfile(config.categories || [])],
        state.services
      );
      setStatus("");
    } catch (error) {
      if (config.api?.demoFallback !== false) {
        const fallbackCatalog = await loadServices(false);
        state.services = fallbackCatalog.services;
        state.categories = normalizeCategories(filterCategoriesForProfile(config.categories || []), state.services);
        setStatus("Using demo services because live services could not load.");
      } else {
        state.services = [];
        state.categories = normalizeCategories(config.categories || [], []);
        setStatus(error.message || "Services could not load.", true);
      }
    }

    await loadContentProfileSafely();
    renderAll();
    const params = new URLSearchParams(location.search);
    const requestedService = params.get("service") || params.get("slug");
    const requestedCategory = params.get("category");
    if (requestedService) {
      const service = state.services.find(service => service.slug === requestedService || service.id === requestedService);
      if (service) selectServiceWithCategory(service.id, true);
      else setStatus("This service is no longer available. Please choose another service.", true);
    } else if (requestedCategory) {
      const category = state.categories.find(category => category.id === requestedCategory);
      if (category) selectCategory(category.id);
      else setStatus("This category is no longer available. Please choose another category.", true);
    }
  }

  function cacheElements() {
    els.root = document.querySelector("[data-booking-root]");
    els.panels = Array.from(document.querySelectorAll("[data-step-panel]"));
    els.categoryGrid = document.querySelector("[data-category-grid]");
    els.categoryEmpty = document.querySelector("[data-category-empty]");
    els.homeSearch = document.querySelector("[data-home-search]");
    els.promoCard = document.querySelector("[data-promo-card]");
    els.promoTitle = document.querySelector("[data-promo-title]");
    els.promoCopy = document.querySelector("[data-promo-copy]");
    els.promoCta = document.querySelector("[data-promo-cta]");
    els.serviceList = document.querySelector("[data-service-list]");
    els.serviceEmpty = document.querySelector("[data-service-empty]");
    els.serviceSearch = document.querySelector("[data-service-search]");
    els.serviceSort = document.querySelector("[data-service-sort]");
    els.selectedCategoryKicker = document.querySelector("[data-selected-category-kicker]");
    els.selectedServiceKicker = document.querySelector("[data-selected-service-kicker]");
    els.timeControls = document.querySelector(".booking-time-controls");
    els.staffControl = document.querySelector("[data-staff-control]");
    els.staffSelect = document.querySelector("[data-staff-select]");
    els.dateInput = document.querySelector("[data-date-input]");
    els.dateRail = document.querySelector("[data-date-rail]");
    els.monthHeading = document.querySelector("[data-month-heading]");
    els.weekPrev = document.querySelector("[data-week-prev]");
    els.weekNext = document.querySelector("[data-week-next]");
    els.slotGrid = document.querySelector("[data-slot-grid]");
    els.slotEmpty = document.querySelector("[data-slot-empty]");
    els.earliestAvailable = document.querySelector("[data-earliest-available]");
    els.timezoneLabel = document.querySelector("[data-timezone-label]");
    els.availabilityStatus = document.querySelector("[data-availability-status]");
    els.catalogStatus = document.querySelector("[data-catalog-status]");
    els.flowFooter = document.querySelector("[data-flow-footer]");
    els.flowSession = document.querySelector("[data-flow-session]");
    els.flowWhen = document.querySelector("[data-flow-when]");
    els.reviewBooking = document.querySelector("[data-review-booking]");
    els.confirmSummary = document.querySelector("[data-confirm-summary]");
    els.successSummary = document.querySelector("[data-success-summary]");
    els.successCopy = document.querySelector("[data-success-copy]");
    els.successLinks = document.querySelector("[data-success-links]");
    els.form = document.querySelector("[data-booking-form]");
    els.formStatus = document.querySelector("[data-form-status]");
    els.submitBooking = document.querySelector("[data-submit-booking]");
    els.intakeField = document.querySelector("[data-intake-field]");
    els.intakeLabel = document.querySelector("[data-intake-label]");
    els.sessionAddress = document.querySelector("[data-session-address]");
    els.policyField = document.querySelector("[data-policy-field]");
    els.policyText = document.querySelector("[data-policy-text]");
    els.policyTitle = document.querySelector("[data-policy-title]");
    els.policyNote = document.querySelector("[data-policy-note]");
    els.policyConsent = document.querySelector("[data-policy-consent]");
    els.policyAccepted = els.policyField.elements.policyAccepted;
  }

  function applyBusinessCopy() {
    const business = config.business || {};
    setText("[data-business-heading]", business.heading || "Book with us");
  }

  function applyBookingProfile() {
    config.content = { ...(config.content || {}), profile: bookingProfile.key };
    config.business = {
      ...(config.business || {}),
      heading: bookingProfile.heading,
      name: bookingProfile.name
    };
    if (bookingProfile.promotion) {
      config.promotion = { ...(config.promotion || {}), ...bookingProfile.promotion };
    }
    document.body.dataset.bookingProfile = bookingProfile.key;
    document.title = `${bookingProfile.name} | Booking`;
  }

  function applyProfileNavigation() {
    document.querySelectorAll("[data-booking-home]").forEach((link) => link.setAttribute("href", bookingProfile.homeHref));
    document
      .querySelectorAll("[data-booking-nav]")
      .forEach((link) => link.setAttribute("href", `booking.html?profile=${encodeURIComponent(bookingProfile.key)}`));
  }

  function bindEvents() {
    document.querySelector("[data-back-to-categories]")?.addEventListener("click", () => goToStep("categories"));
    document.querySelector("[data-back-to-services]")?.addEventListener("click", () => goToStep(sessionSelectionStep()));
    document.querySelector("[data-back-from-packages]")?.addEventListener("click", () => goToStep("services"));
    document.querySelector("[data-back-from-extras]")?.addEventListener("click", () => goToStep("time"));
    document.querySelector("[data-continue-extras]")?.addEventListener("click", () => {
      if ([...document.querySelectorAll("[data-extra-quantity]")].every(input => input.reportValidity())) goToStep(contactEntryStep());
    });
    document.querySelector("[data-back-from-terms]")?.addEventListener("click", () => {
      if (state.termsFromContact) goToStep("confirm");
      else if (selectedService()?.addOns?.length) {
        renderExtras();
        goToStep("extras");
      } else goToStep("time");
    });
    document.querySelector("[data-back-from-contact]")?.addEventListener("click", () => {
      goToStep(contactEntryStep() === "terms" ? "terms" : "time");
    });
    document.querySelector("[data-new-booking]")?.addEventListener("click", resetFlow);
    els.reviewBooking?.addEventListener("click", () => {
      if (selectedService()?.addOns?.length) { renderExtras(); goToStep("extras"); } else goToStep(contactEntryStep());
    });

    els.homeSearch?.addEventListener("input", () => {
      state.categoryFocusId = "";
      renderCategories();
    });
    els.promoCard?.addEventListener("click", handlePromotionClick);
    els.serviceSearch?.addEventListener("input", renderServices);
    els.serviceSort?.addEventListener("change", renderServices);
    els.staffSelect?.addEventListener("change", () => {
      state.staffId = els.staffSelect.value;
      state.selectedSlot = null;
      updateInlineActions();
      loadAndRenderSlots();
    });
    els.dateInput?.addEventListener("change", () => {
      if (!els.dateInput.value) return;
      state.selectedDate = els.dateInput.value;
      state.dateRailStart = null;
      state.selectedSlot = null;
      renderDates();
      updateInlineActions();
      loadAndRenderSlots();
    });
    els.weekPrev?.addEventListener("click", () => shiftDateRail(-1));
    els.weekNext?.addEventListener("click", () => shiftDateRail(1));
    els.earliestAvailable?.addEventListener("click", jumpToEarliestAvailableDate);
    els.form?.addEventListener("submit", submitBooking);
    bindAddressLookup();
    els.policyField.addEventListener("submit", event => {
      event.preventDefault();
      goToStep("confirm");
    });
  }

  function renderAll() {
    renderPromo();
    renderCategories();
    renderServices();
    renderDates();
    renderStaffSelect();
    updateInlineActions();
    updatePanels();
  }

  function renderCategories() {
    const query = (els.homeSearch?.value || "").trim().toLowerCase();
    const sorted = [...state.categories].sort(sortBySortThenName);
    const visible = query ? sorted.filter((category) => categoryMatchesQuery(category, query)) : sorted;

    els.categoryEmpty.hidden = visible.length > 0;
    els.categoryEmpty.textContent = query ? "No categories match that search." : "No services are currently available for booking.";
    els.categoryGrid.innerHTML = sorted
      .filter((category) => visible.includes(category))
      .map((category) => {
        const image = imageForCategory(category);
        const highlighted = state.categoryFocusId === category.id;
        return `
          <button class="booking-category-card ${image ? "has-image" : ""} ${highlighted ? "is-highlighted" : ""}" type="button" data-category-id="${escapeAttribute(category.id)}" ${image ? `style="--category-image: url('${escapeAttribute(image)}')"` : ""}>
            <span class="booking-category-card-copy">
              <strong>${escapeHtml(category.name)}</strong>
              ${category.description ? `<span>${escapeHtml(category.description)}</span>` : ""}
            </span>
          </button>
        `;
      })
      .join("");

    els.categoryGrid.querySelectorAll("[data-category-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectCategory(button.dataset.categoryId);
      });
    });

  }

  function renderPromo() {
    const promo = config.promotion || {};
    if (!els.promoCard) return;
    if (promo.enabled === false) {
      els.promoCard.hidden = true;
      return;
    }
    const image = normalizeImageUrl(promo.imageUrl || assets.promoImage || assets.fallbackCategoryImage || "");
    els.promoCard.hidden = false;
    els.promoCard.style.setProperty("--promo-image", `url("${String(image).replace(/"/g, "%22")}")`);
    els.promoTitle.textContent = promo.title || "Book your next visit";
    els.promoCopy.textContent = promo.copy || "Find a time that works for you.";
    els.promoCta.textContent = promo.cta || "Book now";
  }

  function handlePromotionClick() {
    const promo = config.promotion || {};
    const targetType = String(promo.targetType || "").toUpperCase();

    if (targetType === "SERVICE" && promo.serviceId && serviceById(promo.serviceId)) {
      selectServiceWithCategory(promo.serviceId);
      return;
    }

    if (targetType === "PACKAGE") {
      const serviceIds = Array.isArray(promo.serviceIds) ? promo.serviceIds : [];
      const bookableServices = serviceIds.map(serviceById).filter(Boolean);
      if (bookableServices.length === 1) {
        selectServiceWithCategory(bookableServices[0].id);
        return;
      }
      const categoryId = promo.categoryId || bookableServices[0]?.categoryId;
      if (categoryId) {
        selectCategory(categoryId);
        return;
      }
    }

    const categoryId = promo.categoryId || (promo.serviceId ? serviceById(promo.serviceId)?.categoryId : "");
    if (categoryId) selectCategory(categoryId);
  }

  function renderServices() {
    const category = selectedCategory();
    const search = (els.serviceSearch?.value || "").trim().toLowerCase();
    const sort = els.serviceSort?.value || "recommended";
    let services = state.categoryId ? servicesForCategory(state.categoryId) : [...state.services];

    if (search) {
      services = services.filter((service) =>
        [service.name, service.description, service.location]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    }

    services = sortServices(services, sort);

    if (els.selectedCategoryKicker) {
      els.selectedCategoryKicker.textContent = category ? category.name : "Services";
    }

    els.serviceEmpty.hidden = services.length > 0;
    els.serviceList.innerHTML = services
      .map((service) => {
        const detail = service.requestOnly ? "Request only" : service.location || "Online booking";
        const image = normalizeImageUrl(service.imageUrl);
        return `
          <tr>
            <td>
              <span class="booking-service-name ${image ? "has-image" : ""}">
                <span class="booking-service-thumb ${image ? "" : "is-empty"}" ${
                  image ? `style="--service-image: url('${escapeAttribute(image)}'); --service-position: ${service.imagePositionX}% ${service.imagePositionY}%; --service-zoom: ${service.imageZoom}"` : ""
                } aria-hidden="true"></span>
                <span class="booking-service-copy">
                  <strong>${escapeHtml(service.name)}</strong>
                  <span>${escapeHtml(service.description || "Service details available at confirmation.")}</span>
                </span>
              </span>
            </td>
            <td><span class="booking-service-meta">${formatDuration(service.durationMinutes || 0)}</span></td>
            <td><span class="booking-service-meta">${formatPrice(service.priceCents)}</span></td>
            <td><span class="booking-service-detail">${escapeHtml(detail)}</span></td>
            <td><button class="booking-row-button button button--primary button--small" type="button" data-service-id="${escapeAttribute(service.id)}">Select</button></td>
          </tr>
        `;
      })
      .join("");

    els.serviceList.querySelectorAll("[data-service-id]").forEach((button) => {
      button.addEventListener("click", () => selectService(button.dataset.serviceId));
    });
  }

  function selectService(serviceId, earliest = false) {
    if (state.serviceId !== serviceId) {
      els.sessionAddress.querySelectorAll("input").forEach(input => { input.value = ""; });
    }
    state.serviceId = serviceId;
    state.tierId = null; state.addOnIds = []; state.addOnQuantities = {}; state.earliestRequested = earliest;
    state.selectedSlot = null;
    const packages = serviceById(serviceId)?.packages || [];
    if (packages.length > 1) { renderPackages(); goToStep("packages"); return; }
    state.tierId = packages[0]?.id || null;
    startServiceTime(earliest);
  }

  function startServiceTime(earliest = false) {
    state.selectedSlot = null;
    state.staffId = "";
    state.dateRailStart = null;
    const service = selectedService();
    const inclusions = document.querySelector("[data-time-inclusions]");
    inclusions.innerHTML = service?.packages.length === 1 ? packageInclusionsMarkup(service.coverage) : "";
    inclusions.hidden = !inclusions.innerHTML;
    if (service) {
      state.selectedDate = dateKey(minBookableDateFor(service));
    }
    renderStaffSelect();
    renderDates();
    goToStep("time");
    updateInlineActions();
    if (earliest) jumpToEarliestAvailableDate();
    else loadAndRenderSlots();
  }

  function packageDetails(pack) {
    return [...(pack.coverage || []), ...Object.entries(pack.deliverables || {}).filter(([key]) => state.packageFields.includes(key)).map(([key, count]) => {
      const label = { finalPhotos: "photo", locations: "location", outfitChanges: "outfit change" }[key];
      return label ? `${count === null ? "Unlimited" : count} ${label}${count === 1 ? "" : "s"}` : "";
    })].filter(Boolean).map(escapeHtml).join("<br>");
  }

  function packageInclusionsMarkup(coverage, heading = "What’s included") {
    return coverage?.length ? `<div class="booking-inclusions">
      <p>${escapeHtml(heading)}</p>
      <ul>${coverage.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>` : "";
  }

  function mobilePackageInclusionsMarkup(pack, packages) {
    const coverage = pack.coverage || [];
    const duration = candidate => candidate.unlimitedDuration ? Infinity : candidate.durationMinutes;
    const base = packages.filter(candidate => {
      const items = candidate.coverage || [];
      if (!items.length || !items.every(item => coverage.includes(item)) || items.length >= coverage.length) return false;
      if (!(duration(candidate) <= duration(pack))) return false;

      return Object.entries(candidate.deliverables || {}).every(([key, count]) => {
        const upgradedCount = pack.deliverables?.[key];
        return upgradedCount === null || (count !== null && upgradedCount >= count);
      });
    }).sort((a, b) => b.coverage.length - a.coverage.length || duration(b) - duration(a))[0];

    if (!base) return packageInclusionsMarkup(coverage);
    const addedCoverage = coverage.filter(item => !base.coverage.includes(item));
    return packageInclusionsMarkup(addedCoverage, `Everything in ${base.name}, plus…`);
  }

  function renderPackages() {
    const service = serviceById(state.serviceId);
    const packages = service?.packages || [];
    document.querySelector("[data-package-service]").textContent = service?.name || "";
    const rows = [
      ["Session length", pack => pack.unlimitedDuration ? "Unlimited" : formatDuration(pack.durationMinutes)],
      ...Object.entries({ finalPhotos: "Edited photos", locations: "Locations", outfitChanges: "Outfit changes" })
        .filter(([key]) => state.packageFields.includes(key) && packages.some(pack => Object.hasOwn(pack.deliverables || {}, key)))
        .map(([key, label]) => [label, pack => pack.deliverables?.[key] === null ? "Unlimited" : pack.deliverables?.[key]]),
    ];
    const coverage = [...new Set(packages.flatMap(pack => pack.coverage || []))];
    const selectPackage = pack => `<button class="booking-button button button--primary" type="button" data-package-id="${escapeAttribute(pack.id)}">Select ${escapeHtml(pack.name)}</button>`;
    document.querySelector("[data-package-list]").innerHTML = `
      <thead><tr><td></td>${packages.map(pack => `<th scope="col">
        <strong>${escapeHtml(pack.name)}</strong>
        <span>${escapeHtml(formatPrice(pack.priceCents))}</span>
        ${selectPackage(pack)}
      </th>`).join("")}</tr></thead>
      <tbody>${rows.map(([label, value]) => `<tr><th scope="row">${label}</th>
        ${packages.map(pack => `<td>${escapeHtml(value(pack) ?? "Not specified")}</td>`).join("")}
      </tr>`).join("")}</tbody>
      ${coverage.length ? `<tbody class="booking-compare-inclusions">
        ${coverage.map(item => `<tr><th scope="row">${escapeHtml(item)}</th>
          ${packages.map(pack => `<td>${pack.coverage?.includes(item) ? '<span class="booking-included">Included</span>' : '<span aria-hidden="true">—</span><span class="booking-visually-hidden">Not included</span>'}</td>`).join("")}
        </tr>`).join("")}
      </tbody>` : ""}`;
    document.querySelector("[data-package-stack]").innerHTML = packages.map(pack => `<article class="booking-package-card">
      <div class="booking-package-card-head">
        <h3>${escapeHtml(pack.name)}</h3>
        <p>${escapeHtml(formatPrice(pack.priceCents))}</p>
      </div>
      ${mobilePackageInclusionsMarkup(pack, packages)}
      <dl>${rows.map(([label, value]) => {
        const detail = value(pack);
        return detail == null ? "" : `<div><dt>${label}</dt><dd>${escapeHtml(detail)}</dd></div>`;
      }).join("")}</dl>
      ${selectPackage(pack)}
    </article>`).join("");
    document.querySelectorAll("[data-package-id]").forEach(button => button.addEventListener("click", () => {
      state.tierId = button.dataset.packageId;
      state.addOnIds = []; state.addOnQuantities = {}; state.selectedSlot = null;
      startServiceTime(state.earliestRequested);
    }));
  }

  function renderExtras() {
    const service = selectedService();
    const pack = service?.packages.find(pack => pack.id === state.tierId);
    document.querySelector("[data-extras-package]").textContent = service?.name || "";
    document.querySelector("[data-extras-base]").textContent = formatPrice(pack?.priceCents);
    const extras = document.querySelector("[data-extra-list]");
    extras.innerHTML = (service?.addOns || []).map(extra => {
      const selected = state.addOnIds.includes(extra.id);
      const perUnit = extra.pricingType === "PER_UNIT";
      const details = packageDetails(extra);
      return `<li class="booking-extra">
        <div class="booking-extra-head">
          <h3>${escapeHtml(extra.name)}</h3>
          <p class="booking-extra-price">${escapeHtml(formatPrice(extra.priceCents))}${perUnit ? " each" : ""}</p>
        </div>
        ${extra.description ? `<p class="booking-extra-description">${escapeHtml(extra.description)}</p>` : ""}
        ${details ? `<p class="booking-extra-details">${details}</p>` : ""}
        <div class="booking-extra-controls">
          <label class="booking-extra-choice"><input type="checkbox" data-extra-id="${escapeAttribute(extra.id)}" aria-label="Add ${escapeAttribute(extra.name)}" ${selected ? "checked" : ""}><span aria-hidden="true"></span></label>
          ${perUnit ? `<label class="booking-extra-quantity"><span>Qty</span><input type="number" min="1" max="10000" step="1" required value="${state.addOnQuantities[extra.id] || 1}" aria-label="${escapeAttribute(extra.name)} quantity" data-extra-quantity="${escapeAttribute(extra.id)}" ${selected ? "" : "disabled"}></label>` : ""}
        </div>
      </li>`;
    }).join("");
    extras.querySelectorAll("[data-extra-id]").forEach(input => input.addEventListener("change", () => {
      const id = input.dataset.extraId;
      state.addOnIds = input.checked ? [...state.addOnIds, id] : state.addOnIds.filter(selectedId => selectedId !== id);
      const quantity = input.closest(".booking-extra").querySelector("[data-extra-quantity]");
      if (quantity) {
        quantity.disabled = !input.checked;
        if (!input.checked) {
          delete state.addOnQuantities[id];
          quantity.value = 1;
        }
      }
      updateExtrasTotal();
    }));
    extras.querySelectorAll("[data-extra-quantity]").forEach(input => input.addEventListener("input", () => {
      if (!input.checkValidity()) return;
      state.addOnQuantities[input.dataset.extraQuantity] = input.valueAsNumber;
      updateExtrasTotal();
    }));
    updateExtrasTotal();
  }

  function updateExtrasTotal() {
    const service = selectedService();
    const extrasTotal = (service?.extras || []).reduce((total, extra) => total + extra.priceCents * extra.quantity, 0);
    document.querySelector("[data-extras-subtotal]").textContent = formatPrice(extrasTotal);
    document.querySelector("[data-extras-total]").textContent = formatPrice(service?.priceCents);
    document.querySelector("[data-continue-extras]").textContent = state.addOnIds.length ? "Continue with extras" : "Continue without extras";
  }

  function selectCategory(categoryId) {
    setStatus("");
    availabilityRequest += 1;
    state.categoryId = categoryId;
    state.categoryFocusId = categoryId;
    state.serviceId = null;
    state.selectedSlot = null;
    state.staffId = "";
    goToStep("services");
    renderAll();
  }

  function selectServiceWithCategory(serviceId, earliest = false) {
    const service = serviceById(serviceId);
    if (!service) return;
    state.categoryId = service.categoryId;
    state.categoryFocusId = service.categoryId;
    selectService(service.id, earliest);
  }

  function renderStaffSelect() {
    const service = selectedService();
    const staff = service?.staff || [];
    const showStaffFilter = config.features?.showStaffFilter === true;
    if (!service || !staff.length || !showStaffFilter) {
      if (els.timeControls) els.timeControls.hidden = true;
      els.staffControl.hidden = true;
      els.staffSelect.innerHTML = "";
      state.staffId = "";
      return;
    }

    if (els.timeControls) els.timeControls.hidden = false;
    els.staffControl.hidden = false;
    els.staffSelect.innerHTML = [
      `<option value="">Any available provider</option>`,
      ...staff.map((member) => `<option value="${escapeAttribute(member.id)}">${escapeHtml(member.name)}${member.title ? `, ${escapeHtml(member.title)}` : ""}</option>`)
    ].join("");
    els.staffSelect.value = state.staffId;
  }

  function renderDates() {
    const daysToShow = Number(config.schedule?.daysToShow || 10);
    const today = startOfDay(new Date());
    let railStart = state.dateRailStart ? parseDateKey(state.dateRailStart) : null;

    if (!railStart) {
      const selected = parseDateKey(state.selectedDate);
      const defaultLast = new Date(today);
      defaultLast.setDate(today.getDate() + daysToShow - 1);
      railStart = new Date(today);
      if (selected > defaultLast) {
        railStart = new Date(selected);
        railStart.setDate(selected.getDate() - daysToShow + 1);
      }
    }
    if (railStart < today) {
      railStart = new Date(today);
    }
    state.dateRailStart = dateKey(railStart);

    const dates = Array.from({ length: daysToShow }, (_, index) => {
      const next = new Date(railStart);
      next.setDate(railStart.getDate() + index);
      return next;
    });

    if (els.dateInput) {
      els.dateInput.min = dateKey(today);
      els.dateInput.value = state.selectedDate;
    }
    if (els.monthHeading) {
      els.monthHeading.textContent = formatMonthYear(dates[Math.floor(dates.length / 2)]);
    }
    if (els.weekPrev) {
      els.weekPrev.disabled = railStart <= today;
    }

    els.dateRail.innerHTML = dates
      .map((date) => {
        const key = dateKey(date);
        const selected = key === state.selectedDate;
        return `
          <button class="booking-date-button ${selected ? "is-selected" : ""}" type="button" data-date="${key}" aria-pressed="${selected}">
            <span>${weekdayShort(date)}</span>
            <strong>${date.getDate()}</strong>
          </button>
        `;
      })
      .join("");

    els.dateRail.querySelectorAll("[data-date]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedDate = button.dataset.date;
        state.selectedSlot = null;
        renderDates();
        updateInlineActions();
        loadAndRenderSlots();
      });
    });
  }

  function shiftDateRail(direction) {
    const daysToShow = Number(config.schedule?.daysToShow || 10);
    const today = startOfDay(new Date());
    const start = state.dateRailStart ? parseDateKey(state.dateRailStart) : new Date(today);
    start.setDate(start.getDate() + direction * daysToShow);
    if (start < today) {
      start.setTime(today.getTime());
    }
    state.dateRailStart = dateKey(start);
    renderDates();
  }

  async function loadAndRenderSlots() {
    const request = ++availabilityRequest;
    const service = selectedService();
    if (!service) return;

    els.slotGrid.innerHTML = "";
    els.slotEmpty.hidden = true;
    if (els.earliestAvailable) {
      els.earliestAvailable.hidden = true;
      els.earliestAvailable.disabled = false;
      els.earliestAvailable.textContent = "Earliest Available Date";
    }
    setAvailabilityStatus("Checking times...");

    try {
      const slots = await loadSlots(service);
      if (request !== availabilityRequest) return;
      setAvailabilityStatus("");
      renderSlots(slots);
    } catch (error) {
      if (request !== availabilityRequest) return;
      setAvailabilityStatus(error.message || "Times could not load.", true);
      renderSlots([], false);
    }
  }

  function renderSlots(slots, showEarliestAction = true) {
    const service = selectedService();
    if (els.selectedServiceKicker) {
      els.selectedServiceKicker.textContent = service ? service.name : "Time";
    }
    if (els.timezoneLabel) {
      const timeZone = config.business?.timezone;
      els.timezoneLabel.textContent = timeZone ? new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: "longGeneric" })
        .formatToParts().find(part => part.type === "timeZoneName")?.value || timeZone : "";
    }

    els.slotEmpty.hidden = slots.length > 0;
    if (els.earliestAvailable) {
      els.earliestAvailable.hidden = slots.length > 0 || !showEarliestAction;
      els.earliestAvailable.disabled = false;
      els.earliestAvailable.textContent = "Earliest Available Date";
    }
    els.slotGrid.innerHTML = slots
      .map((slot, index) => {
        const selected = state.selectedSlot?.startsAt === slot.startsAt && (state.selectedSlot?.staffId || "") === (slot.staffId || "");
        return `
          <button class="booking-slot-button button button--secondary ${selected ? "is-selected" : ""}" type="button" data-slot-index="${index}" aria-pressed="${selected}">${formatSlotTime(slot.startsAt)}</button>
        `;
      })
      .join("");

    els.slotGrid.querySelectorAll("[data-slot-index]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedSlot = slots[Number(button.dataset.slotIndex)];
        renderSlots(slots);
        updateInlineActions();
      });
    });
  }

  async function jumpToEarliestAvailableDate() {
    const request = ++availabilityRequest;
    const service = selectedService();
    if (!service) return;

    if (els.earliestAvailable) {
      els.earliestAvailable.disabled = true;
      els.earliestAvailable.textContent = "Finding...";
    }
    setAvailabilityStatus("Finding the earliest available date...");

    try {
      const earliest = await findEarliestAvailableDate(service, () => request === availabilityRequest);
      if (request !== availabilityRequest) return;
      if (!earliest) {
        setAvailabilityStatus("No upcoming availability was found.", true);
        if (els.earliestAvailable) {
          els.earliestAvailable.disabled = false;
          els.earliestAvailable.textContent = "Earliest Available Date";
        }
        return;
      }

      state.selectedDate = earliest.date;
      state.dateRailStart = null;
      state.selectedSlot = null;
      renderDates();
      renderSlots(earliest.slots);
      updateInlineActions();
      setAvailabilityStatus("");
    } catch (error) {
      if (request !== availabilityRequest) return;
      setAvailabilityStatus(error.message || "Availability could not be checked.", true);
      if (els.earliestAvailable) {
        els.earliestAvailable.disabled = false;
        els.earliestAvailable.textContent = "Earliest Available Date";
      }
    }
  }

  function renderConfirm() {
    const service = selectedService();
    const slot = state.selectedSlot;
    if (!service || !slot) return;

    els.confirmSummary.innerHTML = summaryMarkup(service, slot);
    els.submitBooking.textContent = service.requestOnly ? "Send request" : "Confirm booking";

    els.form.append(els.sessionAddress);
    window.ShowrunnerBookingRules.render(els.form, service.bookingRules, service.id, {title:service.bookingFormTitle,revision:service.bookingRequirementsRevision});
    renderSessionAddress(service.bookingRules);
    if (service.intakePrompt && !Array.isArray(service.bookingRules)) {
      els.intakeField.hidden = false;
      els.intakeLabel.textContent = service.intakePrompt;
    } else {
      els.intakeField.hidden = true;
    }
  }

  function renderSessionAddress(rules) {
    const locationRule = rules?.find(rule => rule.kind === "intake" && rule.type === "SELECT" && rule.label.trim().toLowerCase() === "preferred location");
    const select = locationRule && els.form.elements.namedItem(`bookingRule:${locationRule.id}`);
    const isOnLocation = value => /^(outdoors|on location)$/i.test(value.trim());
    const updateFields = () => {
      const active = select && isOnLocation(select.value);
      els.sessionAddress.hidden = !active;
      els.sessionAddress.disabled = !active;
    };
    if (select) {
      // Keep existing answer values valid for forms saved with the Outdoors option.
      for (const option of select.options) if (isOnLocation(option.value)) option.textContent = "On Location";
      select.closest("label").after(els.sessionAddress);
      select.addEventListener("change", updateFields);
    }
    updateFields();
  }

  function bindAddressLookup() {
    const { sessionAddressLine, sessionCity, sessionState, sessionZip } = els.form.elements;
    const list = document.getElementById("booking-address-suggestions");
    let matches = new Map();
    let timer;
    let controller;
    const applyMatch = () => {
      const match = matches.get(sessionAddressLine.value);
      if (!match) return false;
      sessionAddressLine.value = match.address;
      sessionCity.value = match.city;
      sessionState.value = match.state;
      sessionZip.value = match.zip;
      return true;
    };
    sessionAddressLine.addEventListener("change", applyMatch);
    sessionAddressLine.addEventListener("input", () => {
      clearTimeout(timer);
      controller?.abort();
      const selected = applyMatch();
      matches.clear();
      list.replaceChildren();
      const query = sessionAddressLine.value.trim();
      if (selected || query.length < 3) return;
      const request = new AbortController();
      controller = request;
      timer = setTimeout(async () => {
        try {
          const { suggestions } = await apiRequest(`/locations?q=${encodeURIComponent(query)}`, { signal: request.signal });
          if (request.signal.aborted || els.sessionAddress.disabled || sessionAddressLine.value.trim() !== query) return;
          matches = new Map((suggestions || []).map(match => [match.label, match]));
          list.replaceChildren(...[...matches.keys()].map(label => new Option(label, label)));
        } catch {
          // The address fields stay editable if suggestions are unavailable.
        }
      }, 450);
    });
  }

  function contactEntryStep(service = selectedService()) {
    return service?.policyText || service?.bookingRules?.some(rule => rule.kind === "policy") ? "terms" : "confirm";
  }

  function renderPolicy(service) {
    const rules = service.bookingRules?.filter(rule => rule.kind === "policy") || [];
    const rich = rules.some(rule => rule.richText);
    const values = bookingTermsValues({
      serviceName: serviceById(state.serviceId)?.name || service.name,
      package: service.packages?.length ? { ...service, name: service.packages.find(pack => pack.id === state.tierId)?.name } : null,
      priceCents: service.priceCents,
      durationMinutes: service.durationMinutes,
      startsAt: state.selectedSlot?.startsAt,
      timezone: config.business?.timezone || "America/Chicago",
      customerName: els.form.elements.customerName.value,
      customerEmail: els.form.elements.customerEmail.value,
      customerPhone: els.form.elements.customerPhone.value
    });
    const missingContactFields = ["clientName", "clientEmail", "clientPhone"].filter(field => !values[field]);
    for (const field of missingContactFields) delete values[field];
    const rendered = rich ? renderBookingTerms(rules, values) : { text: renderTermsText(service.policyText || rules.map(rule => rule.label).join("\n\n"), values) };
    const usesMissingContact = node => node?.type === "dynamicField"
      ? missingContactFields.includes(node.attrs.field)
      : node?.content?.some(usesMissingContact);
    const needsContact = rich && rules.some(rule => usesMissingContact(rule.richText));

    els.policyText.classList.toggle("booking-rich-terms", rich);
    if (rich) els.policyText.innerHTML = rendered.html;
    else els.policyText.textContent = rendered.text;
    els.policyTitle.textContent = service.bookingTermsTitle || "Terms & Conditions";
    els.policyNote.hidden = needsContact || !state.termsFromContact;
    els.policyConsent.hidden = needsContact;
    els.policyAccepted.disabled = needsContact;
    els.policyAccepted.required = Boolean(service.requirePolicy) && !needsContact;

    const policyKey = JSON.stringify([service.id, state.tierId, state.addOnIds, service.bookingRequirementsRevision, rendered.text]);
    const changed = els.policyField.dataset.policyKey !== policyKey;
    if (changed) els.policyAccepted.checked = false;
    els.policyField.dataset.policyKey = policyKey;
    return { changed, acceptedTerms: rich ? rendered.text : undefined };
  }

  function updateInlineActions() {
    if (els.reviewBooking) {
      els.reviewBooking.disabled = !state.selectedSlot;
    }
    updateFlowFooter();
  }

  function updateFlowFooter() {
    const service = selectedService();
    const isVisible = state.activeStep === "time" && Boolean(service);

    if (els.root) {
      els.root.classList.toggle("has-flow-footer", isVisible);
    }
    if (els.flowFooter) {
      els.flowFooter.hidden = !isVisible;
    }
    if (!isVisible) return;

    const date = formatFooterDate(state.selectedSlot?.startsAt || state.selectedDate);
    const time = state.selectedSlot && formatFooterTime(state.selectedSlot.startsAt);
    els.flowSession.textContent = service.name;
    els.flowWhen.textContent = time ? `${date} at ${time}` : date;
  }

  function renderSuccess(bookingResult) {
    const service = selectedService();
    const slot = state.selectedSlot;
    if (!service || !slot) return;

    els.successSummary.innerHTML = summaryMarkup(service, slot, bookingResult?.booking?.id);
    const pending = bookingResult?.booking?.status === "PENDING" || service.requestOnly;
    document.querySelector("#success-title").textContent = pending ? "Request received" : "You're booked";
    document.querySelector(".booking-success-icon").hidden = pending;
    els.successCopy.textContent = pending
      ? "Your appointment request has been sent. The team will follow up with confirmation."
      : "Your appointment is confirmed.";

    const links = [];
    if (bookingResult?.booking?.calendarUrl) {
      links.push(`<a class="booking-button booking-button-secondary button button--secondary" href="${escapeAttribute(bookingResult.booking.calendarUrl)}">Add to calendar</a>`);
    }
    if (bookingResult?.booking?.manageUrl) {
      links.push(`<a class="booking-button booking-button-secondary button button--secondary" href="${escapeAttribute(bookingResult.booking.manageUrl)}">Manage booking</a>`);
    }
    if (bookingResult?.booking?.formLinks?.length) {
      bookingResult.booking.formLinks.forEach((form) => {
        links.push(`<a class="booking-button booking-button-secondary button button--secondary" href="${escapeAttribute(form.href)}">${escapeHtml(form.name)}</a>`);
      });
    }
    els.successLinks.innerHTML = links.join("");
  }

  function updatePanels() {
    if (els.root) {
      els.root.dataset.activeStep = state.activeStep;
    }

    els.panels.forEach((panel) => {
      const isActive = panel.dataset.stepPanel === state.activeStep;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });

    if (state.activeStep === "confirm") {
      renderConfirm();
    }
    if (state.activeStep === "terms") renderPolicy(selectedService());
  }

  function goToStep(stepId) {
    if (!canVisitStep(stepId)) return;
    const changed = state.activeStep !== stepId;
    const moveFocus = document.activeElement !== document.body;
    state.activeStep = stepId;
    if (stepId !== "terms") state.termsFromContact = false;
    updatePanels();
    updateInlineActions();
    if (stepId === "time") loadAndRenderSlots();
    if (changed) {
      if (moveFocus) {
        const title = document.getElementById(els.panels.find(panel => panel.dataset.stepPanel === stepId)?.getAttribute("aria-labelledby"));
        title?.setAttribute("tabindex", "-1");
        title?.focus({ preventScroll: true });
      }
      window.scrollTo(0, 0);
    }
  }

  function sessionSelectionStep() {
    if ((serviceById(state.serviceId)?.packages.length || 0) > 1) return "packages";
    return state.categoryId ? "services" : "categories";
  }

  function canVisitStep(stepId) {
    if (stepId === "categories") return true;
    if (stepId === "services") return Boolean(state.categoryId);
    if (stepId === "packages") return Boolean(state.serviceId);
    if (stepId === "extras") return Boolean(state.serviceId && state.selectedSlot);
    if (stepId === "time") return Boolean(state.serviceId && (!serviceById(state.serviceId)?.packages.length || state.tierId));
    if (stepId === "terms") return Boolean(state.selectedSlot) && contactEntryStep() === "terms";
    if (stepId === "confirm") return Boolean(state.serviceId && state.selectedSlot);
    return false;
  }

  async function submitBooking(event) {
    event.preventDefault();
    const service = selectedService();
    const slot = state.selectedSlot;
    if (!service || !slot) return;

    let policyAccepted = false;
    let acceptedTerms;
    if (contactEntryStep(service) === "terms") {
      const policy = renderPolicy(service);
      policyAccepted = els.policyAccepted.checked;
      acceptedTerms = policy.acceptedTerms;
      if (policy.changed || (service.requirePolicy && !policyAccepted)) {
        state.termsFromContact = true;
        goToStep("terms");
        return;
      }
    }

    const formData = new FormData(els.form);
    const sessionAddress = els.sessionAddress.disabled ? undefined : {
      address: formData.get("sessionAddressLine").trim(),
      city: formData.get("sessionCity").trim(),
      state: formData.get("sessionState").trim(),
      zip: formData.get("sessionZip").trim()
    };
    const payload = {
      serviceId: service.id,
      tierId: state.tierId || undefined,
      addOnIds: state.addOnIds,
      addOnQuantities: state.addOnQuantities,
      serviceRevision: service.serviceRevision,
      staffId: slot.staffId || selectedStaffId(service) || undefined,
      resourceIds: slot.resourceIds?.length ? slot.resourceIds : service.resources?.map((resource) => resource.id) || undefined,
      startsAt: slot.startsAt,
      customerName: String(formData.get("customerName") || "").trim(),
      customerEmail: String(formData.get("customerEmail") || "").trim(),
      customerPhone: String(formData.get("customerPhone") || "").trim(),
      customerCompany: String(formData.get("customerCompany") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
      intakeResponse: String(formData.get("intakeResponse") || "").trim(),
      intakeAnswers: window.ShowrunnerBookingRules.answers(els.form),
      policyAccepted,
      sessionAddress,
      bookingRequirementsRevision: service.bookingRequirementsRevision || undefined,
      acceptedTerms,
      companyWebsite: String(formData.get("companyWebsite") || "")
    };

    setFormStatus("Sending...");
    els.submitBooking.disabled = true;

    try {
      const result = await createBooking(payload);
      state.lastBooking = result;
      renderSuccess(result);
      state.activeStep = "success";
      updatePanels();
      updateInlineActions();
      els.form.reset();
      els.policyField.reset();
      delete els.policyField.dataset.policyKey;
      setFormStatus("");
    } catch (error) {
      setFormStatus(error.message || "Booking could not be completed.", true);
    } finally {
      els.submitBooking.disabled = false;
    }
  }

  async function loadServices(useApi = true) {
    if (!useApi || !config.api?.enabled) {
      return filterCatalogForProfile({
        categories: config.categories || [],
        services: normalizeServices(config.services || [])
      });
    }
    const response = await apiRequest("/services");
    const liveCategories = Array.isArray(response.categories) ? response.categories : [];
    const liveServices = response.services || [];
    return filterCatalogForProfile({
      packageFields: response.packageFields,
      categories: liveCategories,
      services: normalizeServices(liveServices.map(mergeServicePresentation))
    });
  }

  async function loadContentProfileSafely() {
    try {
      const profile = await loadContentProfile();
      if (profile?.bookingPromotion) {
        config.promotion = {
          ...(config.promotion || {}),
          ...profile.bookingPromotion
        };
      }
      if (profile?.label) {
        config.business = {
          ...(config.business || {}),
          heading: bookingProfile.heading || `Book ${profile.label}`,
          name: profile.label
        };
        applyBusinessCopy();
      }
    } catch (error) {
      if (window.console?.warn) {
        window.console.warn("Showrunner content profile could not load.", error);
      }
    }
  }

  async function loadContentProfile() {
    if (!config.api?.enabled || config.content?.enabled === false) return null;
    const profile = bookingProfile.key;
    return apiRequest(`/content/profile?profile=${encodeURIComponent(profile)}`);
  }

  function filterCatalogForProfile(catalog) {
    const allowedCategoryIds = new Set(bookingProfile.categoryIds);
    if (!allowedCategoryIds.size) return catalog;

    return {
      ...catalog,
      categories: filterCategoriesForProfile(catalog.categories || []),
      services: (catalog.services || []).filter((service) => allowedCategoryIds.has(service.categoryId))
    };
  }

  function filterCategoriesForProfile(categories) {
    const allowedCategoryIds = new Set(bookingProfile.categoryIds);
    if (!allowedCategoryIds.size) return categories;
    return categories.filter((category) => allowedCategoryIds.has(String(category.id || category.slug || "")));
  }

  function resolveBookingProfile() {
    const requested = new URLSearchParams(window.location.search).get("profile") || config.content?.profile || config.contentProfile;
    const normalized = normalizeBookingProfileKey(requested);
    const profiles = config.bookingProfiles || {};
    const selected = profiles[normalized] || profiles.cottage616 || {};

    return {
      categoryIds: Array.isArray(selected.categoryIds) ? selected.categoryIds.map(String) : [],
      heading: selected.heading || (normalized === "the-hive" ? "Book The Hive" : "Book Cottage 616"),
      homeHref: selected.homeHref || (normalized === "the-hive" ? "the-hive.html" : "index.html"),
      key: normalized,
      name: selected.name || (normalized === "the-hive" ? "The Hive" : "Cottage 616"),
      promotion: selected.promotion || null
    };
  }

  function normalizeBookingProfileKey(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "the-hive" || normalized === "the_hive" || normalized === "thehive" || normalized === "hive") {
      return "the-hive";
    }
    return "cottage616";
  }

  async function loadSlots(service) {
    return loadSlotsForDate(service, state.selectedDate);
  }

  async function loadSlotsForDate(service, date) {
    if (config.api?.enabled) {
      const params = new URLSearchParams({ serviceId: service.id, date });
      if (state.tierId) params.set("tierId", state.tierId);
      const staffId = selectedStaffId(service);
      if (staffId) params.set("staffId", staffId);
      const response = await apiRequest(`/availability?${params.toString()}`);
      return (response.diagnostics?.slots || []).map(normalizeSlot);
    }

    return demoSlots(service, date);
  }

  async function findEarliestAvailableDate(service, isCurrent = () => true) {
    const start = startOfDay(new Date());
    const maxAdvanceDays = Number(service.maxAdvanceDays || config.schedule?.maxAdvanceDays || 60);

    const batchDays = config.api?.enabled ? 14 : 1;
    for (let index = 0; index <= maxAdvanceDays; index += batchDays) {
      if (!isCurrent()) return null;
      const next = new Date(start);
      next.setDate(start.getDate() + index);
      const candidate = dateKey(next);
      if (config.api?.enabled) {
        const params = new URLSearchParams({ serviceId: service.id, date: candidate, days: String(Math.min(batchDays, maxAdvanceDays - index + 1)) });
        if (state.tierId) params.set("tierId", state.tierId);
        const staffId = selectedStaffId(service);
        if (staffId) params.set("staffId", staffId);
        const response = await apiRequest(`/availability?${params.toString()}`);
        if (response.nextAvailable) return { date: response.nextAvailable.date, slots: response.nextAvailable.slots.map(normalizeSlot) };
        continue;
      }
      const slots = await loadSlotsForDate(service, candidate);
      if (slots.length > 0) {
        return { date: candidate, slots };
      }
    }

    return null;
  }

  async function createBooking(payload) {
    if (config.api?.enabled) {
      return apiRequest("/bookings", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    await new Promise((resolve) => window.setTimeout(resolve, 450));
    return {
      ok: true,
      booking: {
        id: `demo-${Math.floor(Math.random() * 90000) + 10000}`,
        status: selectedService()?.requestOnly ? "PENDING" : "CONFIRMED",
        serviceId: payload.serviceId,
        staffId: payload.staffId || null,
        startsAt: payload.startsAt,
        endsAt: state.selectedSlot?.endsAt
      }
    };
  }

  async function apiRequest(path, options) {
    const api = config.api || {};
    const url = makeApiUrl(path);
    const headers = {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    };

    if (api.publishableKey) {
      if (api.sendKeyAsHeader !== false) {
        headers["X-Showrunner-Key"] = api.publishableKey;
      } else {
        url.searchParams.set("key", api.publishableKey);
      }
    }

    const response = await fetch(url.toString(), {
      ...options,
      headers
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }
    return payload.data || payload;
  }

  function makeApiUrl(path) {
    const base = String(config.api?.baseUrl || "/api/public/v1").replace(/\/$/, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (/^https?:\/\//i.test(base)) return new URL(`${base}${cleanPath}`);
    return new URL(`${base}${cleanPath}`, window.location.origin);
  }

  function normalizeImageUrl(value) {
    const url = String(value || "").trim();
    if (!url || /^(?:https?:|data:|blob:)/i.test(url)) return url;
    if (url.startsWith("/api/")) {
      const apiBase = String(config.api?.baseUrl || "").trim();
      if (/^https?:\/\//i.test(apiBase)) return new URL(url, apiBase).toString();
    }
    // CSS custom-property URLs otherwise resolve from the consuming stylesheet.
    return new URL(url, document.baseURI).href;
  }

  function normalizeServices(services) {
    return services
      .map((service, index) => ({
        id: String(service.id || service.slug || `service-${index}`),
        slug: service.slug || "",
        packages: Array.isArray(service.packages) ? service.packages : [],
        serviceRevision: service.serviceRevision,
        categoryId: service.categoryId || "general",
        categoryName: service.categoryName || "",
        name: service.name || "Untitled service",
        description: service.description || "",
        imageUrl: normalizeImageUrl(service.imageUrl),
        imagePositionX: Math.max(0, Math.min(100, Number(service.imagePositionX ?? 50) || 0)),
        imagePositionY: Math.max(0, Math.min(100, Number(service.imagePositionY ?? 50) || 0)),
        imageZoom: Math.max(1, Math.min(3, Number(service.imageZoom ?? 1) || 1)),
        durationMinutes: Number(service.durationMinutes || 0),
        priceCents: typeof service.priceCents === "number" ? service.priceCents : null,
        location: service.location || "",
        minimumNoticeHours: service.minimumNoticeHours,
        maxAdvanceDays: service.maxAdvanceDays,
        slotIntervalMinutes: service.slotIntervalMinutes,
        intakePrompt: service.intakePrompt || "",
        bookingRules: Array.isArray(service.bookingRules) ? service.bookingRules : null,
        bookingFormTitle: service.bookingFormTitle || "Session details",
        bookingTermsTitle: service.bookingTermsTitle || "Booking terms",
        bookingRequirementsRevision: service.bookingRequirementsRevision || "",
        policyText: service.policyText || "",
        requirePolicy: Boolean(service.requirePolicy),
        requestOnly: Boolean(service.requestOnly),
        waitlistEnabled: Boolean(service.waitlistEnabled),
        staff: Array.isArray(service.staff) ? service.staff : [],
        resources: Array.isArray(service.resources) ? service.resources : [],
        sort: Number.isFinite(Number(service.sort)) ? Number(service.sort) : index + 1
      }))
      .filter((service) => service.id && service.name);
  }

  function serviceById(serviceId) {
    return state.services.find((service) => service.id === serviceId) || null;
  }

  function normalizeCategories(categories, services) {
    const normalizedById = new Map();
    categories.forEach((category, index) => {
      const id = String(category.id || category.slug || `category-${index}`);
      const existing = normalizedById.get(id) || {};
      normalizedById.set(id, {
        ...existing,
        id,
        name: category.name || existing.name || "Services",
        description: category.description || existing.description || "",
        imageKey: category.imageKey || existing.imageKey || category.slug || category.id || "fallback",
        imageUrl: normalizeImageUrl(category.imageUrl || existing.imageUrl),
        sort: Number.isFinite(Number(category.sort)) ? Number(category.sort) : existing.sort || index + 1
      });
    });

    const known = new Set(normalizedById.keys());
    services.forEach((service) => {
      if (!known.has(service.categoryId)) {
        normalizedById.set(service.categoryId, {
          id: service.categoryId,
          name: service.categoryName || titleCase(service.categoryId),
          description: "Available services",
          imageKey: service.categoryId,
          imageUrl: "",
          sort: normalizedById.size + 1
        });
        known.add(service.categoryId);
      }
    });

    return Array.from(normalizedById.values()).filter(category => services.some(service => service.categoryId === category.id)).sort(sortBySortThenName);
  }

  function mergeServicePresentation(service) {
    const presentation = config.servicePresentation?.[service.id] || config.servicePresentation?.[service.slug] || {};
    return { ...service, ...presentation };
  }

  function normalizeSlot(slot) {
    return {
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      label: slot.label || formatTime(slot.startsAt),
      resourceIds: slot.resourceIds || [],
      resourceNames: slot.resourceNames || [],
      staffId: slot.staffId || "",
      staffName: slot.staffName || ""
    };
  }

  function demoSlots(service, selectedDate = state.selectedDate) {
    const selected = parseDateKey(selectedDate);
    const closed = config.schedule?.demoClosedWeekdays || [];
    if (closed.includes(selected.getDay())) return [];

    const startHour = Number(config.schedule?.demoStartHour || 9);
    const endHour = Number(config.schedule?.demoEndHour || 17);
    const interval = Number(config.schedule?.demoIntervalMinutes || service.slotIntervalMinutes || 30);
    const duration = Number(service.durationMinutes || 30);
    const slots = [];
    const selectedStaff = service.staff?.find((member) => member.id === state.staffId) || service.staff?.[0] || null;

    for (let minutes = startHour * 60; minutes + duration <= endHour * 60; minutes += interval) {
      const startsAt = new Date(selected);
      startsAt.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      if (startsAt < new Date()) continue;

      const endsAt = new Date(startsAt);
      endsAt.setMinutes(endsAt.getMinutes() + duration);

      const skipPattern = (startsAt.getDate() + startsAt.getHours() + startsAt.getMinutes() / 30) % 5 === 0;
      if (skipPattern) continue;

      slots.push({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        label: formatTime(startsAt),
        resourceIds: service.resources?.map((resource) => resource.id) || [],
        resourceNames: service.resources?.map((resource) => resource.name) || [],
        staffId: selectedStaff?.id || "",
        staffName: selectedStaff?.name || ""
      });
    }

    return slots.slice(0, 18);
  }

  function resetFlow() {
    state.activeStep = "categories";
    state.categoryId = null;
    state.categoryFocusId = "";
    state.serviceId = null;
    state.dateRailStart = null;
    state.selectedSlot = null;
    state.staffId = "";
    state.lastBooking = null;
    setFormStatus("");
    setAvailabilityStatus("");
    renderAll();
  }

  function selectedCategory() {
    return state.categories.find((category) => category.id === state.categoryId) || null;
  }

  function selectedService() {
    const service = serviceById(state.serviceId);
    const pack = service?.packages.find(pack => pack.id === state.tierId);
    if (!pack) return service;
    const extras = (pack.addOns || []).filter(extra => state.addOnIds.includes(extra.id));
    const priceCents = pack.priceCents == null ? null : pack.priceCents + extras.reduce((total, extra) => total + extra.priceCents * (state.addOnQuantities[extra.id] || 1), 0);
    const deliverables={...pack.deliverables};
    for(const extra of extras) for(const [key,count] of Object.entries(extra.deliverables||{})) if(deliverables[key]!==null) deliverables[key]=(deliverables[key]||0)+count*(state.addOnQuantities[extra.id]||1);
    const selectedExtras=extras.map(extra=>({...extra,quantity:state.addOnQuantities[extra.id]||1}));
    return { ...service, name: `${service.name} — ${pack.name}`, durationMinutes: pack.durationMinutes, unlimitedDuration: pack.unlimitedDuration, priceCents, addOns: pack.addOns, extras:selectedExtras, deliverables, coverage: pack.coverage };

  }

  function selectedStaffName() {
    const service = selectedService();
    if (!service || !state.staffId) return "";
    return service.staff?.find((member) => member.id === state.staffId)?.name || "";
  }

  function selectedStaffId(service) {
    if (state.staffId) return state.staffId;
    if (config.features?.autoSelectFirstStaff === false) return "";
    return service?.staff?.[0]?.id || "";
  }

  function servicesForCategory(categoryId) {
    return state.services.filter((service) => service.categoryId === categoryId);
  }

  function categoryMatchesQuery(category, query) {
    const categoryText = [category.name, category.description].filter(Boolean).join(" ").toLowerCase();
    if (categoryText.includes(query)) return true;
    return servicesForCategory(category.id).some((service) =>
      [service.name, service.description, service.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  function imageForCategory(category) {
    return normalizeImageUrl(
      category.imageUrl ||
      assets.categoryImages?.[category.imageKey] ||
      assets.categoryImages?.[category.id] ||
      assets.fallbackCategoryImage ||
      ""
    );
  }

  function sortServices(services, sort) {
    const sorted = [...services];
    if (sort === "name") return sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "duration") return sorted.sort((a, b) => a.durationMinutes - b.durationMinutes || a.name.localeCompare(b.name));
    if (sort === "price") {
      return sorted.sort((a, b) => (a.priceCents ?? Number.MAX_SAFE_INTEGER) - (b.priceCents ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
    }
    return sorted.sort(sortBySortThenName);
  }

  function sortBySortThenName(a, b) {
    return (a.sort || 0) - (b.sort || 0) || a.name.localeCompare(b.name);
  }

  function summaryMarkup(service, slot, bookingId) {
    const rows = [["Length", service.unlimitedDuration ? "Unlimited — rest of day reserved" : formatDuration(service.durationMinutes)]];
    for (const extra of service.extras || []) rows.push([extra.name, `${state.addOnQuantities[extra.id] || 1} × ${formatPrice(extra.priceCents)}`]);
    if (slot.staffName) rows.push(["Provider", slot.staffName]);
    if (bookingId) rows.push(["Reference", bookingId]);

    return `
      <h3 class="booking-summary-service">${escapeHtml(service.name)}</h3>
      <p class="booking-summary-when">
        <strong>${escapeHtml(formatLongDate(slot.startsAt))}</strong>
        <span>${escapeHtml(`${formatTime(slot.startsAt)} – ${service.unlimitedDuration ? "end of day" : formatTime(slot.endsAt)}`)}</span>
      </p>
      ${packageInclusionsMarkup(service.coverage)}
      <dl class="booking-summary-rows">
        ${rows
          .map(
            ([label, value]) => `
              <div>
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `
          )
          .join("")}
        <div class="booking-summary-total">
          <dt>Total</dt>
          <dd>${escapeHtml(formatPrice(service.priceCents))}</dd>
        </div>
      </dl>
    `;
  }

  function formatDuration(totalMinutes) {
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "Not specified";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!hours) return `${minutes} min`;

    const hourLabel = `${hours} ${hours === 1 ? "hr" : "hrs"}`;
    return minutes ? `${hourLabel} ${minutes} min` : hourLabel;
  }

  function formatPrice(cents) {
    if (cents === 0) return "Free";
    if (typeof cents !== "number" || Number.isNaN(cents)) return "Varies";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: config.currency || "USD"
    }).format(cents / 100);
  }

  function formatTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: config.business?.timezone
    }).format(date);
  }

  function formatLongDate(value) {
    const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateKey(value) : new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? undefined : config.business?.timezone
    }).format(date);
  }

  function formatMonthYear(value) {
    const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateKey(value) : new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function weekdayShort(date) {
    return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
  }

  function formatSlotTime(value) {
    return formatTime(value);
  }

  function formatFooterDate(value) {
    const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateKey(value) : new Date(value);
    const timeZone = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? undefined : config.business?.timezone;
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone }).format(date);
    const day = Number(new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone }).format(date));
    return `${weekday} ${day}${ordinalSuffix(day)}`;
  }

  function formatFooterTime(value) {
    return formatTime(value);
  }

  function ordinalSuffix(day) {
    if (day % 100 >= 11 && day % 100 <= 13) return "th";
    if (day % 10 === 1) return "st";
    if (day % 10 === 2) return "nd";
    if (day % 10 === 3) return "rd";
    return "th";
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateKey(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function startOfDay(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function titleCase(value) {
    return String(value || "services")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function initialSelectedDate() {
    const closed = config.schedule?.demoClosedWeekdays || [];
    const next = startOfDay(new Date());
    for (let index = 0; index < 14; index += 1) {
      if (!closed.includes(next.getDay())) return next;
      next.setDate(next.getDate() + 1);
    }
    return startOfDay(new Date());
  }

  function minBookableDateFor(service) {
    const noticeHours = Math.max(0, Number(service?.minimumNoticeHours || config.schedule?.minimumNoticeHours || 0));
    const noticeDays = Math.ceil(noticeHours / 24);
    const offsetDays = noticeDays > 0 ? noticeDays + 1 : 0;
    const next = startOfDay(new Date());
    next.setDate(next.getDate() + offsetDays);
    return next;
  }

  function setStatus(message, isError) {
    els.catalogStatus.textContent = message || "";
    els.catalogStatus.hidden = !message;
    els.catalogStatus.classList.toggle("is-error", Boolean(isError));
  }

  function setAvailabilityStatus(message, isError) {
    els.availabilityStatus.textContent = message || "";
    els.availabilityStatus.classList.toggle("is-error", Boolean(isError));
  }

  function setFormStatus(message, isError) {
    els.formStatus.textContent = message || "";
    els.formStatus.classList.toggle("is-error", Boolean(isError));
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value;
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

})();
