const bookingForm = document.querySelector("[data-booking]");

if (bookingForm) {
  const availableTimes = ["9:00 AM", "10:30 AM", "12:00 PM", "2:00 PM", "3:30 PM", "5:00 PM"];
  const advanceBookingDays = 14;
  const stripBeforeBookableDays = 2;
  const stripVisibleDays = 14;
  const advanceBookingMessage = "Bookings must be made at least 2 weeks in advance.";

  const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  const longDateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

  const datePicker = bookingForm.querySelector("[data-date-picker]");
  const timePicker = bookingForm.querySelector("[data-time-picker]");
  const notice = bookingForm.querySelector("[data-booking-notice]");
  const earliestDate = bookingForm.querySelector("[data-earliest-date]");
  const calendar = bookingForm.querySelector("[data-calendar]");
  const calendarGrid = bookingForm.querySelector("[data-calendar-grid]");
  const calendarMonthLabel = bookingForm.querySelector("[data-calendar-month]");
  const calendarToggle = bookingForm.querySelector("[data-calendar-toggle]");
  const calendarClose = bookingForm.querySelector("[data-calendar-close]");
  const summary = bookingForm.querySelector("[data-booking-summary]");
  const continueButton = bookingForm.querySelector("[data-booking-continue]");
  const dateInput = bookingForm.querySelector("[data-booking-date-input]");
  const timeInput = bookingForm.querySelector("[data-booking-time-input]");
  const firstField = bookingForm.querySelector("[data-booking-first-field]");

  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const addDays = (date, days) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  };
  const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1);
  const dateId = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const buildDateOption = (date) => ({
    id: dateId(date),
    date,
    weekday: weekdayFormatter.format(date),
    label: dateFormatter.format(date),
    day: date.getDate(),
    longLabel: longDateFormatter.format(date),
    isBookable: date >= state.minBookableDate,
  });
  const buildCalendarDates = () => {
    const firstDay = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
    const gridStart = addDays(firstDay, -firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const option = buildDateOption(addDays(gridStart, index));
      return { ...option, isCurrentMonth: option.date.getMonth() === state.calendarMonth.getMonth() };
    });
  };
  const setNotice = (message) => {
    notice.textContent = message;
    notice.classList.toggle("booking-notice--visible", Boolean(message));
  };
  const openCalendar = () => {
    calendar.hidden = false;
    calendarToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("is-modal-open");
  };
  const closeCalendar = () => {
    calendar.hidden = true;
    calendarToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-modal-open");
  };

  const today = startOfDay(new Date());
  const minBookableDate = addDays(today, advanceBookingDays);
  const state = {
    minBookableDate,
    initialStripStart: addDays(minBookableDate, -stripBeforeBookableDays),
    stripStartDate: addDays(minBookableDate, -stripBeforeBookableDays),
    selectedDate: null,
    selectedTime: "",
    calendarMonth: new Date(minBookableDate.getFullYear(), minBookableDate.getMonth(), 1),
  };

  state.selectedDate = buildDateOption(minBookableDate);
  earliestDate.textContent = `Earliest booking: ${state.selectedDate.longLabel}`;

  const updateSummary = () => {
    dateInput.value = state.selectedDate.longLabel;
    timeInput.value = state.selectedTime;
    summary.textContent = state.selectedTime
      ? `${state.selectedDate.longLabel} at ${state.selectedTime}`
      : `${state.selectedDate.longLabel}, time pending`;
    continueButton.disabled = !state.selectedTime;
  };

  const selectDate = (dateOption) => {
    if (!dateOption.isBookable) {
      setNotice(advanceBookingMessage);
      return;
    }

    state.selectedDate = dateOption;
    state.selectedTime = "";
    setNotice("");
    render();
  };

  const renderDateStrip = () => {
    datePicker.innerHTML = "";

    Array.from({ length: stripVisibleDays }, (_, index) => buildDateOption(addDays(state.stripStartDate, index)))
      .forEach((dateOption) => {
        const button = document.createElement("button");
        button.className = [
          "date-option",
          state.selectedDate.id === dateOption.id ? "date-option--selected" : "",
          !dateOption.isBookable ? "date-option--disabled" : "",
        ].filter(Boolean).join(" ");
        button.type = "button";
        button.setAttribute("aria-pressed", String(state.selectedDate.id === dateOption.id));
        button.setAttribute("aria-disabled", String(!dateOption.isBookable));
        button.innerHTML = `<span>${dateOption.weekday}</span><strong>${dateOption.label}</strong>`;
        button.addEventListener("click", () => selectDate(dateOption));
        datePicker.append(button);
      });
  };

  const renderTimes = () => {
    timePicker.innerHTML = "";

    availableTimes.forEach((time) => {
      const button = document.createElement("button");
      button.className = `time-option ${state.selectedTime === time ? "time-option--selected" : ""}`.trim();
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.selectedTime === time));
      button.textContent = time;
      button.addEventListener("click", () => {
        state.selectedTime = time;
        render();
      });
      timePicker.append(button);
    });
  };

  const renderCalendar = () => {
    calendarMonthLabel.textContent = monthFormatter.format(state.calendarMonth);
    calendarGrid.innerHTML = "";

    buildCalendarDates().forEach((dateOption) => {
      const button = document.createElement("button");
      button.className = [
        "booking-calendar__day",
        !dateOption.isCurrentMonth ? "booking-calendar__day--outside" : "",
        !dateOption.isBookable ? "booking-calendar__day--disabled" : "",
        state.selectedDate.id === dateOption.id ? "booking-calendar__day--selected" : "",
      ].filter(Boolean).join(" ");
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.selectedDate.id === dateOption.id));
      button.setAttribute("aria-disabled", String(!dateOption.isBookable));
      button.textContent = dateOption.day;
      button.addEventListener("click", () => {
        selectDate(dateOption);
        if (dateOption.isBookable) {
          state.stripStartDate = dateOption.date;
          closeCalendar();
        }
      });
      calendarGrid.append(button);
    });
  };

  const render = () => {
    renderDateStrip();
    renderTimes();
    renderCalendar();
    updateSummary();
  };

  bookingForm.querySelector("[data-date-prev]").addEventListener("click", () => {
    if (state.stripStartDate <= state.initialStripStart) {
      setNotice(advanceBookingMessage);
      return;
    }

    state.stripStartDate = addDays(state.stripStartDate, -7);
    setNotice("");
    renderDateStrip();
  });

  bookingForm.querySelector("[data-date-next]").addEventListener("click", () => {
    state.stripStartDate = addDays(state.stripStartDate, 7);
    setNotice("");
    renderDateStrip();
  });

  calendarToggle.addEventListener("click", () => {
    if (calendar.hidden) {
      openCalendar();
      return;
    }

    closeCalendar();
  });

  calendarClose.addEventListener("click", closeCalendar);

  calendar.addEventListener("click", (event) => {
    if (event.target === calendar) {
      closeCalendar();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !calendar.hidden) {
      closeCalendar();
    }
  });

  bookingForm.querySelector("[data-calendar-prev]").addEventListener("click", () => {
    state.calendarMonth = addMonths(state.calendarMonth, -1);
    renderCalendar();
  });

  bookingForm.querySelector("[data-calendar-next]").addEventListener("click", () => {
    state.calendarMonth = addMonths(state.calendarMonth, 1);
    renderCalendar();
  });

  continueButton.addEventListener("click", () => {
    if (!firstField) {
      return;
    }

    firstField.focus();
    firstField.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  render();
}
