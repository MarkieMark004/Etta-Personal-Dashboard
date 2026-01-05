const HOLIDAYS_BY_YEAR = {
  2025: [
    {
      startDate: "2025-12-25",
      endDate: "2025-12-25",
      title: "Christmas Day",
      isHoliday: true,
    },
    {
      startDate: "2025-12-26",
      endDate: "2025-12-26",
      title: "Boxing Day",
      isHoliday: true,
    },
  ],
  2026: [
    {
      startDate: "2026-01-01",
      endDate: "2026-01-01",
      title: "New Year's Day",
      isHoliday: true,
    },
    {
      startDate: "2026-01-02",
      endDate: "2026-01-02",
      title: "Day after New Year's Day",
      isHoliday: true,
    },

    {
      startDate: "2026-02-06",
      endDate: "2026-02-06",
      title: "Waitangi Day",
      isHoliday: true,
    },

    {
      startDate: "2026-04-03",
      endDate: "2026-04-03",
      title: "Good Friday",
      isHoliday: true,
    },
    {
      startDate: "2026-04-06",
      endDate: "2026-04-06",
      title: "Easter Monday",
      isHoliday: true,
    },
    {
      startDate: "2026-04-27",
      endDate: "2026-04-27",
      title: "ANZAC Day (observed)",
      isHoliday: true,
    }, // adjust if needed

    {
      startDate: "2026-06-01",
      endDate: "2026-06-01",
      title: "King's Birthday",
      isHoliday: true,
    },

    {
      startDate: "2026-10-26",
      endDate: "2026-10-26",
      title: "Labour Day",
      isHoliday: true,
    },

    {
      startDate: "2026-12-25",
      endDate: "2026-12-25",
      title: "Christmas Day",
      isHoliday: true,
    },
    {
      startDate: "2026-12-28",
      endDate: "2026-12-28",
      title: "Boxing Day (observed)",
      isHoliday: true,
    },
  ],
};

let clickTimer = null;
const CLICK_DELAY = 220; // ms

// Calendar with localStorage events + theme toggle sync
let isDragging = false;
let dragStartISO = null;
let dragEndISO = null;

const $ = (sel) => document.querySelector(sel);

const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

// ---------- Mobile sidebar ----------
function setupSidebarToggle() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.querySelector(".sidebar-toggle");
  if (!sidebar || !toggle) return;

  toggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  const navLinks = sidebar.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 980px)").matches) {
        sidebar.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  });
}

setupSidebarToggle();

const EVENTS_KEY = "calendarEvents_v1";

let viewDate = new Date();
let selectedDateISO = null;

const monthLabel = $("#monthLabel");
const calGrid = $("#calGrid");

const selectedDayLabel = $("#selectedDayLabel");
const dayEvents = $("#dayEvents");

const prevMonthBtn = $("#prevMonth");
const nextMonthBtn = $("#nextMonth");
const todayBtn = $("#todayBtn");
const addEventBtn = $("#addEventBtn");

// modal
const modal = $("#eventModal");
const backdrop = $("#modalBackdrop");
const closeModalBtn = $("#closeModalBtn");
const cancelBtn = $("#cancelBtn");
const saveBtn = $("#saveBtn");

const eventStartDate = $("#eventStartDate");
const eventEndDate = $("#eventEndDate");
const eventTitle = $("#eventTitle");
const eventStart = $("#eventStart");
const eventEnd = $("#eventEnd");
const eventNotes = $("#eventNotes");
const calendarCard = $("#calendarCard");
const eventColor = $("#eventColor");

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function getEvents() {
  return storage.get(EVENTS_KEY, []);
}

function setEvents(events) {
  storage.set(EVENTS_KEY, events);
}

function yearFromISO(iso) {
  return Number(iso.slice(0, 4));
}

function getHolidaysForYear(year) {
  return HOLIDAYS_BY_YEAR[year] ? [...HOLIDAYS_BY_YEAR[year]] : [];
}

function getAllEventsForView() {
  const year = viewDate.getFullYear();
  return [...getEvents(), ...getHolidaysForYear(year)];
}

function eventsForDate(iso) {
  const year = yearFromISO(iso);

  const all = [...getEvents(), ...getHolidaysForYear(year)];

  return all
    .filter((e) => {
      const start = e.startDate || e.date;
      const end = e.endDate || e.date;
      return iso >= start && iso <= end;
    })
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
}

function formatMonthLabel(d) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(d);
}

function openModalWithRange(startISO, endISO) {
  eventStartDate.value = startISO;
  eventEndDate.value = endISO;

  eventTitle.value = "";
  eventStart.value = "";
  eventEnd.value = "";
  eventColor.value = "#00b5d9";
  eventNotes.value = "";

  backdrop.classList.add("show");
  modal.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  modal.setAttribute("aria-hidden", "false");

  setTimeout(() => eventTitle.focus(), 0);
}

function closeModal() {
  backdrop.classList.remove("show");
  modal.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
  modal.setAttribute("aria-hidden", "true");

  clearRangeHighlight();
}

function render() {
  monthLabel.textContent = formatMonthLabel(viewDate);
  calGrid.innerHTML = "";

  const start = startOfMonth(viewDate);
  const end = endOfMonth(viewDate);

  // Calendar grid starts on Sunday (0)
  const startDay = start.getDay();

  // We render 42 cells (6 weeks) for consistent layout
  const firstCellDate = new Date(start);
  firstCellDate.setDate(start.getDate() - startDay);

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(firstCellDate);
    cellDate.setDate(firstCellDate.getDate() + i);

    const iso = toISODate(cellDate);
    const isOutside = cellDate.getMonth() !== viewDate.getMonth();
    const isSelected = iso === selectedDateISO;

    const cell = document.createElement("div");
    cell.className = `day ${isOutside ? "outside" : ""} ${
      isSelected ? "selected" : ""
    }`;
    cell.dataset.date = iso;

    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = cellDate.getDate();

    const pills = document.createElement("div");
    pills.className = "pills";

    const evs = eventsForDate(iso);
    const show = evs.slice(0, 2);
    for (const e of show) {
      const pill = document.createElement("div");
      pill.className = e.isHoliday ? "pill holiday" : "pill";

      pill.textContent = e.start ? `${e.start} ${e.title}` : e.title;
      pill.title = pill.textContent;

      // Apply color only for non-holiday events
      if (!e.isHoliday && e.color) {
        pill.style.borderColor = e.color;
        pill.style.backgroundColor = e.color;
        pill.style.color = "#fff";
      }

      pill.title = pill.textContent;
      pills.appendChild(pill);
    }
    if (evs.length > 2) {
      const more = document.createElement("div");
      more.className = "pill";
      more.textContent = `+${evs.length - 2} more`;
      pills.appendChild(more);
    }

    cell.appendChild(num);
    cell.appendChild(pills);

    cell.addEventListener("pointerdown", () => {
      isDragging = false;
      dragStartISO = iso;
      dragEndISO = iso;

      clearRangeHighlight();
    });

    cell.addEventListener("pointerenter", () => {
      if (dragStartISO) {
        isDragging = true;
        dragEndISO = iso;
        clearRangeHighlight();
        highlightRange(dragStartISO, dragEndISO);
      }
    });

    cell.addEventListener("pointerup", () => {
      if (isDragging) {
        const [start, end] = normalizeRange(dragStartISO, dragEndISO);
        openModalWithRange(start, end);
        clearRangeHighlight();
      }

      dragStartISO = null;
      dragEndISO = null;
      isDragging = false;
    });

    cell.addEventListener("click", () => {
      if (isDragging) return;

      selectedDateISO = iso;
      render();

      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {}, 0);
    });

    cell.addEventListener("dblclick", () => {
      clearTimeout(clickTimer);
      selectedDateISO = iso;
      render();
      openModalWithRange(iso, iso);
    });

    calGrid.appendChild(cell);
  }

  renderSelectedDay();
}
function renderSelectedDay() {
  if (!selectedDateISO) {
    selectedDayLabel.textContent = "None";
    dayEvents.textContent = "Click a day to view events.";
    dayEvents.classList.add("muted");
    return;
  }

  selectedDayLabel.textContent = selectedDateISO;

  const evs = eventsForDate(selectedDateISO);
  dayEvents.innerHTML = "";
  dayEvents.classList.remove("muted");

  if (!evs.length) {
    dayEvents.textContent =
      "No events for this day. Click “+ Add Event” to create one.";
    dayEvents.classList.add("muted");
    return;
  }

  for (const e of evs) {
    const row = document.createElement("div");
    row.className = "event-row";

    const left = document.createElement("div");
    left.className = "event-left";

    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = e.title;

    const meta = document.createElement("div");
    meta.className = "event-meta";

    const time =
      e.start || e.end
        ? `${e.start || ""}${e.start && e.end ? "–" : ""}${e.end || ""}`
        : "No time";

    const range =
      e.startDate === e.endDate ? e.startDate : `${e.startDate} → ${e.endDate}`;

    meta.textContent = `${range} • ${time}${e.notes ? " • " + e.notes : ""}`;

    left.appendChild(title);
    left.appendChild(meta);
    row.appendChild(left);

    if (!e.isHoliday && e.color) {
      row.style.borderColor = e.color;
    }

    if (!e.isHoliday && e.color) {
      const dot = document.createElement("span");
      dot.style.width = "10px";
      dot.style.height = "10px";
      dot.style.borderRadius = "999px";
      dot.style.background = e.color;
      dot.style.display = "inline-block";
      dot.style.flex = "0 0 auto";
      row.appendChild(dot);
    }

    if (!e.isHoliday) {
      const del = document.createElement("button");
      del.className = "icon-btn";
      del.type = "button";
      del.textContent = "🗑️";
      del.title = "Delete event";
      del.addEventListener("click", () => {
        const events = getEvents().filter((x) => x.id !== e.id);
        setEvents(events);
        render();
      });

      row.appendChild(del);
    }

    dayEvents.appendChild(row);
  }
}

function normalizeRange(a, b) {
  return a <= b ? [a, b] : [b, a];
}

function clearRangeHighlight() {
  document
    .querySelectorAll(".day.in-range")
    .forEach((d) => d.classList.remove("in-range"));
}

function highlightRange(startISO, endISO) {
  const [start, end] = normalizeRange(startISO, endISO);

  document.querySelectorAll(".day").forEach((day) => {
    const d = day.dataset.date;
    if (d >= start && d <= end) {
      day.classList.add("in-range");
    }
  });
}

// Navigation
prevMonthBtn.addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  render();
});

nextMonthBtn.addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  render();
});

todayBtn.addEventListener("click", () => {
  const now = new Date();
  viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
  selectedDateISO = toISODate(now);
  render();
});

addEventBtn.addEventListener("click", () => {
  const iso = selectedDateISO || toISODate(new Date());
  openModalWithRange(iso, iso);
});

// Modal controls
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
backdrop.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  e.stopPropagation();
});

function saveEventFromModal() {
  const startDate = eventStartDate.value;
  const endDate = eventEndDate.value || startDate;
  const title = eventTitle.value.trim();

  if (!startDate || !title) {
    alert("Please enter a start date and a title.");
    return;
  }

  if (endDate < startDate) {
    alert("End date cannot be before start date.");
    return;
  }

  const newEvent = {
    id: crypto.randomUUID(),
    startDate,
    endDate,
    title,
    start: eventStart.value || "",
    end: eventEnd.value || "",
    notes: eventNotes.value.trim(),
    color: eventColor.value || "#00b5d9",
  };

  const events = getEvents();
  events.push(newEvent);
  setEvents(events);

  selectedDateISO = startDate;
  closeModal();
  render();
}

saveBtn.addEventListener("click", saveEventFromModal);

document.addEventListener("keydown", (e) => {
  // Only when modal is open
  if (!modal.classList.contains("show")) return;

  // Enter saves (but allow Enter inside textarea for new lines)
  if (e.key === "Enter") {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "textarea") return;

    e.preventDefault();
    saveEventFromModal();
  }
});

// Theme toggle (same behavior as dashboard)
const themeBtn = $("#themeBtn");
const savedTheme = storage.get("theme", "dark");
if (savedTheme === "light") document.body.classList.add("light");
themeBtn.textContent = document.body.classList.contains("light") ? "☀️" : "🌙";

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  themeBtn.textContent = isLight ? "☀️" : "🌙";
  storage.set("theme", isLight ? "light" : "dark");
});

// Initial
selectedDateISO = toISODate(new Date());
render();

// ---------- Wheel scroll: change months ----------
let wheelCooldown = false;

function goPrevMonth() {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  render();
}

function goNextMonth() {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  render();
}

if (calendarCard) {
  calendarCard.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || wheelCooldown) return;

      // prevent page scroll
      e.preventDefault();

      if (e.deltaY > 0) {
        goNextMonth();
      } else {
        goPrevMonth();
      }

      // cooldown to prevent rapid-fire month changes
      wheelCooldown = true;
      setTimeout(() => {
        wheelCooldown = false;
      }, 280);
    },
    { passive: false }
  );
}
