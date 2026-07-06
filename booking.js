const bookingRoot = document.querySelector("[data-booking]");

if (bookingRoot) {
  const apiBase = (bookingRoot.dataset.apiBase || "").replace(/\/$/, "");
  const apiKey = bookingRoot.dataset.apiKey || "";
  const timeZone = "America/Chicago";
  const stripVisibleDays = 14;

  const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone });
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone });
  const longDateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  });
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone });
  const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone });

  const els = {
    status: bookingRoot.querySelector("[data-booking-status]"),
    categoryFilter: bookingRoot.querySelector("[data-category-filter]"),
    serviceSelect: bookingRoot.querySelector("[data-service-select]"),
    serviceDetail: bookingRoot.querySelector("[data-service-detail]"),
    datePicker: bookingRoot.querySelector("[data-date-picker]"),
    timePicker: bookingRoot.querySelector("[data-time-picker]"),
    timeEmpty: bookingRoot.querySelector("[data-time-empty]"),
    notice: bookingRoot.querySelector("[data-booking-notice]"),
    earliestDate: bookingRoot.querySelector("[data-earliest-date]"),
    calendar: bookingRoot.querySelector("[data-calendar]"),
    calendarGrid: bookingRoot.querySelector("[data-calendar-grid]"),
    calendarMonthLabel: bookingRoot.querySelector("[data-calendar-month]"),
    calendarToggle: bookingRoot.querySelector("[data-calendar-toggle]"),
    calendarClose: bookingRoot.querySelector("[data-calendar-close]"),
    summary: bookingRoot.querySelector("[data-booking-summary]"),
    continueButton: bookingRoot.querySelector("[data-booking-continue]"),
    form: bookingRoot.querySelector("[data-booking-form]"),
    policyField: bookingRoot.querySelector("[data-policy-field]"),
    policyText: bookingRoot.querySelector("[data-policy-text]"),
    submitButton: bookingRoot.querySelector("[data-submit-booking]"),
    formStatus: bookingRoot.querySelector("[data-form-status]"),
  };

  const state = {
    services: [],
    categories: [],
    categoryId: "",
    serviceId: "",
    minBookableDate: startOfDay(new Date()),
    initialStripStart: startOfDay(new Date()),
    stripStartDate: startOfDay(new Date()),
    selectedDate: startOfDay(new Date()),
    selectedSlot: null,
    slots: [],
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    slotRequestKey: "",
  };

  bindEvents();
  init();

  async function init() {
    if (!apiBase || !apiKey) {
      setStatus("Booking is not connected yet.", true);
      return;
    }

    setStatus("Loading Cottage 616 services...");

    try {
      const response = await apiRequest("/services");
      state.services = normalizeServices(response.services || []);
      state.categories = buildCategories(state.services);

      if (!state.services.length) {
        setStatus("No bookable services are available yet.", true);
        renderAll();
        return;
      }

      els.categoryFilter.disabled = false;
      els.serviceSelect.disabled = false;
      populateCategories();
      populateServices();
      selectService(state.services[0].id, { resetDate: true });
      setStatus("");
    } catch (error) {
      setStatus(error.message || "Services could not load.", true);
      els.serviceSelect.innerHTML = '<option value="">Services unavailable</option>';
      renderAll();
    }
  }

  function bindEvents() {
    els.categoryFilter?.addEventListener("change", () => {
      state.categoryId = els.categoryFilter.value;
      populateServices();
      const nextService = filteredServices()[0];
      selectService(nextService?.id || "", { resetDate: true });
    });

    els.serviceSelect?.addEventListener("change", () => {
      selectService(els.serviceSelect.value, { resetDate: true });
    });

    bookingRoot.querySelector("[data-date-prev]")?.addEventListener("click", () => {
      if (state.stripStartDate <= state.initialStripStart) {
        setNotice("That is the earliest available booking window.");
        return;
      }

      shiftDateStrip(-1);
      setNotice("");
    });

    bookingRoot.querySelector("[data-date-next]")?.addEventListener("click", () => {
      shiftDateStrip(1);
      setNotice("");
    });

    els.calendarToggle?.addEventListener("click", () => {
      if (els.calendar.hidden) {
        openCalendar();
        return;
      }

      closeCalendar();
    });

    els.calendarClose?.addEventListener("click", closeCalendar);

    els.calendar?.addEventListener("click", (event) => {
      if (event.target === els.calendar) {
        closeCalendar();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && els.calendar && !els.calendar.hidden) {
        closeCalendar();
      }
    });

    bookingRoot.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
      state.calendarMonth = addMonths(state.calendarMonth, -1);
      renderCalendar();
    });

    bookingRoot.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
      state.calendarMonth = addMonths(state.calendarMonth, 1);
      renderCalendar();
    });

    els.continueButton?.addEventListener("click", () => {
      els.form?.scrollIntoView({ behavior: "smooth", block: "start" });
      els.form?.querySelector("input[name='customerName']")?.focus({ preventScroll: true });
    });

    els.form?.addEventListener("submit", submitBooking);
  }

  function populateCategories() {
    els.categoryFilter.innerHTML = [
      '<option value="">All Cottage 616 services</option>',
      ...state.categories.map(
        (category) => `<option value="${escapeAttribute(category.id)}">${escapeHtml(category.name)}</option>`
      ),
    ].join("");
    els.categoryFilter.value = state.categoryId;
  }

  function populateServices() {
    const services = filteredServices();
    els.serviceSelect.innerHTML = services.length
      ? services
          .map((service) => `<option value="${escapeAttribute(service.id)}">${escapeHtml(service.name)}</option>`)
          .join("")
      : '<option value="">No services in this category</option>';
  }

  function selectService(serviceId, options = {}) {
    state.serviceId = serviceId;
    state.selectedSlot = null;
    state.slots = [];

    if (els.serviceSelect) {
      els.serviceSelect.value = serviceId;
    }

    const service = selectedService();
    if (service && options.resetDate) {
      state.minBookableDate = minBookableDateFor(service);
      state.initialStripStart = new Date(state.minBookableDate);
      state.stripStartDate = new Date(state.minBookableDate);
      state.selectedDate = new Date(state.minBookableDate);
      state.calendarMonth = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
    }

    renderAll();
    if (service) {
      loadAndRenderSlots();
    }
  }

  function renderAll() {
    renderServiceDetail();
    renderDateStrip();
    renderTimes();
    renderCalendar();
    renderPolicy();
    updateSummary();
  }

  function renderServiceDetail() {
    const service = selectedService();
    if (!service || !els.serviceDetail) {
      if (els.serviceDetail) els.serviceDetail.hidden = true;
      return;
    }

    const price = formatPrice(service.priceCents);
    const requestLabel = service.requestOnly ? "Request only" : "Instant confirmation when available";
    els.serviceDetail.hidden = false;
    els.serviceDetail.innerHTML = `
      <div>
        <strong>${escapeHtml(service.name)}</strong>
        <span>${escapeHtml(service.description || "Cottage 616 booking")}</span>
      </div>
      <dl>
        <div><dt>Length</dt><dd>${service.durationMinutes || 0} min</dd></div>
        <div><dt>Price</dt><dd>${escapeHtml(price)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(requestLabel)}</dd></div>
      </dl>
    `;
  }

  function renderDateStrip() {
    if (!els.datePicker) return;
    els.datePicker.innerHTML = "";

    if (!selectedService()) {
      if (els.earliestDate) els.earliestDate.textContent = "Choose a service to see availability.";
      return;
    }

    if (els.earliestDate) {
      els.earliestDate.textContent = `Earliest booking: ${longDateFormatter.format(state.minBookableDate)}`;
    }

    Array.from({ length: stripVisibleDays }, (_, index) => buildDateOption(addDays(state.stripStartDate, index))).forEach(
      (dateOption) => {
        const button = document.createElement("button");
        button.className = [
          "date-option",
          isSameDate(state.selectedDate, dateOption.date) ? "date-option--selected" : "",
          !dateOption.isBookable ? "date-option--disabled" : "",
        ]
          .filter(Boolean)
          .join(" ");
        button.type = "button";
        button.setAttribute("aria-pressed", String(isSameDate(state.selectedDate, dateOption.date)));
        button.setAttribute("aria-disabled", String(!dateOption.isBookable));
        button.innerHTML = `<span>${dateOption.weekday}</span><strong>${dateOption.label}</strong>`;
        button.addEventListener("click", () => selectDate(dateOption));
        els.datePicker.append(button);
      }
    );
  }

  function renderTimes() {
    if (!els.timePicker) return;
    els.timePicker.innerHTML = "";

    if (!selectedService()) {
      els.timeEmpty.hidden = true;
      return;
    }

    els.timeEmpty.hidden = state.slots.length > 0 || Boolean(state.slotRequestKey);
    state.slots.forEach((slot, index) => {
      const button = document.createElement("button");
      button.className = `time-option ${state.selectedSlot?.startsAt === slot.startsAt ? "time-option--selected" : ""}`.trim();
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.selectedSlot?.startsAt === slot.startsAt));
      button.textContent = formatSlotTime(slot.startsAt);
      button.addEventListener("click", () => {
        state.selectedSlot = slot;
        renderTimes();
        updateSummary();
      });
      els.timePicker.append(button);
    });
  }

  function renderCalendar() {
    if (!els.calendarGrid || !els.calendarMonthLabel) return;
    els.calendarMonthLabel.textContent = monthFormatter.format(state.calendarMonth);
    els.calendarGrid.innerHTML = "";

    buildCalendarDates().forEach((dateOption) => {
      const button = document.createElement("button");
      button.className = [
        "booking-calendar__day",
        !dateOption.isCurrentMonth ? "booking-calendar__day--outside" : "",
        !dateOption.isBookable ? "booking-calendar__day--disabled" : "",
        isSameDate(state.selectedDate, dateOption.date) ? "booking-calendar__day--selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      button.type = "button";
      button.setAttribute("aria-pressed", String(isSameDate(state.selectedDate, dateOption.date)));
      button.setAttribute("aria-disabled", String(!dateOption.isBookable));
      button.textContent = dateOption.day;
      button.addEventListener("click", () => {
        selectDate(dateOption);
        if (dateOption.isBookable) {
          state.stripStartDate = new Date(dateOption.date);
          closeCalendar();
        }
      });
      els.calendarGrid.append(button);
    });
  }

  function renderPolicy() {
    const service = selectedService();
    const checkbox = els.policyField?.querySelector("input");
    if (!service?.policyText || !els.policyField || !els.policyText || !checkbox) {
      if (els.policyField) els.policyField.hidden = true;
      return;
    }

    els.policyField.hidden = false;
    els.policyText.textContent = service.policyText;
    checkbox.required = Boolean(service.requirePolicy);
  }

  function selectDate(dateOption) {
    if (!dateOption.isBookable) {
      setNotice("That date is outside the booking window.");
      return;
    }

    state.selectedDate = new Date(dateOption.date);
    state.selectedSlot = null;
    setNotice("");
    renderDateStrip();
    renderCalendar();
    updateSummary();
    loadAndRenderSlots();
  }

  function shiftDateStrip(days) {
    state.stripStartDate = addDays(state.stripStartDate, days);
    if (state.stripStartDate < state.initialStripStart) {
      state.stripStartDate = new Date(state.initialStripStart);
    }
    els.datePicker.classList.remove("is-shifting");
    renderDateStrip();
    requestAnimationFrame(() => {
      els.datePicker.classList.add("is-shifting");
    });
  }

  async function loadAndRenderSlots() {
    const service = selectedService();
    if (!service) return;

    const requestKey = `${service.id}:${dateId(state.selectedDate)}`;
    state.slotRequestKey = requestKey;
    state.slots = [];
    state.selectedSlot = null;
    renderTimes();
    updateSummary();
    setNotice("Checking availability...");

    const params = new URLSearchParams({
      serviceId: service.id,
      date: dateId(state.selectedDate),
    });
    const staffId = service.staff[0]?.id || "";
    if (staffId) {
      params.set("staffId", staffId);
    }

    try {
      const response = await apiRequest(`/availability?${params.toString()}`);
      if (state.slotRequestKey !== requestKey) return;
      state.slots = (response.diagnostics?.slots || []).map(normalizeSlot);
      state.slotRequestKey = "";
      setNotice(state.slots.length ? "" : "No times are available for this date.");
      renderTimes();
      updateSummary();
    } catch (error) {
      if (state.slotRequestKey !== requestKey) return;
      state.slotRequestKey = "";
      state.slots = [];
      setNotice(error.message || "Availability could not load.");
      renderTimes();
      updateSummary();
    }
  }

  async function submitBooking(event) {
    event.preventDefault();
    const service = selectedService();
    const slot = state.selectedSlot;
    if (!service || !slot) {
      setFormStatus("Choose a service, date, and time first.", true);
      return;
    }

    const formData = new FormData(els.form);
    const notes = String(formData.get("notes") || "").trim();
    const payload = {
      serviceId: service.id,
      staffId: slot.staffId || service.staff[0]?.id || undefined,
      resourceIds: slot.resourceIds?.length ? slot.resourceIds : service.resources.map((resource) => resource.id),
      startsAt: slot.startsAt,
      customerName: String(formData.get("customerName") || "").trim(),
      customerEmail: String(formData.get("customerEmail") || "").trim(),
      customerPhone: String(formData.get("customerPhone") || "").trim(),
      notes,
      intakeResponse: service.intakePrompt ? notes : "",
      policyAccepted: formData.get("policyAccepted") === "on",
      companyWebsite: String(formData.get("companyWebsite") || ""),
    };

    setFormStatus("Sending...");
    els.submitButton.disabled = true;

    try {
      const result = await apiRequest("/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const bookingId = result.booking?.id ? ` Reference: ${result.booking.id}.` : "";
      setFormStatus(
        service.requestOnly
          ? `Your request was sent to Cottage 616.${bookingId}`
          : `You're booked. A confirmation email is on its way.${bookingId}`
      );
      els.form.reset();
      state.selectedSlot = null;
      loadAndRenderSlots();
    } catch (error) {
      setFormStatus(error.message || "Booking could not be completed.", true);
    } finally {
      els.submitButton.disabled = !state.selectedSlot;
      updateSummary();
    }
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Showrunner-Key": apiKey,
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || payload.message || "Request failed.");
    }
    return payload.data || payload;
  }

  function updateSummary() {
    const service = selectedService();
    const hasSlot = Boolean(service && state.selectedSlot);

    if (!service) {
      els.summary.textContent = "Choose a service to begin";
    } else if (state.selectedSlot) {
      els.summary.textContent = `${service.name}, ${formatLongDate(state.selectedSlot.startsAt)} at ${formatSlotTime(
        state.selectedSlot.startsAt
      )}`;
    } else {
      els.summary.textContent = `${service.name}, ${longDateFormatter.format(state.selectedDate)}, time pending`;
    }

    els.continueButton.disabled = !hasSlot;
    els.submitButton.disabled = !hasSlot;
    if (service) {
      els.submitButton.textContent = service.requestOnly ? "Send request" : "Confirm booking";
    }
  }

  function buildDateOption(date) {
    return {
      date,
      weekday: weekdayFormatter.format(date),
      label: dateFormatter.format(date),
      day: date.getDate(),
      isBookable: date >= state.minBookableDate,
      isCurrentMonth: date.getMonth() === state.calendarMonth.getMonth(),
    };
  }

  function buildCalendarDates() {
    const firstDay = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
    const gridStart = addDays(firstDay, -firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const option = buildDateOption(addDays(gridStart, index));
      return { ...option, isCurrentMonth: option.date.getMonth() === state.calendarMonth.getMonth() };
    });
  }

  function filteredServices() {
    if (!state.categoryId) return state.services;
    return state.services.filter((service) => service.categoryId === state.categoryId);
  }

  function selectedService() {
    return state.services.find((service) => service.id === state.serviceId) || null;
  }

  function normalizeServices(services) {
    return services
      .map((service, index) => ({
        id: String(service.id || service.slug || `service-${index}`),
        slug: service.slug || "",
        categoryId: service.categoryId || "general",
        categoryName: service.categoryName || service.categoryId || "Services",
        name: service.name || "Untitled service",
        description: service.description || "",
        durationMinutes: Number(service.durationMinutes || 0),
        priceCents: typeof service.priceCents === "number" ? service.priceCents : null,
        minimumNoticeHours: Number(service.minimumNoticeHours || 24),
        maxAdvanceDays: Number(service.maxAdvanceDays || 180),
        intakePrompt: service.intakePrompt || "",
        policyText: service.policyText || "",
        requirePolicy: Boolean(service.requirePolicy),
        requestOnly: Boolean(service.requestOnly),
        staff: Array.isArray(service.staff) ? service.staff : [],
        resources: Array.isArray(service.resources) ? service.resources : [],
        sort: Number.isFinite(Number(service.sort)) ? Number(service.sort) : index + 1,
      }))
      .filter((service) => service.id && service.name)
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  }

  function buildCategories(services) {
    const byId = new Map();
    services.forEach((service) => {
      if (!byId.has(service.categoryId)) {
        byId.set(service.categoryId, {
          id: service.categoryId,
          name: titleCase(service.categoryName || service.categoryId),
        });
      }
    });
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function normalizeSlot(slot) {
    return {
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      staffId: slot.staffId || "",
      staffName: slot.staffName || "",
      resourceIds: Array.isArray(slot.resourceIds) ? slot.resourceIds : [],
      resourceNames: Array.isArray(slot.resourceNames) ? slot.resourceNames : [],
    };
  }

  function minBookableDateFor(service) {
    const noticeHours = Math.max(0, Number(service.minimumNoticeHours || 24));
    return startOfDay(new Date(Date.now() + noticeHours * 60 * 60 * 1000));
  }

  function setStatus(message, isError = false) {
    if (!els.status) return;
    els.status.textContent = message || "";
    els.status.hidden = !message;
    els.status.classList.toggle("booking-status--error", Boolean(isError));
  }

  function setNotice(message) {
    els.notice.textContent = message;
    els.notice.classList.toggle("booking-notice--visible", Boolean(message));
  }

  function setFormStatus(message, isError = false) {
    els.formStatus.textContent = message || "";
    els.formStatus.classList.toggle("booking-form-status--error", Boolean(isError));
  }

  function openCalendar() {
    els.calendar.hidden = false;
    els.calendarToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("is-modal-open");
  }

  function closeCalendar() {
    els.calendar.hidden = true;
    els.calendarToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-modal-open");
  }

  function formatSlotTime(value) {
    return timeFormatter.format(new Date(value));
  }

  function formatLongDate(value) {
    return longDateFormatter.format(new Date(value));
  }

  function formatPrice(cents) {
    if (cents === 0) return "Free";
    if (typeof cents !== "number" || Number.isNaN(cents)) return "Varies";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }

  function titleCase(value) {
    return String(value || "Services")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  function addMonths(date, months) {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  function dateId(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function isSameDate(left, right) {
    return dateId(left) === dateId(right);
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
}
